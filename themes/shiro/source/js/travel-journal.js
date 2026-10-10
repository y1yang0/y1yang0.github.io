async function initializeJournal() {
    const root = document.getElementById('travelJournal');
    if (!root) return;
    const revision = new URL(import.meta.url).search;
    const [albumModule, mapModule, viewerModule, navigationModule] = await Promise.all([
        import(new URL(`./travel/album.mjs${revision}`, import.meta.url)),
        import(new URL(`./travel/map.mjs${revision}`, import.meta.url)),
        import(new URL(`./travel/photo-viewer.mjs${revision}`, import.meta.url)),
        import(new URL(`./travel/navigation.mjs${revision}`, import.meta.url))
    ]);
    const live = root.querySelector('#travelStatus');
    const provinceLevel = root.dataset.mapLevel === 'province';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
    let journal = {};
    try {
        const payload = JSON.parse(root.querySelector('#travelJournalData').textContent);
        if (isObject(payload)) journal = payload;
    } catch (_) {}
    const recordsAvailable = isObject(journal.albums) && isObject(journal.stats?.byPlace)
        && Object.values(journal.albums).every(album => isObject(album) && typeof album.name === 'string' && Array.isArray(album.entries));
    const recordsUnavailable = '旅行记录暂时无法读取，仍可浏览地图。';
    if (!recordsAvailable) live.classList.remove('visually-hidden');
    const albums = recordsAvailable ? journal.albums : {};
    const stats = recordsAvailable ? journal.stats.byPlace : null;
    const coverage = recordsAvailable ? journal.stats.coverage : null;
    const fallbackPlaces = new Map(Object.entries(albums).map(([id, album]) => [id, {id, name: album.name, province: ''}]));
    const keysByPlace = new Map(Object.entries(albums).map(([id, album]) => [id, new Set(
        album.entries.filter(isObject).flatMap(entry => (Array.isArray(entry.photos) ? entry.photos : []).flatMap(photo => {
            try { return [navigationModule.photoKey(photo.src, location.href)]; }
            catch (_) { return []; }
        }))
    )]));
    let navigation;
    let navigationStarted = false;
    let renderedPlace = '';
    const map = mapModule.createMap({
        root, stats, defaultPlace: journal.defaultPlace,
        onSelect: (id, options) => navigation.select(id, options),
        onViewChange: view => navigation?.setAtlasView(view),
        onReady: places => {
            album.setPlaces(places);
            restoreAfterMap();
        },
        onError: () => {
            album.setPlaces([...fallbackPlaces.values()]);
            restoreAfterMap();
        }
    });
    const album = albumModule.createAlbum({
        root, albums, stats: stats || {}, available: recordsAvailable, places: [...fallbackPlaces.values()],
        onSelect: (id, options) => navigation.select(id, options),
        onOpenPhoto: (index, trigger, options) => viewer.open(index, trigger, options)
    });
    const viewer = viewerModule.createPhotoViewer({
        dialog: root.querySelector('#travelPhotoViewer'),
        focusFallback: album.heading,
        onChange: (_, photo) => navigation.photoChanged(navigationModule.photoKey(photo.src, location.href)),
        onClose: () => navigation.photoClosed()
    });
    navigation = navigationModule.createNavigation({
        provinceLevel, legacyPlaces: journal.legacyPlaces || {}, initialView: map.initialView,
        isPlace: id => !!(map.getPlace(id) || fallbackPlaces.get(id)),
        isPhoto: (id, key) => !!keysByPlace.get(id)?.has(key),
        canValidate: () => map.ready,
        onRoute: renderRoute
    });
    function restoreAfterMap() {
        if (navigationStarted) navigation.restore({force: true, refreshMap: true, preserveScroll: true});
        else { navigationStarted = true; navigation.start(); }
    }
    function scrollToMap() {
        root.querySelector('.travel-atlas-layout').scrollIntoView({
            behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'
        });
    }
    function renderRoute(route, {previousRoute, atlasView, refreshMap = false, scroll = false, focus = false} = {}) {
        if (!route.place) {
            root.dataset.view = 'atlas';
            viewer.close();
            viewer.setPhotos([]);
            album.hide();
            renderedPlace = '';
            map.showAtlas(atlasView);
            root.querySelector('#travelAllCities').hidden = true;
            live.textContent = recordsAvailable
                ? (provinceLevel ? '全国旅行地图，选择一个地区查看相册。' : '全国旅行地图，选择一座城市查看相册。')
                : recordsUnavailable;
            if (scroll) scrollToMap();
            if (focus) map.focus();
            return;
        }
        const place = map.getPlace(route.place) || fallbackPlaces.get(route.place);
        if (!place) return;
        const enteringAlbum = !previousRoute?.place;
        root.dataset.view = 'album';
        root.querySelector('#travelAllCities').hidden = false;
        if (renderedPlace !== route.place) {
            viewer.close();
            viewer.setPhotos(album.render(place));
            renderedPlace = route.place;
        }
        if (enteringAlbum || previousRoute?.place !== route.place || refreshMap) map.select(route.place, {animate: scroll});
        const index = route.photo ? album.photos.findIndex(photo => navigationModule.photoKey(photo.src, location.href) === route.photo) : -1;
        if (index >= 0) {
            if (!viewer.isOpen || viewer.index !== index) viewer.open(index, album.photos[index].button);
        } else viewer.close();
        const summary = stats?.[route.place];
        live.textContent = recordsAvailable
            ? `已选择${place.name}，${summary?.recorded ? `${summary.photos} 张照片` : '还没有旅行记录'}。`
            : `已选择${place.name}。${recordsUnavailable}`;
        if (scroll) {
            const target = root.querySelector('.travel-atlas-layout');
            const top = target.getBoundingClientRect().top;
            const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
            if (enteringAlbum || top < headerBottom || top > window.innerHeight * .65) scrollToMap();
        }
        if (focus) album.heading.focus({preventScroll: true});
    }
    root.querySelector('#travelAllCities').addEventListener('click', () => navigation.showAtlas({scroll: true, focus: true}));
    if (coverage && Number.isFinite(coverage.visited) && Number.isFinite(coverage.total)) {
        const coverageNode = root.querySelector('#travelCoverage');
        coverageNode.textContent = coverage.total ? `${(coverage.visited / coverage.total * 100).toLocaleString('en', {maximumFractionDigits: 1})}%` : '—';
        root.querySelector('#travelPlaceCount').textContent = String(coverage.visited);
        coverageNode.parentElement.title = `${coverage.visited} / ${coverage.total} ${root.dataset.unit || '座城市'}`;
        coverageNode.parentElement.setAttribute('aria-label', `${root.dataset.coverageLabel || '点亮率'} ${coverageNode.textContent}，${coverageNode.parentElement.title}`);
    }
    map.initialize();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeJournal, {once: true});
else initializeJournal();
