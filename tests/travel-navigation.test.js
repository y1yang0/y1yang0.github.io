const assert = require('node:assert/strict');
const test = require('node:test');
const navigationModule = import('../themes/shiro/source/js/travel/navigation.mjs');

function createHost(url) {
    const location = new URL(url);
    const listeners = new Map();
    const frames = new Map();
    const stack = [{url: location.href, state: {unrelated: 'preserved'}}];
    let index = 0;
    let frameId = 0;
    const host = {
        location, scrollY: 0,
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push(callback);
        },
        requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
        scrollTo({top}) { host.scrollY = top; },
        flushFrames() {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback());
        },
        get length() { return stack.length; }
    };
    host.history = {
        get state() { return stack[index].state; },
        replaceState(state, _, nextURL) {
            location.href = new URL(nextURL, location.href).href;
            stack[index] = {url: location.href, state};
        },
        pushState(state, _, nextURL) {
            location.href = new URL(nextURL, location.href).href;
            stack.splice(index + 1);
            stack.push({url: location.href, state});
            index += 1;
        },
        back() {
            if (!index) return;
            index -= 1;
            location.href = stack[index].url;
            (listeners.get('popstate') || []).forEach(callback => callback());
        }
    };
    return host;
}

test('China city/photo hashes round-trip without losing filename characters', async () => {
    const {readRoute, routeHash} = await navigationModule;
    const route = {place: '330100', photo: 'hangzhou/西湖 1.jpg?original=1&name=a#detail'};
    assert.deepEqual(readRoute(routeHash(route)), route);
    assert.equal(routeHash({place: '', photo: route.photo}), '');
    assert.deepEqual(readRoute('#photo=orphan.jpg'), {place: '', photo: ''});
});

test('foreign legacy city hashes resolve through the country mapping and retain the photo', async () => {
    const {readRoute, routeHash} = await navigationModule;
    const config = {provinceLevel: true, legacyPlaces: {'JP-26100': 'JP-26', 'OLD-CITY': 'OTHER-REGION'}};
    assert.deepEqual(readRoute('#city=JP-26100&photo=japan%2Fjingdu-qss1.jpg', config), {
        place: 'JP-26', photo: 'japan/jingdu-qss1.jpg'
    });
    assert.deepEqual(readRoute('#city=OLD-CITY', config), {place: 'OTHER-REGION', photo: ''});
    assert.deepEqual(readRoute('#region=JP-27&city=JP-26100', config), {place: 'JP-27', photo: ''});
    assert.equal(routeHash({place: 'JP-26', photo: ''}, true), '#region=JP-26');
    assert.deepEqual(readRoute('#city=JP-99999', config), {place: 'JP-99999', photo: ''});
});

test('photo keys shorten only same-origin travel images', async () => {
    const {photoKey} = await navigationModule;
    const base = 'https://example.test/journal/japan/';
    assert.equal(photoKey('/images/travel/japan/京都.jpg?raw=1#crop', base), 'japan/%E4%BA%AC%E9%83%BD.jpg?raw=1#crop');
    assert.equal(photoKey('https://photos.test/images/travel/japan/a.jpg', base), 'https://photos.test/images/travel/japan/a.jpg');
    assert.equal(photoKey('/assets/figure.png', base), 'https://example.test/assets/figure.png');
});

test('map snapshots reject malformed dimensions', async () => {
    const {validView} = await navigationModule;
    assert.equal(validView([0, 0, 1000, 900]), true);
    for (const view of [null, [0, 0, 0, 900], [0, 0, 1000, -1], [0, 0, NaN, 900], [0, 0, 1000]]) {
        assert.equal(validView(view), false);
    }
});

test('opening a shared old Japanese photo link canonicalizes by replacement', async () => {
    const {createNavigation} = await navigationModule;
    const host = createHost('https://example.test/journal/japan/#city=JP-26100&photo=japan%2Fjingdu-qss1.jpg');
    const rendered = [];
    const navigation = createNavigation({host, provinceLevel: true,
        legacyPlaces: {'JP-26100': 'JP-26'}, initialView: [0, 0, 1000, 900],
        isPlace: id => id === 'JP-26', isPhoto: (_, key) => key === 'japan/jingdu-qss1.jpg',
        onRoute: route => rendered.push(route)});
    navigation.start();
    assert.equal(host.location.hash, '#region=JP-26&photo=japan%2Fjingdu-qss1.jpg');
    assert.equal(host.length, 1);
    assert.equal(host.history.state.unrelated, 'preserved');
    assert.deepEqual(rendered.at(-1), {place: 'JP-26', photo: 'japan/jingdu-qss1.jpg'});
    navigation.photoClosed();
    assert.equal(host.location.hash, '#region=JP-26');
    assert.equal(host.length, 1);
});

test('photo close and browser Back restore the album and earlier atlas view', async () => {
    const {createNavigation} = await navigationModule;
    const host = createHost('https://example.test/journal/');
    const rendered = [];
    const navigation = createNavigation({host, provinceLevel: false, initialView: [0, 0, 1000, 760],
        isPlace: id => id === '330100', isPhoto: (_, key) => ['hangzhou/a.jpg', 'hangzhou/b.jpg'].includes(key),
        onRoute: (route, options) => rendered.push({route, options})});
    navigation.start();
    navigation.setAtlasView([100, 200, 500, 380]);
    host.scrollY = 120;
    host.flushFrames();
    navigation.select('330100');
    host.scrollY = 460;
    navigation.photoChanged('hangzhou/a.jpg');
    const photoHistoryLength = host.length;
    navigation.photoChanged('hangzhou/b.jpg');
    assert.equal(host.length, photoHistoryLength);
    navigation.photoClosed();
    assert.deepEqual(navigation.route, {place: '330100', photo: ''});
    host.history.back();
    host.flushFrames();
    assert.deepEqual(navigation.route, {place: '', photo: ''});
    assert.deepEqual(rendered.at(-1).options.atlasView, [100, 200, 500, 380]);
    assert.equal(host.scrollY, 120);
});

test('viewer-close callbacks during navigation do not walk browser history', async () => {
    const {createNavigation} = await navigationModule;
    const host = createHost('https://example.test/journal/');
    let navigation;
    navigation = createNavigation({host, initialView: [0, 0, 1000, 760],
        isPlace: id => ['330100', '110000'].includes(id), isPhoto: () => true,
        onRoute: () => navigation.photoClosed()});
    navigation.start();
    navigation.select('330100');
    navigation.photoChanged('hangzhou/a.jpg');
    navigation.select('110000');
    assert.deepEqual(navigation.route, {place: '110000', photo: ''});
    assert.equal(host.location.hash, '#city=110000');
});

test('invalid photos are removed while the valid place remains selected', async () => {
    const {createNavigation} = await navigationModule;
    const host = createHost('https://example.test/journal/#city=330100&photo=missing.jpg');
    const navigation = createNavigation({host, initialView: [0, 0, 1000, 760],
        isPlace: id => id === '330100', isPhoto: () => false, onRoute: () => {}});
    navigation.start();
    assert.deepEqual(navigation.route, {place: '330100', photo: ''});
    assert.equal(host.location.hash, '#city=330100');
    assert.equal(host.length, 1);
});
