document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('travelJournal');
    if (!root) return;

    const svg = document.getElementById('travelMap');
    const canvas = document.getElementById('travelMapCanvas');
    const mapStatus = document.getElementById('travelMapStatus');
    const retry = document.getElementById('travelRetry');
    const tooltip = document.getElementById('travelMapTooltip');
    const mouseMagnifier = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const search = document.getElementById('travelSearch');
    const cityList = document.getElementById('travelCityList');
    const albumCities = document.getElementById('travelAlbumCities');
    const citySearch = document.getElementById('travelCitySearch');
    const searchResults = document.getElementById('travelSearchResults');
    const searchEmpty = document.getElementById('travelSearchEmpty');
    const details = document.getElementById('travelDetails');
    const heading = document.getElementById('travelCityName');
    const entriesNode = document.getElementById('travelEntries');
    const empty = document.getElementById('travelEmpty');
    const live = document.getElementById('travelStatus');
    const viewer = document.getElementById('travelPhotoViewer');
    const viewerImage = document.getElementById('travelViewerImage');
    const viewerCaption = document.getElementById('travelViewerCaption');
    const viewerCounter = document.getElementById('travelViewerCounter');
    const viewerStatus = document.getElementById('travelViewerStatus');
    const viewerRetry = document.getElementById('travelViewerRetry');
    const viewerReset = document.getElementById('travelViewerReset');
    const viewerStage = document.getElementById('travelViewerStage');
    const photoLens = document.getElementById('travelPhotoLens');
    const photoMagnifier = document.getElementById('travelPhotoMagnifier');
    const photoContext = photoMagnifier?.getContext('2d');
    const allCitiesButton = document.getElementById('travelAllCities');
    const svgNS = 'http://www.w3.org/2000/svg';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fallbackCities = [
        ['330100', '杭州市', '浙江省'], ['110000', '北京市', '北京市'],
        ['310000', '上海市', '上海市'], ['510100', '成都市', '四川省'],
        ['320100', '南京市', '江苏省'], ['440100', '广州市', '广东省'],
        ['610100', '西安市', '陕西省'], ['320500', '苏州市', '江苏省'],
        ['500000', '重庆市', '重庆市'], ['350200', '厦门市', '福建省']
    ].map(([id, name, province]) => ({id, name, province}));
    let journal = {cities: {}, defaultCity: '330100'};
    try {
        const parsed = JSON.parse(document.getElementById('travelJournalData')?.textContent || '{}');
        if (parsed && typeof parsed === 'object') journal = {...journal, ...parsed};
    } catch (_) {
        live.textContent = '旅行记录暂时无法读取，仍可浏览城市地图。';
    }
    if (!journal.cities || typeof journal.cities !== 'object') journal.cities = {};

    let cities = [...fallbackCities];
    Object.keys(journal.cities).forEach(id => {
        if (!cities.some(city => city.id === id)) cities.push({id, name: textFallbackName(id), province: ''});
    });
    let cityById = new Map(cities.map(city => [city.id, city]));
    let activeId = '';
    let activeResult = -1;
    let gallery = [];
    let albumObserver;
    let albumLoadEpoch = 0;
    let albumLoading = 0;
    const albumLoadQueue = [];
    let viewerIndex = 0;
    let viewerTrigger = null;
    let viewerRequest = 0;
    let viewerOriginalSrc = '';
    let viewerLoadSrc = '';
    let photoZoom = 1;
    let photoPan = {x: 0, y: 0};
    const photoTouches = new Map();
    let photoGesture = null;
    let photoTap = null;
    const authoredBox = svg.viewBox.baseVal;
    let initialBox = [authoredBox.x, authoredBox.y, authoredBox.width, authoredBox.height];
    let view = [...initialBox];
    let atlasView = [...initialBox];
    let restoringNavigation = false;
    let navigationReady = false;
    let lastAppliedUrl = '';
    let navigationScrollFrame = 0;
    let mapReady = false;
    let drag = null;
    let suppressClick = false;
    let pendingMapCity = '';
    let viewAnimation = 0;
    let markers;
    let provinceLabels;
    let provinces = [];
    let paths = new Map();
    let provinceFocus = null;
    let provinceFocusExtent = null;
    let hoverProvinceName = '';
    let provinceHideTimer = 0;
    let heartCityIds = new Set();

    const text = value => typeof value === 'string' ? value : '';
    function textFallbackName(id) {
        const cityName = journal.cities[id]?.name;
        return typeof cityName === 'string' && cityName.trim() ? cityName : `城市 ${id}`;
    }
    const record = id => journal.cities[id] || {};
    const entries = id => Array.isArray(record(id).entries) ? record(id).entries.filter(entry => entry && typeof entry === 'object') : [];
    const photos = entry => Array.isArray(entry.photos) ? entry.photos.filter(photo => photo && typeof photo.src === 'string') : [];
    const hasRecord = id => entries(id).length > 0;
    const photoCount = id => entries(id).reduce((sum, entry) => sum + photos(entry).length, 0);
    const maxPhotoCount = Math.max(1, ...Object.keys(journal.cities).map(photoCount));
    // Match the server-rendered map so enabling interactions does not change its colors.
    const photoWeight = id => {
        const count = photoCount(id);
        const weight = count ? 22 + (maxPhotoCount > 1 ? 58 * Math.log(count) / Math.log(maxPhotoCount) : 0) : 0;
        return `${weight.toFixed(2)}%`;
    };
    const cityDescription = city => `${city.name}${hasRecord(city.id) ? ` · ${photoCount(city.id)} 张照片` : ''}`;
    const shortName = name => text(name).replace(/(?:特别行政区|自治州|地区|市)$/u, '');
    const make = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };
    const svgNode = (tag, attrs) => {
        const node = document.createElementNS(svgNS, tag);
        Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
        return node;
    };
    const validImage = src => {
        if (!text(src).trim()) return '';
        try {
            const url = new URL(src, document.baseURI);
            return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : '';
        } catch (_) { return ''; }
    };
    function updateStats() {
        const visited = Object.keys(journal.cities).filter(hasRecord);
        document.getElementById('travelPlaceCount').textContent = String(visited.length);
        const total = Number(journal.totalCities) || (mapReady ? cities.length : 0);
        const coverage = document.getElementById('travelCoverage');
        coverage.textContent = total ? `${(visited.length / total * 100).toLocaleString('en', {maximumFractionDigits: 1})}%` : '—';
        coverage.parentElement.title = `${visited.length} / ${total} 座城市`;
        coverage.parentElement.setAttribute('aria-label', total ? `城市点亮率 ${coverage.textContent}，${visited.length} / ${total} 座城市` : '城市点亮率');
    }
    function renderCityControls() {
        const recordedCities = cities.filter(city => hasRecord(city.id)).sort((a, b) => photoCount(b.id) - photoCount(a.id));
        albumCities.hidden = !recordedCities.length;
        albumCities.replaceChildren();
        recordedCities.forEach(city => {
            const count = photoCount(city.id);
            const button = make('button', '', `${shortName(city.name)}(${count})`);
            button.type = 'button';
            button.dataset.cityId = city.id;
            button.setAttribute('aria-label', `${shortName(city.name)}，${count} 张照片`);
            button.title = cityDescription(city);
            button.setAttribute('aria-pressed', String(city.id === activeId));
            button.addEventListener('click', () => selectCity(city.id, {scroll: true, focus: true}));
            albumCities.append(button);
        });
    }
    function closeSearch() {
        searchResults.hidden = true;
        search.setAttribute('aria-expanded', 'false');
        search.removeAttribute('aria-activedescendant');
        activeResult = -1;
        cityList.querySelectorAll('[role="option"]').forEach(option => option.setAttribute('aria-selected', 'false'));
    }
    function setActiveResult(index, scroll = false) {
        const options = [...cityList.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        activeResult = (index + options.length) % options.length;
        options.forEach((option, i) => option.setAttribute('aria-selected', String(i === activeResult)));
        const option = options[activeResult];
        search.setAttribute('aria-activedescendant', option.id);
        if (scroll) {
            const bounds = cityList.getBoundingClientRect();
            const item = option.getBoundingClientRect();
            if (item.top < bounds.top) cityList.scrollTop -= bounds.top - item.top;
            else if (item.bottom > bounds.bottom) cityList.scrollTop += item.bottom - bounds.bottom;
        }
    }
    function renderSearchResults() {
        const query = search.value.trim().toLocaleLowerCase();
        closeSearch();
        cityList.replaceChildren();
        cityList.scrollTop = 0;
        if (!query) return;
        const matching = cities.filter(city => {
            const aliases = Array.isArray(city.aliases) ? city.aliases.filter(alias => typeof alias === 'string').join(' ') : '';
            return `${city.name} ${shortName(city.name)} ${city.province} ${text(city.pinyin)} ${aliases} ${city.id}`.toLocaleLowerCase().includes(query);
        });
        const rank = city => shortName(city.name).toLocaleLowerCase() === query ? 0 : city.name.toLocaleLowerCase().startsWith(query) ? 1 : hasRecord(city.id) ? 2 : 3;
        matching.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'zh-CN'));
        matching.forEach(city => {
            const option = make('button', 'travel-city-option');
            option.type = 'button';
            option.tabIndex = -1;
            option.id = `travelSearchOption-${city.id}`;
            option.dataset.cityId = city.id;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.title = city.name;
            option.addEventListener('pointerdown', event => event.preventDefault());
            option.append(make('span', '', shortName(city.name)));
            if (city.province && city.province !== city.name) option.append(make('small', '', city.province));
            option.addEventListener('click', () => selectCity(city.id, {scroll: true, focus: true}));
            cityList.append(option);
        });
        cityList.hidden = !matching.length;
        searchEmpty.hidden = !!matching.length;
        searchResults.hidden = false;
        search.setAttribute('aria-expanded', 'true');
        if (matching.length) setActiveResult(0);
    }
    function clearAlbumLoads() {
        albumLoadEpoch += 1;
        albumObserver?.disconnect();
        albumLoadQueue.length = 0;
        albumLoading = 0;
        gallery.forEach(photo => {
            if (photo.loading) photo.image.removeAttribute('src');
        });
    }
    function pumpAlbumLoads() {
        while (albumLoading < 2 && albumLoadQueue.length) {
            const photo = albumLoadQueue.shift();
            photo.queued = false;
            if (!photo.image.isConnected || photo.image.hasAttribute('src')) continue;
            photo.loading = true;
            photo.loadEpoch = albumLoadEpoch;
            albumLoading += 1;
            // The observer owns deferral; once a slot is reserved, start the
            // request rather than letting native lazy loading defer it again.
            photo.image.loading = 'eager';
            photo.image.src = photo.src;
        }
    }
    function finishAlbumLoad(photo) {
        const pending = albumLoadQueue.indexOf(photo);
        if (pending >= 0) albumLoadQueue.splice(pending, 1);
        photo.queued = false;
        if (photo.loading && photo.loadEpoch === albumLoadEpoch) albumLoading = Math.max(0, albumLoading - 1);
        photo.loading = false;
        pumpAlbumLoads();
    }
    function queueAlbumPhoto(photo) {
        if (photo.queued || photo.loading || photo.image.hasAttribute('src')) return;
        photo.queued = true;
        albumLoadQueue.push(photo);
        pumpAlbumLoads();
    }
    function renderEntries(city) {
        clearAlbumLoads();
        gallery = [];
        const notes = entries(city.id);
        entriesNode.replaceChildren();
        entriesNode.hidden = !notes.length;
        empty.hidden = !!notes.length;
        document.getElementById('travelActiveProvince').textContent = city.province || '中国';
        heading.textContent = shortName(city.name);
        const count = photoCount(city.id);
        document.getElementById('travelCityMeta').textContent = notes.length
            ? (count ? `${count} 张照片` : `${notes.length} 次记录`)
            : '尚未记录';
        notes.forEach(entry => {
            const article = make('article', 'travel-entry');
            if (text(entry.title).trim()) article.append(make('h3', 'travel-place-title', entry.title));
            const paragraphs = Array.isArray(entry.notes) ? entry.notes : text(entry.notes).split(/\n\s*\n/);
            paragraphs.filter(paragraph => text(paragraph).trim()).forEach(paragraph => article.append(make('p', '', paragraph)));
            article.classList.toggle('has-writing', !!article.childElementCount);
            const grid = make('div', 'travel-photo-grid');
            photos(entry).forEach(photo => {
                const src = validImage(photo.src);
                if (!src) return;
                const figure = make('figure', 'travel-photo');
                const button = make('button', 'travel-photo-open');
                const image = make('img');
                button.type = 'button';
                const alt = text(photo.alt) || `${shortName(city.name)}旅行照片`;
                button.setAttribute('aria-label', `放大照片：${alt}`);
                image.alt = alt;
                image.loading = 'lazy';
                image.decoding = 'async';
                if (photo.width > 0 && photo.height > 0) {
                    image.width = photo.width;
                    image.height = photo.height;
                }
                const ratio = photo.width > 0 && photo.height > 0 ? `${photo.width} / ${photo.height}` : '4 / 3';
                image.style.aspectRatio = ratio;
                button.style.aspectRatio = ratio;
                const index = gallery.length;
                const item = {...photo, src, alt, image, button};
                gallery.push(item);
                button.addEventListener('click', () => openViewer(index, button, {retry: button.classList.contains('is-unavailable')}));
                image.addEventListener('load', () => {
                    image.style.aspectRatio = button.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
                    image.hidden = false;
                    button.classList.remove('is-unavailable');
                    button.querySelector('.travel-photo-error')?.remove();
                    finishAlbumLoad(item);
                });
                image.addEventListener('error', () => {
                    if (!image.complete || image.naturalWidth > 0) return;
                    finishAlbumLoad(item);
                    image.hidden = true;
                    button.classList.add('is-unavailable');
                    if (!button.querySelector('.travel-photo-error')) {
                        button.append(make('span', 'travel-photo-error', '照片暂时无法载入，点击重试'));
                    }
                });
                button.append(image);
                figure.append(button);
                if (text(photo.caption)) figure.append(make('figcaption', '', photo.caption));
                grid.append(figure);
            });
            if (grid.childElementCount) article.append(grid);
            entriesNode.append(article);
        });
        if ('IntersectionObserver' in window) {
            const byButton = new Map(gallery.map(photo => [photo.button, photo]));
            const epoch = albumLoadEpoch;
            const observer = new IntersectionObserver(changes => {
                if (epoch !== albumLoadEpoch) return;
                changes.filter(change => change.isIntersecting).forEach(change => {
                    observer.unobserve(change.target);
                    queueAlbumPhoto(byButton.get(change.target));
                });
            }, {rootMargin: '360px 0px'});
            albumObserver = observer;
            gallery.forEach(photo => observer.observe(photo.button));
        } else gallery.forEach(queueAlbumPhoto);
    }
    function renderMarkers() {
        if (!markers) return;
        const matrix = svg.getScreenCTM();
        const scale = matrix ? Math.max(.01, Math.hypot(matrix.a, matrix.b)) : 1;
        markers.replaceChildren();
        const selected = root.dataset.view === 'album' ? cityById.get(activeId) : null;
        const markerIds = new Set(heartCityIds);
        const visible = [...markerIds].map(id => cityById.get(id)).filter(Boolean);
        if (selected && !heartCityIds.has(selected.id)) visible.push(selected);
        visible.forEach(city => {
            if (!Array.isArray(city.center)) return;
            const [cx, cy] = city.center;
            const group = svgNode('g', {'data-city-id': city.id, 'class': 'travel-map-pin'});
            if (heartCityIds.has(city.id)) {
                group.append(svgNode('use', {href: '#travelMapHeart', transform: `translate(${cx} ${cy}) scale(${1 / scale})`, 'class': 'travel-map-heart'}));
            } else {
                group.append(svgNode('circle', {cx, cy, r: (selected ? 5 : 3) / scale, 'class': 'travel-map-marker'}));
            }
            if (selected?.id === city.id) {
                const alignLeft = cx > view[0] + view[2] * .8;
                const label = svgNode('text', {x: cx + (alignLeft ? -10 : 10) / scale, y: cy + 4 / scale, 'class': 'travel-map-label', 'text-anchor': alignLeft ? 'end' : 'start'});
                label.style.fontSize = `${13 / scale}px`;
                label.style.strokeWidth = `${3 / scale}px`;
                label.textContent = shortName(city.name);
                group.append(label);
            }
            markers.append(group);
        });
        renderProvinceLabels(scale);
        const insetLabel = canvas.querySelector('.travel-map-inset-label');
        if (insetLabel) {
            const insetMatrix = insetLabel.getScreenCTM();
            const insetScale = insetMatrix ? Math.max(.01, Math.hypot(insetMatrix.a, insetMatrix.b)) : scale;
            const insetWidth = insetLabel.ownerSVGElement.viewBox.baseVal.width;
            insetLabel.style.fontSize = `${Math.min(11 / insetScale, insetWidth * .22)}px`;
            insetLabel.setAttribute('x', String(insetWidth / 2));
            insetLabel.setAttribute('text-anchor', 'middle');
        }
    }
    function renderProvinceLabels(scale) {
        if (!provinceLabels) return;
        provinceLabels.replaceChildren();
        const selected = root.dataset.view === 'album' ? cityById.get(activeId) : null;
        const national = initialBox[2] / view[2] < 2.5;
        const fontSize = national && scale < .45 ? 9 : 11;
        const provinceName = name => text(name).replace(/(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
        const margin = (national ? 4 : 12) / scale;
        const frame = [view[0] + margin, view[1] + margin, view[0] + view[2] - margin, view[1] + view[3] - margin];
        const occupied = [...markers.querySelectorAll('.travel-map-label')].map(label => {
            const box = label.getBBox();
            return [box.x, box.y, box.x + box.width, box.y + box.height];
        });
        const cityNames = new Set([...markers.querySelectorAll('.travel-map-label')].map(label => label.textContent));
        markers.querySelectorAll('.travel-map-pin').forEach(pin => {
            const center = cityById.get(pin.dataset.cityId)?.center;
            if (center) occupied.push([center[0] - 5 / scale, center[1] - 5 / scale, center[0] + 5 / scale, center[1] + 5 / scale]);
        });
        const fits = box => box[0] >= frame[0] && box[1] >= frame[1] && box[2] <= frame[2] && box[3] <= frame[3];
        const padding = 4 / scale;
        const overlaps = box => occupied.some(other => box[0] < other[2] + padding && box[2] > other[0] - padding && box[1] < other[3] + padding && box[3] > other[1] - padding);
        const nationalOffsets = [[0, 0]];
        [14, 28, 42, 56].forEach(distance => {
            [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
                .forEach(([dx, dy]) => nationalOffsets.push([dx * distance, dy * distance]));
        });
        const area = province => province.bounds ? (province.bounds[2] - province.bounds[0]) * (province.bounds[3] - province.bounds[1]) : Infinity;
        // Small regions have less room to place their names; reserve that
        // space before labeling the wider provinces in the national view.
        const ordered = [...provinces].sort((a, b) => Number(b.name === selected?.province) - Number(a.name === selected?.province)
            || (national ? area(a) - area(b) : 0));
        ordered.forEach(province => {
            const name = provinceName(province.name);
            if (cityNames.has(name)) return;
            const bounds = province.bounds;
            if (bounds && (bounds[2] < view[0] || bounds[0] > view[0] + view[2] || bounds[3] < view[1] || bounds[1] > view[1] + view[3])) return;
            const label = svgNode('text', {'class': 'travel-map-province-label', 'text-anchor': 'middle', 'dominant-baseline': 'central'});
            label.textContent = name;
            label.style.fontSize = `${fontSize / scale}px`;
            label.style.strokeWidth = `${2.5 / scale}px`;
            provinceLabels.append(label);
            const box = label.getBBox();
            let [x, y] = province.center;
            const active = province.name === selected?.province;
            if (active) {
                x = Math.max(frame[0] - box.x, Math.min(frame[2] - box.x - box.width, x));
                y = Math.max(frame[1] - box.y, Math.min(frame[3] - box.y - box.height, y));
            }
            const offsets = national
                ? nationalOffsets
                : active ? [[0, 0], [0, -16], [0, 16]] : [[0, 0]];
            const offset = offsets.find(([dx, dy]) => {
                const area = [x + dx / scale + box.x, y + dy / scale + box.y, x + dx / scale + box.x + box.width, y + dy / scale + box.y + box.height];
                return fits(area) && !overlaps(area);
            });
            if (offset === undefined) { label.remove(); return; }
            const labelX = x + offset[0] / scale;
            const labelY = y + offset[1] / scale;
            if (national && (offset[0] || offset[1])) {
                const edgeX = Math.max(labelX + box.x, Math.min(labelX + box.x + box.width, x));
                const edgeY = Math.max(labelY + box.y, Math.min(labelY + box.y + box.height, y));
                provinceLabels.insertBefore(svgNode('path', {
                    d: `M${x} ${y}L${edgeX} ${edgeY}`, class: 'travel-map-province-leader'
                }), label);
            }
            label.setAttribute('x', String(labelX));
            label.setAttribute('y', String(labelY));
            occupied.push([labelX + box.x, labelY + box.y, labelX + box.x + box.width, labelY + box.y + box.height]);
        });
    }
    function navigationRoute() {
        const params = new URLSearchParams(location.hash.slice(1));
        return {city: params.get('city') || '', photo: params.get('photo') || ''};
    }
    function hashCity() {
        return navigationRoute().city;
    }
    function photoKey(photo) {
        const url = new URL(photo.src);
        return url.origin === location.origin && url.pathname.startsWith('/images/travel/')
            ? `${url.pathname.slice('/images/travel/'.length)}${url.search}${url.hash}` : photo.src;
    }
    function navigationSnapshot(route, photoEntry = false) {
        return {city: route.city, photo: route.photo, atlasView: [...atlasView], scrollY: window.scrollY, photoEntry};
    }
    function rememberNavigation() {
        if (!navigationReady || restoringNavigation || navigationRoute().city !== activeId) return;
        const route = navigationRoute();
        const previous = history.state?.travelJournal;
        history.replaceState({...history.state, travelJournal: navigationSnapshot(route, !!previous?.photoEntry)}, '', location.href);
    }
    function scheduleNavigationMemory() {
        if (navigationScrollFrame) return;
        navigationScrollFrame = requestAnimationFrame(() => { navigationScrollFrame = 0; rememberNavigation(); });
    }
    function writeNavigation(city, photo = '', {replace = false, photoEntry = false} = {}) {
        const params = new URLSearchParams();
        if (city) params.set('city', city);
        if (city && photo) params.set('photo', photo);
        const query = params.toString();
        const hash = query ? `#${query}` : '';
        const url = `${location.pathname}${location.search}${hash}`;
        const same = location.hash === hash;
        const state = {...history.state, travelJournal: navigationSnapshot({city, photo}, photoEntry)};
        history[replace || same ? 'replaceState' : 'pushState'](state, '', url);
        lastAppliedUrl = location.href;
    }
    function restoreNavigation({force = false, refreshMap = false, preserveScroll = false} = {}) {
        if (!force && lastAppliedUrl === location.href) return;
        lastAppliedUrl = location.href;
        const route = navigationRoute();
        const saved = history.state?.travelJournal;
        restoringNavigation = true;
        if (Array.isArray(saved?.atlasView) && saved.atlasView.length === 4 && saved.atlasView.every(Number.isFinite)) atlasView = [...saved.atlasView];
        const city = cityById.get(route.city);
        if (city) {
            if (activeId !== city.id || root.dataset.view !== 'album') selectCity(city.id, {hash: false});
            else if (refreshMap) {
                heading.textContent = shortName(city.name);
                document.getElementById('travelActiveProvince').textContent = city.province || '中国';
                paths.forEach((cityPaths, id) => cityPaths.forEach(path => path.classList.toggle('is-selected', id === city.id)));
                focusCityMap(city);
                renderCityControls();
            }
            const index = route.photo ? gallery.findIndex(photo => photoKey(photo) === route.photo) : -1;
            if (index >= 0) {
                if (!viewer.open) openViewer(index, gallery[index].button);
                else if (viewerIndex !== index) viewerPhoto(index);
            } else {
                if (viewer.open) viewer.close();
                if (route.photo) writeNavigation(city.id, '', {replace: true});
            }
        } else {
            showAtlas({hash: false});
            if (mapReady && (route.city || route.photo)) writeNavigation('', '', {replace: true});
        }
        restoringNavigation = false;
        navigationReady = true;
        if (!history.state?.travelJournal) rememberNavigation();
        if (!preserveScroll && Number.isFinite(saved?.scrollY)) {
            requestAnimationFrame(() => window.scrollTo({top: saved.scrollY, behavior: 'instant'}));
        }
    }
    function selectCity(id, {scroll = false, focus = false, hash = true, historyMode = 'push'} = {}) {
        const city = cityById.get(String(id));
        if (!city) return false;
        if (hash) rememberNavigation();
        hideProvinceFocus();
        if (viewer?.open) viewer.close();
        const enteringAlbum = root.dataset.view !== 'album';
        if (enteringAlbum && !restoringNavigation) atlasView = [...view];
        activeId = city.id;
        root.dataset.view = 'album';
        details.hidden = false;
        allCitiesButton.hidden = false;
        tooltip.hidden = true;
        cancelViewAnimation();
        if (enteringAlbum) view = [...initialBox];
        closeSearch();
        search.value = '';
        paths.forEach((cityPaths, cityId) => cityPaths.forEach(path => path.classList.toggle('is-selected', cityId === activeId)));
        focusCityMap(city, {animate: scroll});
        renderEntries(city);
        renderCityControls();
        if (hash) writeNavigation(city.id, '', {replace: historyMode === 'replace'});
        live.textContent = `已选择${city.name}，${hasRecord(city.id) ? `${entries(city.id).reduce((sum, entry) => sum + photos(entry).length, 0)} 张照片` : '还没有旅行记录'}。`;
        if (scroll) {
            const target = root.querySelector('.travel-atlas-layout');
            const top = target.getBoundingClientRect().top;
            const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
            if (enteringAlbum || top < headerBottom || top > window.innerHeight * .65) target.scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'});
        }
        if (focus) heading.focus({preventScroll: true});
        return true;
    }
    function showAtlas({hash = true, scroll = false, focus = false} = {}) {
        if (hash) rememberNavigation();
        hideProvinceFocus();
        cancelViewAnimation();
        if (viewer?.open) viewer.close();
        activeId = '';
        clearAlbumLoads();
        gallery = [];
        root.dataset.view = 'atlas';
        details.hidden = true;
        allCitiesButton.hidden = true;
        closeSearch();
        search.value = '';
        tooltip.hidden = true;
        paths.forEach(cityPaths => cityPaths.forEach(path => path.classList.remove('is-selected')));
        view = [...atlasView];
        applyView();
        renderCityControls();
        if (hash) writeNavigation('', '');
        live.textContent = '全国旅行地图，选择一座城市查看相册。';
        if (scroll) root.querySelector('.travel-atlas-layout').scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'});
        if (focus) svg.focus({preventScroll: true});
    }
    allCitiesButton.addEventListener('click', () => showAtlas({scroll: true, focus: true}));
    root.addEventListener('travelphotochange', event => {
        if (restoringNavigation || !navigationReady) return;
        const photo = gallery[event.detail.index];
        if (!photo) return;
        rememberNavigation();
        const previous = navigationRoute();
        writeNavigation(activeId, photoKey(photo), {replace: !!previous.photo, photoEntry: previous.photo ? !!history.state?.travelJournal?.photoEntry : true});
    });
    viewer?.addEventListener('close', () => {
        if (viewer.open || restoringNavigation || !navigationRoute().photo) return;
        if (history.state?.travelJournal?.photoEntry) history.back();
        else writeNavigation(activeId, '', {replace: true});
    });
    window.addEventListener('scroll', scheduleNavigationMemory, {passive: true});
    function formatFileSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        const unit = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log2(bytes) / 10)));
        return `${(bytes / 1024 ** unit).toLocaleString('en', {maximumFractionDigits: unit ? 1 : 0})}${units[unit]}`;
    }
    function cancelViewerLoad() {
        viewerOriginalSrc = '';
        viewerLoadSrc = '';
        if (viewerRetry) viewerRetry.hidden = true;
        hidePhotoLens();
        resetPhotoTransform();
        viewerRequest += 1;
    }
    async function finishViewerLoad(request, src) {
        if (request !== viewerRequest || !viewer.open || viewerImage.currentSrc !== src) return;
        await viewerImage.decode().catch(() => {});
        if (request !== viewerRequest || !viewer.open || !viewerImage.complete
            || !viewerImage.naturalWidth || viewerImage.currentSrc !== src) return;
        viewerImage.hidden = false;
        viewerImage.setAttribute('aria-busy', 'false');
        viewerStatus.textContent = '';
        viewerOriginalSrc = src;
        if (viewerRetry) viewerRetry.hidden = true;
        const photo = gallery[viewerIndex];
        if (photo?.image?.isConnected && (!photo.image.naturalWidth || photo.button.classList.contains('is-unavailable'))) {
            photo.image.hidden = false;
            photo.button.classList.remove('is-unavailable');
            photo.button.querySelector('.travel-photo-error')?.remove();
            photo.image.src = src;
        }
    }
    function viewerPhoto(index, {retry = false} = {}) {
        if (!gallery.length) return;
        cancelViewerLoad();
        const request = viewerRequest;
        viewerIndex = (index + gallery.length) % gallery.length;
        const photo = gallery[viewerIndex];
        viewerImage.alt = photo.alt;
        viewerImage.setAttribute('aria-busy', 'true');
        viewerImage.hidden = true;
        viewerStatus.textContent = '高清原图加载中…';
        viewerCaption.textContent = text(photo.caption) || photo.alt;
        const fileSize = formatFileSize(photo.sizeBytes);
        viewerCounter.textContent = `${viewerIndex + 1} / ${gallery.length}${fileSize ? `  (${fileSize})` : ''}`;
        viewer.querySelectorAll('[data-prev-photo],[data-next-photo]').forEach(button => { button.disabled = gallery.length < 2; });
        viewerLoadSrc = photo.src;
        if (retry) {
            const retried = new URL(photo.src);
            retried.searchParams.set('_journal_retry', `${Date.now()}-${request}`);
            viewerLoadSrc = retried.href;
        }
        viewerImage.src = viewerLoadSrc;
        if (viewerImage.complete && viewerImage.naturalWidth) finishViewerLoad(request, viewerLoadSrc);
        root.dispatchEvent(new CustomEvent('travelphotochange', {detail: {index: viewerIndex}}));
    }
    function openViewer(index, trigger, options = {}) {
        if (!viewer || !gallery[index]) return;
        viewerTrigger = trigger;
        if (!viewer.open) viewer.showModal();
        viewerPhoto(index, options);
    }
    viewer?.querySelector('[data-close-photo]')?.addEventListener('click', () => viewer.close());
    viewer?.querySelector('[data-prev-photo]')?.addEventListener('click', () => viewerPhoto(viewerIndex - 1));
    viewer?.querySelector('[data-next-photo]')?.addEventListener('click', () => viewerPhoto(viewerIndex + 1));
    viewerRetry?.addEventListener('click', () => viewerPhoto(viewerIndex, {retry: true}));
    viewerReset?.addEventListener('click', resetPhotoTransform);
    viewer?.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            viewerPhoto(viewerIndex + (event.key === 'ArrowLeft' ? -1 : 1));
        }
    });
    viewer?.addEventListener('click', event => {
        if (event.target !== viewer) return;
        const bounds = viewer.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
    });
    viewer?.addEventListener('close', () => {
        if (viewer.open) return;
        cancelViewerLoad();
        (viewerTrigger?.isConnected ? viewerTrigger : heading)?.focus({preventScroll: true});
        viewerImage.removeAttribute('src');
        viewerImage.setAttribute('aria-busy', 'false');
        viewerStatus.textContent = '';
    });
    viewerImage?.addEventListener('load', () => finishViewerLoad(viewerRequest, viewerLoadSrc));
    viewerImage?.addEventListener('error', () => {
        if (!viewer.open || !viewerImage.complete || viewerImage.naturalWidth > 0) return;
        viewerOriginalSrc = '';
        hidePhotoLens();
        viewerImage.hidden = true;
        viewerImage.setAttribute('aria-busy', 'false');
        viewerStatus.textContent = '照片暂时无法载入，请稍后重试。';
        if (viewerRetry) viewerRetry.hidden = false;
    });
    function resetPhotoTransform() {
        photoTouches.forEach((_, id) => {
            if (viewerStage?.hasPointerCapture(id)) viewerStage.releasePointerCapture(id);
        });
        photoTouches.clear();
        photoGesture = null;
        photoTap = null;
        photoZoom = 1;
        photoPan = {x: 0, y: 0};
        if (viewerImage) viewerImage.style.transform = '';
        viewer?.classList.remove('is-photo-zoomed');
        if (viewerReset) viewerReset.hidden = true;
    }
    function transformPhoto(scale, x, y) {
        photoZoom = Math.max(1, Math.min(5, scale));
        const limitX = Math.max(0, (viewerImage.offsetWidth * photoZoom - viewerStage.clientWidth) / 2);
        const limitY = Math.max(0, (viewerImage.offsetHeight * photoZoom - viewerStage.clientHeight) / 2);
        photoPan = {x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y))};
        const zoomed = photoZoom > 1.01;
        if (!zoomed) photoPan = {x: 0, y: 0};
        viewerImage.style.transform = zoomed ? `translate(${photoPan.x}px,${photoPan.y}px) scale(${photoZoom})` : '';
        viewer.classList.toggle('is-photo-zoomed', zoomed);
        if (viewerReset) viewerReset.hidden = !zoomed;
        hidePhotoLens();
    }
    function photoTouchCenter() {
        const bounds = viewerStage.getBoundingClientRect();
        return {x: bounds.left + viewerImage.offsetLeft + viewerImage.offsetWidth / 2,
            y: bounds.top + viewerImage.offsetTop + viewerImage.offsetHeight / 2};
    }
    function startPhotoGesture(blockSwipe = false) {
        const points = [...photoTouches.values()];
        if (points.length >= 2) {
            const [a, b] = points;
            photoGesture = {kind: 'pinch', distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
                mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, center: photoTouchCenter(),
                zoom: photoZoom, pan: {...photoPan}};
            photoTap = null;
        } else if (points.length) {
            const point = points[0];
            photoGesture = {kind: 'single', start: {...point}, last: {...point}, time: performance.now(),
                zoom: photoZoom, pan: {...photoPan}, blockSwipe};
        } else photoGesture = null;
    }
    viewerStage?.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' || !viewer.open || !viewerOriginalSrc) return;
        hidePhotoLens();
        photoTouches.set(event.pointerId, {x: event.clientX, y: event.clientY});
        viewerStage.setPointerCapture(event.pointerId);
        startPhotoGesture(photoTouches.size > 1);
    });
    viewerStage?.addEventListener('pointermove', event => {
        if (!photoTouches.has(event.pointerId) || !photoGesture) return;
        event.preventDefault();
        const point = {x: event.clientX, y: event.clientY};
        photoTouches.set(event.pointerId, point);
        if (photoGesture.kind === 'pinch') {
            const [a, b] = [...photoTouches.values()];
            if (!a || !b) return;
            const midpoint = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
            const scale = Math.max(1, Math.min(5, photoGesture.zoom * Math.hypot(b.x - a.x, b.y - a.y) / photoGesture.distance));
            const ratio = scale / photoGesture.zoom;
            transformPhoto(scale,
                midpoint.x - photoGesture.center.x - (photoGesture.mid.x - photoGesture.center.x - photoGesture.pan.x) * ratio,
                midpoint.y - photoGesture.center.y - (photoGesture.mid.y - photoGesture.center.y - photoGesture.pan.y) * ratio);
        } else if (photoGesture.zoom > 1.01) {
            transformPhoto(photoGesture.zoom, photoGesture.pan.x + point.x - photoGesture.start.x,
                photoGesture.pan.y + point.y - photoGesture.start.y);
        } else {
            // Preserve vertical scrolling in the dialog while horizontal gestures
            // switch photos. Native page zoom remains available outside the image.
            const dx = point.x - photoGesture.start.x;
            const dy = point.y - photoGesture.start.y;
            if (Math.abs(dy) > Math.abs(dx)) viewer.scrollTop -= point.y - photoGesture.last.y;
            photoGesture.last = point;
        }
    }, {passive: false});
    function endPhotoGesture(event) {
        if (!photoTouches.has(event.pointerId)) return;
        const gesture = photoGesture;
        const onlyTouch = photoTouches.size === 1;
        photoTouches.delete(event.pointerId);
        if (viewerStage.hasPointerCapture(event.pointerId)) viewerStage.releasePointerCapture(event.pointerId);
        if (event.type !== 'pointercancel' && onlyTouch && gesture?.kind === 'single' && !gesture.blockSwipe) {
            const dx = event.clientX - gesture.start.x;
            const dy = event.clientY - gesture.start.y;
            const elapsed = performance.now() - gesture.time;
            const threshold = Math.max(45, Math.min(85, viewerStage.clientWidth * .18));
            if (gesture.zoom <= 1.01 && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.25 && elapsed < 800) {
                photoTap = null;
                viewerPhoto(viewerIndex + (dx < 0 ? 1 : -1));
            } else if (Math.hypot(dx, dy) < 10 && elapsed < 350) {
                const now = performance.now();
                if (photoTap && now - photoTap.time < 320 && Math.hypot(event.clientX - photoTap.x, event.clientY - photoTap.y) < 30) {
                    if (photoZoom > 1.01) resetPhotoTransform();
                    else {
                        const center = photoTouchCenter();
                        transformPhoto(2.5, (center.x - event.clientX) * 1.5, (center.y - event.clientY) * 1.5);
                    }
                    photoTap = null;
                } else photoTap = {x: event.clientX, y: event.clientY, time: now};
            } else photoTap = null;
        } else if (event.type === 'pointercancel') photoTap = null;
        if (photoTouches.size) startPhotoGesture(true);
        else photoGesture = null;
    }
    viewerStage?.addEventListener('pointerup', endPhotoGesture);
    viewerStage?.addEventListener('pointercancel', endPhotoGesture);
    function hidePhotoLens() {
        if (photoLens) photoLens.hidden = true;
        viewer?.classList.remove('is-photo-magnifying');
    }
    function showPhotoLens(event) {
        if (!photoLens || !photoContext || !viewer.open || !viewerOriginalSrc
            || viewerImage.currentSrc !== viewerOriginalSrc || !viewerImage.complete
            || !viewerImage.naturalWidth || event.pointerType !== 'mouse'
            || !mouseMagnifier.matches || event.buttons || photoZoom > 1.01) {
            hidePhotoLens();
            return;
        }
        const bounds = viewerImage.getBoundingClientRect();
        const style = getComputedStyle(viewerImage);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const contentWidth = viewerImage.clientWidth - paddingX;
        const contentHeight = viewerImage.clientHeight - paddingY;
        const scale = Math.min(contentWidth / viewerImage.naturalWidth, contentHeight / viewerImage.naturalHeight);
        if (!scale) { hidePhotoLens(); return; }
        const width = viewerImage.naturalWidth * scale;
        const height = viewerImage.naturalHeight * scale;
        const x = event.clientX - bounds.left - viewerImage.clientLeft - parseFloat(style.paddingLeft) - (contentWidth - width) / 2;
        const y = event.clientY - bounds.top - viewerImage.clientTop - parseFloat(style.paddingTop) - (contentHeight - height) / 2;
        if (x < 0 || y < 0 || x > width || y > height) { hidePhotoLens(); return; }
        const stageBounds = viewerStage.getBoundingClientRect();
        photoLens.hidden = false;
        photoLens.style.left = `${event.clientX - stageBounds.left}px`;
        photoLens.style.top = `${event.clientY - stageBounds.top}px`;
        const size = photoLens.clientWidth;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const pixels = Math.round(size * ratio);
        if (photoMagnifier.width !== pixels || photoMagnifier.height !== pixels) {
            photoMagnifier.width = photoMagnifier.height = pixels;
        }
        photoContext.setTransform(pixels / size, 0, 0, pixels / size, 0, 0);
        photoContext.clearRect(0, 0, size, size);
        const sourceSize = size / (scale * 3);
        // Canvas clips source areas beyond the photo, preserving the pointer's
        // exact position and the paper-colored margins at the image edges.
        try {
            photoContext.drawImage(viewerImage,
                x / scale - sourceSize / 2, y / scale - sourceSize / 2, sourceSize, sourceSize,
                0, 0, size, size);
        } catch (_) {
            hidePhotoLens();
            return;
        }
        viewer.classList.add('is-photo-magnifying');
    }
    viewerImage?.addEventListener('pointermove', showPhotoLens);
    viewerImage?.addEventListener('pointerleave', hidePhotoLens);
    viewerImage?.addEventListener('pointerdown', hidePhotoLens);
    viewer?.addEventListener('scroll', hidePhotoLens, {passive: true});
    viewer?.addEventListener('keydown', hidePhotoLens);
    window.addEventListener('scroll', hidePhotoLens, {passive: true});
    window.addEventListener('resize', hidePhotoLens, {passive: true});
    window.addEventListener('resize', resetPhotoTransform, {passive: true});
    window.addEventListener('blur', hidePhotoLens);
    mouseMagnifier.addEventListener('change', hidePhotoLens);
    if (viewerImage) new ResizeObserver(hidePhotoLens).observe(viewerImage);

    function cancelViewAnimation() {
        cancelAnimationFrame(viewAnimation);
        viewAnimation = 0;
    }
    function focusCityMap(city, {animate = false} = {}) {
        cancelViewAnimation();
        if (!mapReady || !Array.isArray(city.center)) { applyView(); return; }
        // Fit the selected city's boundary, leaving room for nearby cities.
        // Inset cities use their already transformed map coordinates.
        const bounds = !city.insetCenter && paths.get(city.id)?.[0]?.getBBox();
        const zoom = bounds?.width > 0 && bounds?.height > 0
            ? Math.max(1.5, Math.min(12, initialBox[2] / (bounds.width * 2.6), initialBox[3] / (bounds.height * 2.6)))
            : 6.75;
        const center = bounds?.width > 0 && bounds?.height > 0
            ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
            : city.center;
        const width = initialBox[2] / zoom;
        const height = initialBox[3] / zoom;
        const target = [center[0] - width / 2, center[1] - height / 2, width, height];
        if (!animate || reducedMotion) { view = target; applyView(); return; }
        const start = [...view];
        const started = performance.now();
        function step(now) {
            const progress = Math.min(1, (now - started) / 320);
            const ease = 1 - (1 - progress) ** 3;
            view = start.map((value, index) => value + (target[index] - value) * ease);
            applyView();
            viewAnimation = progress < 1 ? requestAnimationFrame(step) : 0;
        }
        viewAnimation = requestAnimationFrame(step);
    }
    function applyView() {
        hideProvinceFocus();
        const zoom = initialBox[2] / view[2];
        const marginX = initialBox[2] * .04;
        const marginY = initialBox[3] * .04;
        view[0] = Math.max(initialBox[0] - marginX, Math.min(initialBox[0] + initialBox[2] - view[2] + marginX, view[0]));
        view[1] = Math.max(initialBox[1] - marginY, Math.min(initialBox[1] + initialBox[3] - view[3] + marginY, view[1]));
        svg.setAttribute('viewBox', view.join(' '));
        root.dataset.zoomed = String(zoom > 1.01);
        root.querySelector('[data-travel-zoom="in"]').disabled = !mapReady || zoom >= 11.99;
        root.querySelector('[data-travel-zoom="out"]').disabled = !mapReady || zoom <= 1.01;
        root.querySelector('[data-travel-zoom="reset"]').disabled = !mapReady || zoom <= 1.01;
        renderMarkers();
        if (root.dataset.view === 'atlas') { atlasView = [...view]; scheduleNavigationMemory(); }
    }
    function zoomBy(factor, center) {
        cancelViewAnimation();
        if (!mapReady) return;
        const zoom = Math.max(1, Math.min(12, initialBox[2] / view[2] * factor));
        const target = center || [view[0] + view[2] / 2, view[1] + view[3] / 2];
        const width = initialBox[2] / zoom;
        const height = initialBox[3] / zoom;
        view = zoom === 1 ? [...initialBox] : [target[0] - width / 2, target[1] - height / 2, width, height];
        applyView();
    }
    root.querySelectorAll('[data-travel-zoom]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.travelZoom === 'reset') {
            cancelViewAnimation(); view = [...initialBox]; applyView();
        }
        else zoomBy(button.dataset.travelZoom === 'in' ? 1.5 : 1 / 1.5, cityById.get(activeId)?.center);
    }));
    function pointInMap(event) {
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
    }
    function hideProvinceFocus() {
        clearTimeout(provinceHideTimer);
        provinceHideTimer = 0;
        provinceFocus?.remove();
        provinceFocus = null;
        provinceFocusExtent = null;
        hoverProvinceName = '';
        delete root.dataset.hoverProvince;
    }
    function scheduleProvinceHide() {
        if (provinceHideTimer || !provinceFocus) return;
        // A small gap between the original boundary and its lifted edge should
        // not collapse the province while the pointer crosses that gap.
        provinceHideTimer = window.setTimeout(hideProvinceFocus, 120);
    }
    function provinceCityName(city) {
        if (city.province === '台湾省') return city.name;
        // Keep familiar place names readable without dropping a city from the
        // map; each label's title still carries the full administrative name.
        return shortName(city.name).replace(/自治县$/u, '')
            .replace(/(?:蒙古族?|藏族|羌族|彝族|苗族|白族|傣族|哈尼族|壮族|黎族|回族|土家族|布依族|侗族|傈僳族|景颇族|朝鲜族|哈萨克|柯尔克孜)+$/u, '');
    }
    function renderProvinceCityLabels(group, provinceCities, bounds, pixelScale) {
        const padding = 3 / pixelScale;
        const occupied = [];
        const frame = [bounds[0] - 44 / pixelScale, bounds[1] - 36 / pixelScale,
            bounds[2] + 44 / pixelScale, bounds[3] + 36 / pixelScale];
        const labels = provinceCities.map(city => {
            const cityPaths = paths.get(city.id).filter(path => path.ownerSVGElement === svg);
            let center = city.mainCenter || city.center;
            if (city.insetCenter || !Array.isArray(center)) {
                const box = cityPaths[0].getBBox();
                center = [box.x + box.width / 2, box.y + box.height / 2];
            }
            const label = svgNode('text', {
                class: `travel-province-city-label${hasRecord(city.id) ? ' is-recorded' : ''}`,
                'data-city-id': city.id, 'text-anchor': 'middle', 'dominant-baseline': 'central'
            });
            label.textContent = provinceCityName(city);
            label.style.fontSize = `${12 / pixelScale}px`;
            label.style.strokeWidth = `${3 / pixelScale}px`;
            const title = svgNode('title');
            title.textContent = cityDescription(city);
            label.append(title);
            group.append(label);
            return {city, center, label, box: label.getBBox()};
        });
        // Reserve the most crowded anchors first, so dense coastal clusters
        // can spread to nearby empty space without hiding any of their names.
        const nearestDistance = item => Math.min(...labels.filter(other => other !== item)
            .map(other => Math.hypot(item.center[0] - other.center[0], item.center[1] - other.center[1])));
        labels.sort((a, b) => nearestDistance(a) - nearestDistance(b) || b.box.width - a.box.width);
        const fits = box => box[0] >= frame[0] && box[1] >= frame[1] && box[2] <= frame[2] && box[3] <= frame[3];
        const overlaps = box => occupied.some(other => box[0] < other[2] + padding && box[2] > other[0] - padding
            && box[1] < other[3] + padding && box[3] > other[1] - padding);
        const offsets = [[0, 0]];
        [14, 28, 42, 56, 70].forEach(distance => {
            [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
                .forEach(([dx, dy]) => offsets.push([dx * distance / pixelScale, dy * distance / pixelScale]));
        });
        labels.forEach(({center, label, box}) => {
            const areaAt = (x, y) => [x + box.x, y + box.y, x + box.x + box.width, y + box.y + box.height];
            const available = (x, y) => fits(areaAt(x, y)) && !overlaps(areaAt(x, y));
            let position = offsets.map(([dx, dy]) => [center[0] + dx, center[1] + dy])
                .find(([x, y]) => available(x, y));
            if (!position) {
                // Scan nearest free positions rather than moving unresolved
                // cities into a separate list or drawing leader lines.
                const candidates = [];
                const step = 8 / pixelScale;
                for (let y = frame[1] - box.y; y <= frame[3] - box.y - box.height; y += step) {
                    for (let x = frame[0] - box.x; x <= frame[2] - box.x - box.width; x += step) {
                        if (available(x, y)) candidates.push([x, y]);
                    }
                }
                candidates.sort((a, b) => Math.hypot(a[0] - center[0], a[1] - center[1])
                    - Math.hypot(b[0] - center[0], b[1] - center[1]));
                position = candidates[0];
            }
            if (!position) {
                // Very narrow provinces at unusual viewport sizes can exhaust
                // the local frame. Extend a nearby row and still show every city.
                const x = Math.max(frame[0] - box.x, Math.min(frame[2] - box.x - box.width, center[0]));
                let y = frame[3] - box.y + padding;
                while (overlaps(areaAt(x, y))) y += (box.height + padding);
                position = [x, y];
                frame[3] = y + box.y + box.height;
            }
            label.setAttribute('x', String(position[0]));
            label.setAttribute('y', String(position[1]));
            occupied.push(areaAt(...position));
        });
        return occupied;
    }
    function showProvinceFocus(name) {
        clearTimeout(provinceHideTimer);
        provinceHideTimer = 0;
        if (hoverProvinceName === name && provinceFocus) return;
        const provinceCities = cities.filter(city => city.province === name
            && paths.get(city.id)?.some(path => path.ownerSVGElement === svg));
        if (!provinceCities.length) { hideProvinceFocus(); return; }
        const matrix = svg.getScreenCTM();
        const screenScale = matrix && Math.hypot(matrix.a, matrix.b);
        if (!screenScale) return;
        const geometry = provinceCities.flatMap(city => paths.get(city.id).filter(path => path.ownerSVGElement === svg));
        const boxes = geometry.map(path => path.getBBox()).filter(box => box.width || box.height);
        if (!boxes.length) return;
        const bounds = [Math.min(...boxes.map(box => box.x)), Math.min(...boxes.map(box => box.y)),
            Math.max(...boxes.map(box => box.x + box.width)), Math.max(...boxes.map(box => box.y + box.height))];
        const width = bounds[2] - bounds[0];
        const height = bounds[3] - bounds[1];
        const cx = (bounds[0] + bounds[2]) / 2;
        const cy = (bounds[1] + bounds[3]) / 2;
        const targetSize = provinceCities.length === 1 ? 72 : Math.min(300, 210 + provinceCities.length * 4);
        const maximumScale = provinceCities.length === 1 ? 24 : 3.2;
        const viewportScale = Math.min((view[2] - 32 / screenScale) / width, (view[3] - 58 / screenScale) / height);
        const minimumScale = initialBox[2] / view[2] > 1.01 ? .01 : 1.06;
        const focusScale = Math.min(viewportScale, Math.max(minimumScale,
            Math.min(maximumScale, targetSize / (Math.max(width, height) * screenScale))));
        const pixelScale = screenScale * focusScale;
        const focus = svgNode('g', {id: 'travelProvinceFocus', class: 'travel-province-focus', 'data-province': name});
        const surface = svgNode('g', {class: 'travel-province-surface'});
        const defs = svgNode('defs');
        const clip = svgNode('clipPath', {id: 'travelProvinceClip', clipPathUnits: 'userSpaceOnUse'});
        geometry.forEach(path => {
            const shape = path.cloneNode(true);
            shape.removeAttribute('id');
            shape.classList.add('travel-province-city');
            shape.classList.remove('is-selected');
            shape.querySelector('title')?.remove();
            surface.append(shape);
            const outline = svgNode('path', {d: path.getAttribute('d')});
            if (path.hasAttribute('transform')) outline.setAttribute('transform', path.getAttribute('transform'));
            clip.append(outline);
        });
        defs.append(clip);
        focus.append(defs, surface);
        const terrain = canvas.querySelector('.travel-map-terrain');
        if (terrain) {
            const relief = terrain.cloneNode(false);
            relief.removeAttribute('id');
            relief.setAttribute('clip-path', 'url(#travelProvinceClip)');
            surface.append(relief);
        }
        canvas.querySelectorAll('.travel-map-province-border[data-province-name]').forEach(path => {
            if (path.dataset.provinceName !== name) return;
            const outline = path.cloneNode(false);
            outline.removeAttribute('id');
            outline.setAttribute('class', 'travel-province-outline');
            surface.append(outline);
        });
        hideProvinceFocus();
        // This sibling remains fully opaque when the national canvas recedes.
        svg.append(focus);
        provinceFocus = focus;
        hoverProvinceName = name;
        root.dataset.hoverProvince = name;
        // Clipping limits the pixels of the relief image, but SVG getBBox still
        // reports its national dimensions. Measure only shapes and text.
        const extent = [...bounds];
        const include = box => {
            extent[0] = Math.min(extent[0], box[0]);
            extent[1] = Math.min(extent[1], box[1]);
            extent[2] = Math.max(extent[2], box[2]);
            extent[3] = Math.max(extent[3], box[3]);
        };
        renderProvinceCityLabels(focus, provinceCities, bounds, pixelScale).forEach(include);
        if (provinceCities.length > 1) {
            const title = svgNode('text', {class: 'travel-province-title', x: cx,
                y: extent[1] - 18 / pixelScale, 'text-anchor': 'middle', 'pointer-events': 'none'});
            title.textContent = name.replace(/(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
            title.style.fontSize = `${18 / pixelScale}px`;
            title.style.strokeWidth = `${4 / pixelScale}px`;
            focus.append(title);
            const titleBox = title.getBBox();
            include([titleBox.x, titleBox.y, titleBox.x + titleBox.width, titleBox.y + titleBox.height]);
        }
        const left = cx + (extent[0] - cx) * focusScale;
        const top = cy + (extent[1] - cy) * focusScale;
        const right = cx + (extent[2] - cx) * focusScale;
        const bottom = cy + (extent[3] - cy) * focusScale;
        const margin = 10 / screenScale;
        let dx = 0;
        let dy = -10 / screenScale;
        if (left < view[0] + margin) dx = view[0] + margin - left;
        else if (right > view[0] + view[2] - margin) dx = view[0] + view[2] - margin - right;
        if (top + dy < view[1] + margin) dy = view[1] + margin - top;
        else if (bottom + dy > view[1] + view[3] - margin) dy = view[1] + view[3] - margin - bottom;
        focus.setAttribute('transform', `translate(${dx} ${dy}) translate(${cx} ${cy}) scale(${focusScale}) translate(${-cx} ${-cy})`);
        const focusMatrix = focus.getScreenCTM();
        const screenCorners = [[extent[0], extent[1]], [extent[2], extent[1]],
            [extent[0], extent[3]], [extent[2], extent[3]]].map(([x, y]) => {
            const point = svg.createSVGPoint();
            point.x = x;
            point.y = y;
            return point.matrixTransform(focusMatrix);
        });
        provinceFocusExtent = {
            left: Math.min(...screenCorners.map(point => point.x)), right: Math.max(...screenCorners.map(point => point.x)),
            top: Math.min(...screenCorners.map(point => point.y)), bottom: Math.max(...screenCorners.map(point => point.y))
        };
    }
    function showProvinceHover(event, city) {
        if (!mapReady || root.dataset.view !== 'atlas'
            || event.pointerType !== 'mouse' || !mouseMagnifier.matches) {
            hideProvinceFocus();
            return false;
        }
        tooltip.hidden = true;
        if (event.buttons || drag) return true;
        if (event.target.closest('#travelProvinceFocus')) {
            clearTimeout(provinceHideTimer);
            provinceHideTimer = 0;
            return true;
        }
        const onMainMap = event.target.closest('path[data-city-id]')?.ownerSVGElement === svg
            || event.target.closest('.travel-map-pin');
        if (city?.province && onMainMap && city.province !== hoverProvinceName) {
            showProvinceFocus(city.province);
            return true;
        }
        if (provinceFocusExtent) {
            const bounds = provinceFocusExtent;
            if (event.clientX >= bounds.left - 5 && event.clientX <= bounds.right + 5
                && event.clientY >= bounds.top - 5 && event.clientY <= bounds.bottom + 5) {
                clearTimeout(provinceHideTimer);
                provinceHideTimer = 0;
                return true;
            }
        }
        if (city?.province && onMainMap) showProvinceFocus(city.province);
        else scheduleProvinceHide();
        return true;
    }
    svg.addEventListener('pointerdown', event => {
        if (!mapReady || event.button !== 0 || !event.isPrimary) return;
        suppressClick = false;
        // Preserve the pressed city's identity if its lifted path disappears
        // during a later drag or a view change before the click is delivered.
        pendingMapCity = event.target.closest('[data-city-id]')?.dataset.cityId || '';
        if (event.pointerType !== 'mouse') hideProvinceFocus();
        cancelViewAnimation();
        if (root.dataset.zoomed !== 'true') return;
        const point = pointInMap(event);
        drag = {pointerId: event.pointerId, x: point.x, y: point.y, startX: event.clientX, startY: event.clientY, view: [...view], moved: false, cityId: pendingMapCity};
        svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', event => {
        if (drag?.pointerId === event.pointerId) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
            if (drag.moved) {
                const bounds = svg.getBoundingClientRect();
                const ratio = Math.max(view[2] / bounds.width, view[3] / bounds.height);
                view[0] = drag.view[0] - (event.clientX - drag.startX) * ratio;
                view[1] = drag.view[1] - (event.clientY - drag.startY) * ratio;
                applyView();
                root.classList.add('is-panning');
                tooltip.hidden = true;
            }
            return;
        }
        const city = cityById.get(event.target.closest('[data-city-id]')?.dataset.cityId);
        if (showProvinceHover(event, city)) return;
        if (!city) { tooltip.hidden = true; return; }
        tooltip.textContent = `${shortName(city.name)}${hasRecord(city.id) ? ` · ${photoCount(city.id)} 张照片` : ''}`;
        tooltip.hidden = false;
        const bounds = tooltip.parentElement.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(bounds.width - tooltip.offsetWidth - 8, event.clientX - bounds.left + 12))}px`;
        tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 36)}px`;
    });
    function endDrag(event) {
        if (drag?.pointerId !== event.pointerId) return;
        const clickedCity = !drag.moved && event.type !== 'pointercancel' ? drag.cityId : '';
        suppressClick = drag.moved || event.type === 'pointercancel';
        pendingMapCity = clickedCity || '';
        drag = null;
        root.classList.remove('is-panning');
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        // Wait for the click before changing layout. On touch devices,
        // rebuilding the album during pointerup can send that click to a
        // newly positioned photo underneath the finger.
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', () => { tooltip.hidden = true; hideProvinceFocus(); });
    svg.addEventListener('pointercancel', hideProvinceFocus);
    svg.addEventListener('keydown', hideProvinceFocus);
    window.addEventListener('scroll', hideProvinceFocus, {passive: true});
    window.addEventListener('resize', hideProvinceFocus, {passive: true});
    window.addEventListener('blur', hideProvinceFocus);
    mouseMagnifier.addEventListener('change', hideProvinceFocus);
    window.addEventListener('keydown', event => { if (event.key === 'Escape') hideProvinceFocus(); });
    svg.addEventListener('click', event => {
        if (suppressClick) {
            suppressClick = false;
            pendingMapCity = '';
            event.preventDefault();
            return;
        }
        const id = pendingMapCity || event.target.closest('[data-city-id]')?.dataset.cityId;
        pendingMapCity = '';
        if (id) selectCity(id, {scroll: true});
    });
    svg.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.5); return; }
        if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.5); return; }
        if (event.key === '0') { event.preventDefault(); cancelViewAnimation(); view = [...initialBox]; applyView(); return; }
        const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
        if (!direction || !mapReady) return;
        event.preventDefault();
        const current = cityById.get(activeId || journal.defaultCity) || cities.find(city => hasRecord(city.id)) || cities[0];
        if (!current?.center) return;
        let nearest;
        let distance = Infinity;
        cities.forEach(city => {
            if (city.id === activeId || !city.center) return;
            const dx = city.center[0] - current.center[0];
            const dy = city.center[1] - current.center[1];
            const forward = dx * direction[0] + dy * direction[1];
            if (forward <= 0) return;
            const lateral = Math.abs(dx * direction[1] - dy * direction[0]);
            const score = Math.hypot(dx, dy) + lateral * 1.5;
            if (score < distance) { distance = score; nearest = city; }
        });
        if (nearest) selectCity(nearest.id, {historyMode: activeId ? 'replace' : 'push'});
    });

    function setMapStatus(message) {
        mapStatus.hidden = false;
        mapStatus.replaceChildren(make('p', 'travel-map-message', message));
        if (retry) mapStatus.append(retry);
    }
    function initializeMap() {
        hideProvinceFocus();
        mapReady = false;
        if (retry) retry.hidden = true;
        try {
            const data = JSON.parse(document.getElementById('travelMapData').textContent);
            if (!Array.isArray(data.cities) || !data.cities.length || !Array.isArray(data.viewBox) || data.viewBox.length !== 4) throw new Error('Invalid map');
            paths = new Map();
            canvas.querySelectorAll('path[data-city-id]').forEach(path => {
                const id = path.dataset.cityId;
                if (!paths.has(id)) paths.set(id, []);
                paths.get(id).push(path);
            });
            cities = data.cities.filter(city => city && city.id && city.name && paths.has(String(city.id))).map(city => {
                const mapped = {...city, id: String(city.id), mainCenter: city.center};
                if (city.insetCenter && data.inset?.placement && data.inset?.viewBox) {
                    const [x, y, width, height] = data.inset.placement;
                    const [originX, originY, insetWidth, insetHeight] = data.inset.viewBox;
                    mapped.center = [x + (city.insetCenter[0] - originX) * width / insetWidth, y + (city.insetCenter[1] - originY) * height / insetHeight];
                }
                return mapped;
            });
            if (!cities.length || !data.viewBox.every(Number.isFinite) || data.viewBox[2] <= 0 || data.viewBox[3] <= 0) throw new Error('Invalid map');
            cityById = new Map(cities.map(city => [city.id, city]));
            heartCityIds = new Set((data.heartCities || []).map(String));
            provinces = (Array.isArray(data.provinces) ? data.provinces : []).filter(province => province && typeof province.name === 'string' && Array.isArray(province.center) && province.center.length === 2 && province.center.every(Number.isFinite));
            initialBox = [...data.viewBox];
            view = [...initialBox];
            paths.forEach((cityPaths, id) => cityPaths.forEach(path => {
                path.classList.toggle('is-recorded', hasRecord(id));
                path.dataset.photoCount = String(photoCount(id));
                path.style.setProperty('--travel-photo-weight', photoWeight(id));
                const title = path.querySelector('title');
                const city = cityById.get(id);
                if (title && city) title.textContent = cityDescription(city);
            }));
            markers = canvas.querySelector('.travel-map-markers');
            if (!markers) throw new Error('Missing map markers');
            provinceLabels = canvas.querySelector('.travel-map-province-labels');
            if (!provinceLabels) {
                provinceLabels = svgNode('g', {'class': 'travel-map-province-labels', 'pointer-events': 'none'});
                canvas.insertBefore(provinceLabels, markers);
            }
            mapReady = true;
            mapStatus.hidden = true;
            updateStats();
            const pendingQuery = search.value;
            restoreNavigation({force: true, refreshMap: true, preserveScroll: true});
            if (pendingQuery) { search.value = pendingQuery; renderSearchResults(); }
            applyView();
        } catch (_) {
            setMapStatus('地图交互暂时不可用，仍可查看已记录城市的相册。');
            if (retry) retry.hidden = false;
            renderCityControls();
            applyView();
        }
    }
    retry?.addEventListener('click', initializeMap);
    search.addEventListener('input', event => { if (!event.isComposing) renderSearchResults(); });
    search.addEventListener('compositionend', renderSearchResults);
    search.addEventListener('focus', () => { if (search.value.trim()) renderSearchResults(); });
    search.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape') {
            if (!searchResults.hidden) { event.preventDefault(); closeSearch(); }
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!search.value.trim()) return;
            event.preventDefault();
            const wasClosed = searchResults.hidden;
            if (wasClosed) renderSearchResults();
            const count = cityList.querySelectorAll('[role="option"]').length;
            if (!count) return;
            setActiveResult(wasClosed ? (event.key === 'ArrowDown' ? 0 : count - 1) : activeResult + (event.key === 'ArrowDown' ? 1 : -1), true);
        }
        if (event.key === 'Enter' && !searchResults.hidden && activeResult >= 0) {
            event.preventDefault();
            cityList.querySelectorAll('[role="option"]')[activeResult]?.click();
        }
    });
    document.addEventListener('pointerdown', event => { if (!citySearch.contains(event.target)) closeSearch(); });
    citySearch.addEventListener('focusout', event => { if (!citySearch.contains(event.relatedTarget)) closeSearch(); });
    window.addEventListener('hashchange', () => restoreNavigation());
    window.addEventListener('popstate', () => restoreNavigation());
    new ResizeObserver(() => { hideProvinceFocus(); renderMarkers(); }).observe(svg);
    svg.tabIndex = 0;
    updateStats();
    restoreNavigation({force: true, preserveScroll: true});
    applyView();
    initializeMap();
});
