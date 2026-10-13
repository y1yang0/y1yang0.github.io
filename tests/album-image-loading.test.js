'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function fixture({ firstCount = 5, secondCount = 2, native = false } = {}) {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const dom = new JSDOM(`<section id="travelRoot" data-country-name="中国">
    <nav id="travelAlbumCities"></nav><section id="travelDetails" hidden>
      <h2 id="travelCityName"></h2><span id="travelActiveProvince"></span><p id="travelCityMeta"></p>
      <div id="travelEntries"></div><div id="travelEmpty"><p>尚未记录</p></div>
    </section></section>`, { url: 'https://journal.test/journal/' });
  global.window = dom.window;
  global.document = dom.window.document;
  const places = [{ id: 'a', name: '甲市', province: '甲省' }, { id: 'b', name: '乙市', province: '乙省' }];
  const albumFor = (prefix, count) => ({ entries: [{ title: '旅行', notes: '',
    photos: Array.from({ length: count }, (_, index) => ({
      src: `/images/${prefix}${index + 1}.jpg`, alt: `${prefix}${index + 1}`,
      caption: index === 1 ? '' : `注解 ${index + 1}`, sizeBytes: (index + 1) * 1024,
      width: 640, height: 480
    })) }] });
  const albums = { a: albumFor('a', firstCount), b: albumFor('b', secondCount) };
  const requests = [];
  const imageLoader = native ? undefined : {
    load(src, options) {
      const pending = deferred();
      const alt = new URL(src).pathname.split('/').pop().replace('.jpg', '');
      const request = { src, options, ...pending, releases: 0, image: document.querySelector(`img[alt="${alt}"]`) };
      requests.push(request);
      options.onProgress({ loaded: 0, total: 0, percent: null });
      return { promise: pending.promise, release() {
        request.releases += 1;
        request.sourceAtRelease = request.image.getAttribute('src');
      } };
    }
  };
  const { createAlbum } = await import('../themes/shiro/source/js/travel/album.mjs');
  const root = document.getElementById('travelRoot');
  const album = createAlbum({ root, albums, imageLoader, places,
    stats: { a: { recorded: true, photos: firstCount }, b: { recorded: true, photos: secondCount } },
    formatFileSize: bytes => bytes > 0 ? `${bytes} B` : '', onSelect() {}, onOpenPhoto() {} });
  return { album, places, requests, dom, root,
    renderFirst: () => album.render(places[0]),
    dispose() {
      album.hide();
      dom.window.close();
      global.window = previousWindow;
      global.document = previousDocument;
    } };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function imageEvent(photo, type = 'load') {
  Object.defineProperty(photo.image, 'complete', { configurable: true, value: true });
  Object.defineProperty(photo.image, 'naturalWidth', { configurable: true, value: type === 'load' ? 640 : 0 });
  Object.defineProperty(photo.image, 'naturalHeight', { configurable: true, value: type === 'load' ? 480 : 0 });
  photo.image.dispatchEvent(new photo.image.ownerDocument.defaultView.Event(type));
}

test('every album image has caption size metadata, including an empty annotation, and byte progress clears after image load', async () => {
  const f = await fixture({ firstCount: 3 });
  try {
    const photos = f.renderFirst();
    assert.equal(f.root.querySelectorAll('figcaption').length, 3);
    photos.forEach((photo, index) => {
      assert.equal(photo.fileSize.textContent, `${(index + 1) * 1024} B`);
      assert.equal(photo.fileSize.hidden, false);
    });
    assert.equal(photos[1].metadata.parentElement.tagName, 'FIGCAPTION');
    assert.equal(photos[1].metadata.parentElement.firstChild, photos[1].metadata);
    assert.equal(photos[2].progress.hidden, true);
    f.requests[0].options.onProgress({ loaded: 256, total: 512, percent: 50 });
    assert.equal(photos[0].progress.textContent, '加载 50%');
    assert.equal(photos[0].fileSize.textContent, '1024 B');
    f.requests[0].options.onProgress({ loaded: 512, total: 512, percent: 100 });
    f.requests[0].resolve({ src: 'blob:downloaded-a1', sizeBytes: 1024 });
    await flush();
    assert.equal(photos[0].progress.textContent, '加载 100%');
    imageEvent(photos[0]);
    assert.equal(photos[0].progress.hidden, true);
    assert.equal(photos[0].fileSize.textContent, '1024 B');
    assert.equal(photos[0].image.dataset.imageState, 'loaded');
    assert.equal(photos[0].src, 'https://journal.test/images/a1.jpg');
  } finally { f.dispose(); }
});

test('album starts at most two inline loads and holds a slot until the native image finishes', async () => {
  const f = await fixture();
  try {
    const photos = f.renderFirst();
    assert.equal(f.requests.length, 2);
    assert.equal(photos.filter(photo => photo.loading).length, 2);
    f.requests[0].resolve({ src: 'blob:a1', sizeBytes: 1024 });
    await flush();
    assert.equal(f.requests.length, 2);
    imageEvent(photos[0]);
    assert.equal(f.requests.length, 3);
    assert.equal(photos.filter(photo => photo.loading).length, 2);
    f.requests[1].reject(new Error('offline'));
    await flush();
    assert.equal(f.requests.length, 4);
    assert.equal(photos.filter(photo => photo.loading).length, 2);
    assert.equal(photos[1].image.dataset.imageState, 'error');
    f.requests[2].resolve({ src: 'blob:a3', sizeBytes: 3072 });
    await flush();
    imageEvent(photos[2]);
    assert.equal(f.requests.length, 5);
    assert.equal(photos.filter(photo => photo.loading).length, 2);
  } finally { f.dispose(); }
});

test('switching cities and hiding releases leases after removing sources and ignores stale results and progress', async () => {
  const f = await fixture({ firstCount: 2 });
  try {
    const oldPhotos = f.renderFirst();
    f.requests[0].resolve({ src: 'blob:old-a1', sizeBytes: 8192 });
    const newPhotos = f.album.render(f.places[1]);
    assert.equal(f.requests[0].releases, 1);
    assert.equal(f.requests[1].releases, 1);
    assert.equal(f.requests[0].sourceAtRelease, null);
    const previousProgress = oldPhotos[0].progress.textContent;
    f.requests[0].options.onProgress({ total: 8192, percent: 90 });
    f.requests[1].reject(new Error('stale failure'));
    await flush();
    assert.equal(oldPhotos[0].image.getAttribute('src'), null);
    assert.equal(oldPhotos[0].sizeBytes, 1024);
    assert.equal(oldPhotos[0].progress.textContent, previousProgress);
    assert.equal(oldPhotos[1].button.classList.contains('is-unavailable'), false);
    f.requests[2].resolve({ src: 'blob:new-b1', sizeBytes: 1024 });
    await flush();
    assert.equal(newPhotos[0].image.src, 'blob:new-b1');
    f.album.hide();
    assert.equal(f.requests[2].releases, 1);
    assert.equal(f.requests[3].releases, 1);
    assert.equal(f.requests[2].sourceAtRelease, null);
    assert.equal(newPhotos[0].image.getAttribute('src'), null);
    const hiddenProgress = newPhotos[1].progress.textContent;
    f.requests[3].options.onProgress({ total: 2048, percent: 75 });
    f.requests[3].resolve({ src: 'blob:hidden-b2', sizeBytes: 2048 });
    await flush();
    assert.equal(newPhotos[1].image.getAttribute('src'), null);
    assert.equal(newPhotos[1].progress.textContent, hiddenProgress);
    assert.equal(f.root.querySelector('#travelDetails').hidden, true);
  } finally { f.dispose(); }
});

test('retryLoad acquires the album lease and waits for its resource instead of copying a viewer source', async () => {
  const f = await fixture({ firstCount: 1 });
  try {
    const [photo] = f.renderFirst();
    f.requests[0].reject(new Error('offline'));
    await flush();
    assert.equal(photo.button.classList.contains('is-unavailable'), true);
    assert.equal(f.requests[0].releases, 1);
    photo.retryLoad();
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].src, 'https://journal.test/images/a1.jpg');
    assert.equal(photo.image.getAttribute('src'), null);
    assert.equal(photo.button.classList.contains('is-unavailable'), false);
    f.requests[1].resolve({ src: 'blob:album-owned-source', sizeBytes: 1024 });
    await flush();
    assert.equal(photo.image.src, 'blob:album-owned-source');
    assert.equal(photo.src, 'https://journal.test/images/a1.jpg');
    imageEvent(photo);
    f.album.hide();
    assert.equal(f.requests[1].releases, 1);
    assert.equal(f.requests[1].sourceAtRelease, null);
  } finally { f.dispose(); }
});

test('a loader native fallback preserves indeterminate progress until the image actually loads', async () => {
  const f = await fixture({ firstCount: 1 });
  try {
    const [photo] = f.renderFirst();
    assert.equal(photo.progress.textContent, '加载中…');
    f.requests[0].resolve({ src: photo.src, sizeBytes: 1024 });
    await flush();
    assert.equal(photo.progress.textContent, '加载中…');
    assert.equal(photo.loading, true);
    assert.equal(photo.image.getAttribute('aria-busy'), 'true');
    imageEvent(photo);
    assert.equal(photo.progress.hidden, true);
    assert.equal(photo.loading, false);
  } finally { f.dispose(); }
});

test('without an injected loader native loading retains file size and does not invent a percentage', async () => {
  const f = await fixture({ firstCount: 1, native: true });
  try {
    const [photo] = f.renderFirst();
    assert.equal(photo.fileSize.textContent, '1024 B');
    assert.equal(photo.progress.textContent, '加载中…');
    assert.equal(photo.image.src, 'https://journal.test/images/a1.jpg');
    imageEvent(photo);
    assert.equal(photo.progress.hidden, true);
    assert.equal(photo.fileSize.textContent, '1024 B');
  } finally { f.dispose(); }
});
