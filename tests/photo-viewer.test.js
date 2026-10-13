'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

class Element extends EventTarget {
  constructor(document) {
    super();
    this.ownerDocument = document;
    this.children = [];
    this.attributes = new Map();
    this.style = {};
    this.hidden = false;
    this.complete = true;
    this.naturalWidth = 0;
    this.isConnected = true;
    const classes = new Set();
    this.classList = {
      contains: value => classes.has(value),
      remove: value => classes.delete(value),
      toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); }
    };
    this.decode = () => Promise.resolve();
  }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'src') { this.currentSrc = ''; this.complete = true; this.naturalWidth = 0; }
  }
  set src(value) { this.setAttribute('src', value); this.currentSrc = value; this.complete = false; this.naturalWidth = 0; }
  get src() { return this.getAttribute('src') || ''; }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function fixture() {
  const originalWindow = global.window;
  const originalObserver = global.ResizeObserver;
  global.window = new EventTarget();
  window.matchMedia = () => Object.assign(new EventTarget(), { matches: false });
  global.ResizeObserver = class { observe() {} };
  const document = { createElement: () => new Element(document) };
  const dialog = new Element(document);
  const names = ['travelViewerImage', 'travelViewerCaption', 'travelViewerCounter', 'travelViewerStatus',
    'travelViewerRetry', 'travelViewerReset', 'travelViewerStage'];
  const elements = new Map(names.map(name => [`#${name}`, new Element(document)]));
  for (const action of ['data-close-photo', 'data-prev-photo', 'data-next-photo']) elements.set(`[${action}]`, new Element(document));
  dialog.querySelector = selector => elements.get(selector) || null;
  dialog.querySelectorAll = () => [elements.get('[data-prev-photo]'), elements.get('[data-next-photo]')];
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  const image = elements.get('#travelViewerImage');
  const requests = [];
  const imageLoader = {
    load(src, options) {
      const pending = deferred();
      const request = { src, options, ...pending, releases: 0 };
      requests.push(request);
      return { promise: pending.promise, release() {
        request.releases += 1;
        request.sourceAtRelease = image.getAttribute('src');
        request.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      } };
    }
  };
  const { createPhotoViewer } = await import('../themes/shiro/source/js/travel/photo-viewer.mjs');
  const viewer = createPhotoViewer({ dialog, imageLoader, formatFileSize: bytes => bytes > 0 ? `${bytes} B` : '' });
  const photos = [1, 2].map(index => ({ src: `https://example.test/${index}.jpg`, alt: `alt ${index}`,
    caption: `caption ${index}`, sizeBytes: index * 1024 }));
  viewer.setPhotos(photos);
  const caption = elements.get('#travelViewerCaption');
  return { viewer, photos, image, requests, elements, dialog, caption,
    size: () => caption.children[0].children[0],
    progress: () => caption.children[0].children[1],
    dispose() {
      viewer.close();
      global.window = originalWindow;
      global.ResizeObserver = originalObserver;
    } };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('viewer shows byte progress in the caption until decoding finishes and releases its source after close', async () => {
  const f = await fixture();
  try {
    let recovered = 0;
    f.photos[0].image = new Element(f.dialog.ownerDocument);
    f.photos[0].button = new Element(f.dialog.ownerDocument);
    f.photos[0].retryLoad = () => { recovered += 1; };
    f.viewer.open(0);
    assert.equal(f.elements.get('#travelViewerCounter').textContent, '1 / 2');
    assert.equal(f.caption.text, 'caption 1');
    assert.equal(f.size().textContent, '1024 B');
    // Transport totals may be compressed and must not replace the file size.
    f.requests[0].options.onProgress({ loaded: 256, total: 512, percent: 50 });
    assert.equal(f.progress().textContent, '加载 50%');
    assert.equal(f.size().textContent, '1024 B');
    f.requests[0].resolve({ src: 'blob:first', sizeBytes: 1024, originalSrc: f.photos[0].src });
    await flush();
    assert.equal(f.image.src, 'blob:first');
    const decoded = deferred();
    f.image.decode = () => decoded.promise;
    f.image.complete = true;
    f.image.naturalWidth = 640;
    f.image.dispatchEvent(new Event('load'));
    assert.equal(f.progress().hidden, false);
    assert.equal(f.image.hidden, true);
    decoded.resolve();
    await flush();
    assert.equal(f.progress().hidden, true);
    assert.equal(f.size().textContent, '1024 B');
    assert.equal(f.image.hidden, false);
    assert.equal(f.photos[0].src, 'https://example.test/1.jpg');
    assert.equal(recovered, 1);
    assert.equal(f.requests[0].releases, 0);
    f.viewer.close();
    assert.equal(f.requests[0].releases, 1);
    assert.equal(f.requests[0].sourceAtRelease, null);
  } finally { f.dispose(); }
});

test('navigation ignores the previous download and progress even when that download just completed', async () => {
  const f = await fixture();
  try {
    f.viewer.open(0);
    f.requests[0].resolve({ src: 'blob:stale', sizeBytes: 4096 });
    f.elements.get('[data-next-photo]').dispatchEvent(new Event('click'));
    f.requests[1].options.onProgress({ total: 2048, percent: 25 });
    f.requests[0].options.onProgress({ total: 4096, percent: 100 });
    await flush();
    assert.equal(f.viewer.index, 1);
    assert.equal(f.image.getAttribute('src'), null);
    assert.equal(f.progress().textContent, '加载 25%');
    assert.equal(f.size().textContent, '2048 B');
    assert.equal(f.requests[0].releases, 1);
    f.viewer.close();
    await flush();
    assert.equal(f.requests[1].releases, 1);
    assert.equal(f.elements.get('#travelViewerStatus').textContent, '');
  } finally { f.dispose(); }
});

test('download and decode failures clear progress and retry keeps the original photo URL', async () => {
  const f = await fixture();
  try {
    f.viewer.open(0);
    f.requests[0].reject(new Error('offline'));
    await flush();
    assert.equal(f.elements.get('#travelViewerRetry').hidden, false);
    assert.equal(f.progress().hidden, true);
    assert.equal(f.size().textContent, '1024 B');
    f.elements.get('#travelViewerRetry').dispatchEvent(new Event('click'));
    assert.equal(f.requests[1].options.retry, true);
    assert.equal(f.requests[1].src, 'https://example.test/1.jpg');
    f.requests[1].resolve({ src: 'blob:bad-image', sizeBytes: 2048 });
    await flush();
    f.image.complete = true;
    f.image.naturalWidth = 640;
    f.image.decode = () => Promise.reject(new Error('corrupt image'));
    f.image.dispatchEvent(new Event('load'));
    await flush();
    assert.equal(f.elements.get('#travelViewerRetry').hidden, false);
    assert.equal(f.image.getAttribute('src'), null);
    assert.equal(f.requests[1].sourceAtRelease, null);
    assert.equal(f.progress().hidden, true);
    assert.equal(f.size().textContent, '2048 B');
    assert.equal(f.photos[0].src, 'https://example.test/1.jpg');
  } finally { f.dispose(); }
});
