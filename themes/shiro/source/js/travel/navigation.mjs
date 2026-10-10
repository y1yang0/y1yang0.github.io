export function readRoute(hash, {provinceLevel = false, legacyPlaces = {}} = {}) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const legacy = params.get('city') || '';
    const place = provinceLevel ? params.get('region') || legacyPlaces[legacy] || legacy : legacy;
    return {place, photo: place ? params.get('photo') || '' : ''};
}

export function routeHash({place = '', photo = ''}, provinceLevel = false) {
    const params = new URLSearchParams();
    if (place) params.set(provinceLevel ? 'region' : 'city', place);
    if (place && photo) params.set('photo', photo);
    const query = params.toString();
    return query ? `#${query}` : '';
}

export function photoKey(src, baseURL) {
    const url = new URL(src, baseURL);
    const origin = new URL(baseURL).origin;
    return url.origin === origin && url.pathname.startsWith('/images/travel/')
        ? `${url.pathname.slice('/images/travel/'.length)}${url.search}${url.hash}` : url.href;
}

export function validView(view) {
    return Array.isArray(view) && view.length === 4 && view.every(Number.isFinite) && view[2] > 0 && view[3] > 0;
}

export function createNavigation({host = window, provinceLevel, legacyPlaces, initialView,
    isPlace, isPhoto, canValidate = () => true, onRoute}) {
    const config = {provinceLevel, legacyPlaces};
    let route = {place: '', photo: ''};
    let atlasView = validView(initialView) ? [...initialView] : [];
    let rendering = false;
    let ready = false;
    let lastAppliedURL = '';
    let scrollFrame = 0;

    function snapshot(nextRoute, photoEntry = false) {
        return {place: nextRoute.place, photo: nextRoute.photo, atlasView: [...atlasView], scrollY: host.scrollY, photoEntry};
    }

    function remember() {
        if (!ready || rendering) return;
        const current = readRoute(host.location.hash, config);
        if (current.place !== route.place || current.photo !== route.photo) return;
        const saved = host.history.state?.travelJournal;
        host.history.replaceState({...host.history.state, travelJournal: snapshot(route, !!saved?.photoEntry)}, '', host.location.href);
    }

    function scheduleMemory() {
        if (scrollFrame) return;
        scrollFrame = host.requestAnimationFrame(() => { scrollFrame = 0; remember(); });
    }

    function write(nextRoute, {replace = false, photoEntry = false} = {}) {
        const hash = routeHash(nextRoute, provinceLevel);
        const url = `${host.location.pathname}${host.location.search}${hash}`;
        const state = {...host.history.state, travelJournal: snapshot(nextRoute, photoEntry)};
        host.history[replace || host.location.hash === hash ? 'replaceState' : 'pushState'](state, '', url);
        route = {...nextRoute};
        lastAppliedURL = host.location.href;
    }

    function render(options = {}) {
        rendering = true;
        try { onRoute({...route}, {...options, atlasView: [...atlasView]}); }
        finally { rendering = false; }
    }

    function restore({force = false, refreshMap = false, preserveScroll = false} = {}) {
        if (!force && lastAppliedURL === host.location.href) return;
        lastAppliedURL = host.location.href;
        const previousRoute = {...route};
        const saved = host.history.state?.travelJournal;
        if (validView(saved?.atlasView)) atlasView = [...saved.atlasView];
        const parsed = readRoute(host.location.hash, config);
        const knownPlace = parsed.place && isPlace(parsed.place);
        route = knownPlace ? {place: parsed.place, photo: parsed.photo && isPhoto(parsed.place, parsed.photo) ? parsed.photo : ''} : {place: '', photo: ''};
        if ((knownPlace || canValidate()) && host.location.hash !== routeHash(route, provinceLevel)) {
            write(route, {replace: true, photoEntry: !!saved?.photoEntry});
        }
        render({previousRoute, refreshMap});
        ready = true;
        if (!host.history.state?.travelJournal) remember();
        if (!preserveScroll && Number.isFinite(saved?.scrollY)) {
            host.requestAnimationFrame(() => host.scrollTo({top: saved.scrollY, behavior: 'instant'}));
        }
    }

    host.addEventListener('hashchange', () => restore());
    host.addEventListener('popstate', () => restore());
    host.addEventListener('scroll', scheduleMemory, {passive: true});

    return {
        start() { restore({force: true, preserveScroll: true}); },
        restore,
        get route() { return {...route}; },
        get atlasView() { return [...atlasView]; },
        setAtlasView(nextView) {
            if (!validView(nextView)) return;
            atlasView = [...nextView];
            scheduleMemory();
        },
        select(place, {scroll = false, focus = false, historyMode = 'push'} = {}) {
            if (!isPlace(place)) return false;
            remember();
            const previousRoute = {...route};
            write({place, photo: ''}, {replace: historyMode === 'replace'});
            render({previousRoute, scroll, focus});
            return true;
        },
        showAtlas({scroll = false, focus = false} = {}) {
            remember();
            const previousRoute = {...route};
            write({place: '', photo: ''});
            render({previousRoute, scroll, focus});
        },
        photoChanged(key) {
            if (!ready || rendering || !route.place || route.photo === key || !isPhoto(route.place, key)) return;
            remember();
            const previousPhoto = route.photo;
            const saved = host.history.state?.travelJournal;
            write({place: route.place, photo: key}, {replace: !!previousPhoto,
                photoEntry: previousPhoto ? !!saved?.photoEntry : true});
        },
        photoClosed() {
            if (!ready || rendering || !route.photo) return;
            if (host.history.state?.travelJournal?.photoEntry) host.history.back();
            else write({place: route.place, photo: ''}, {replace: true});
        }
    };
}
