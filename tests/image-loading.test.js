const assert = require('node:assert/strict');
const test = require('node:test');
const imageLoading = import('../themes/shiro/source/js/image-loading.mjs');

function createHost(href = 'https://notebook.test/journal/') {
    const requests = [], created = [], revoked = [];
    class HostURL extends URL {
        static createObjectURL(blob) {
            const src = `blob:notebook-${created.length + 1}`;
            created.push({src, blob});
            return src;
        }
        static revokeObjectURL(src) { revoked.push(src); }
    }
    class XMLHttpRequest {
        constructor() {
            this.readyState = 0;
            this.headers = {};
            this.aborts = 0;
            requests.push(this);
        }
        open(method, url, async) { this.method = method; this.url = url; this.async = async; this.readyState = 1; }
        send() { this.sent = true; }
        abort() { this.aborts += 1; this.onabort?.(); }
        getResponseHeader(name) { return this.headers[name.toLowerCase()] ?? null; }
        receiveHeaders(headers = {}) {
            this.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
            this.readyState = 2;
            this.onreadystatechange?.();
        }
        progress(loaded, total = 0, lengthComputable = total > 0) { this.onprogress?.({loaded, total, lengthComputable}); }
        complete(size = 1000, status = 200) {
            this.readyState = 4;
            this.status = status;
            this.response = new Blob([new Uint8Array(size)]);
            this.onload?.();
        }
        fail() { this.onerror?.(); }
    }
    return {location: new URL(href), URL: HostURL, XMLHttpRequest, requests, created, revoked};
}

test('file sizes use readable units and omit unavailable metadata', async () => {
    const {formatFileSize} = await imageLoading;
    assert.equal(formatFileSize(500), '500 B');
    assert.equal(formatFileSize(1024), '1 KB');
    assert.equal(formatFileSize(Math.round(2.4 * 1024 ** 2)), '2.4 MB');
    for (const value of [undefined, null, 0, -1, NaN, Infinity, '1024']) assert.equal(formatFileSize(value), '');
});

test('same-origin downloads report real byte progress and resolve a sized blob URL', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), progress = [];
    const loader = createImageLoader({host});
    const lease = loader.load('/images/photo.jpg', {onProgress: event => progress.push(event)});
    const request = host.requests[0];
    assert.equal(request.method, 'GET');
    assert.equal(request.responseType, 'blob');
    assert.equal(request.url, 'https://notebook.test/images/photo.jpg');
    assert.deepEqual(progress[0], {loaded: 0, total: 0, percent: null});
    request.receiveHeaders({'Content-Length': 1000});
    request.progress(240, 1000);
    assert.deepEqual(progress.at(-1), {loaded: 240, total: 1000, percent: 24});
    request.complete();
    assert.deepEqual(await lease.promise, {src: 'blob:notebook-1', sizeBytes: 1000, originalSrc: request.url});
    assert.deepEqual(progress.at(-1), {loaded: 1000, total: 1000, percent: 100});
    lease.release();
    lease.release();
    assert.deepEqual(host.revoked, ['blob:notebook-1']);
});

test('metadata supplies a denominator only after identity response headers are available', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), progress = [];
    const loader = createImageLoader({host});
    const lease = loader.load('/metadata.jpg', {sizeBytes: 800, onProgress: event => progress.push(event)});
    host.requests[0].progress(80);
    assert.equal(progress.at(-1).percent, null);
    host.requests[0].receiveHeaders();
    assert.deepEqual(progress.at(-1), {loaded: 80, total: 800, percent: 10});
    host.requests[0].progress(880);
    assert.equal(progress.at(-1).percent, null, 'stale metadata must not show a completed download');
    host.requests[0].complete(1000);
    assert.equal((await lease.promise).sizeBytes, 1000);
    lease.release();
});

test('compressed responses ignore file metadata and Content-Length but trust computable event totals', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), progress = [];
    const loader = createImageLoader({host});
    const lease = loader.load('/compressed.svg', {sizeBytes: 2000, onProgress: event => progress.push(event)});
    host.requests[0].receiveHeaders({'Content-Encoding': 'gzip', 'Content-Length': 400});
    host.requests[0].progress(200);
    assert.deepEqual(progress.at(-1), {loaded: 200, total: 0, percent: null});
    host.requests[0].progress(300, 400);
    assert.deepEqual(progress.at(-1), {loaded: 300, total: 400, percent: 75});
    host.requests[0].complete(2000);
    assert.equal((await lease.promise).sizeBytes, 2000);
    assert.deepEqual(progress.at(-1), {loaded: 400, total: 400, percent: 100});
    loader.dispose();
});

test('an unavailable or inconsistent denominator stays unknown until the response completes', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), progress = [];
    const loader = createImageLoader({host});
    const lease = loader.load('/unknown.jpg', {onProgress: event => progress.push(event)});
    host.requests[0].receiveHeaders({'Content-Length': 'invalid'});
    host.requests[0].progress(300);
    assert.deepEqual(progress.at(-1), {loaded: 300, total: 0, percent: null});
    host.requests[0].progress(600, 400);
    assert.deepEqual(progress.at(-1), {loaded: 600, total: 0, percent: null});
    host.requests[0].complete(1000);
    await lease.promise;
    assert.deepEqual(progress.at(-1), {loaded: 1000, total: 1000, percent: 100});
    lease.release();
});

test('coalesced leases replay progress and releasing one keeps the other download alive', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), firstProgress = [], secondProgress = [];
    const loader = createImageLoader({host});
    const first = loader.load('/shared.jpg', {onProgress: event => firstProgress.push(event)});
    host.requests[0].progress(300, 1000);
    const second = loader.load('https://notebook.test/shared.jpg', {onProgress: event => secondProgress.push(event)});
    assert.equal(host.requests.length, 1);
    assert.equal(first.promise, second.promise);
    assert.deepEqual(secondProgress[0], {loaded: 300, total: 1000, percent: 30});
    first.release();
    host.requests[0].progress(600, 1000);
    assert.equal(firstProgress.at(-1).percent, 30);
    assert.equal(secondProgress.at(-1).percent, 60);
    assert.equal(host.requests[0].aborts, 0);
    host.requests[0].complete();
    const result = await second.promise;
    const third = loader.load('/shared.jpg');
    assert.deepEqual(await third.promise, result);
    second.release();
    assert.deepEqual(host.revoked, []);
    third.release();
    assert.deepEqual(host.revoked, [result.src]);
});

test('last release aborts pending work and a later lease gets a fresh request', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), loader = createImageLoader({host});
    const lease = loader.load('/cancelled.jpg');
    lease.release();
    assert.equal(host.requests[0].aborts, 1);
    await assert.rejects(lease.promise, {name: 'AbortError'});
    const next = loader.load('/cancelled.jpg');
    assert.equal(host.requests.length, 2);
    host.requests[1].complete();
    await next.promise;
    next.release();
});

test('foreign, file, and unavailable-XHR sources fall back without fabricated progress', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), loader = createImageLoader({host});
    for (const src of ['https://photos.test/a.jpg', 'file:///photos/a.jpg', 'data:image/png;base64,AA==']) {
        const progress = [];
        const lease = loader.load(src, {sizeBytes: 50, onProgress: event => progress.push(event)});
        assert.deepEqual(await lease.promise, {src, sizeBytes: 50, originalSrc: src});
        assert.deepEqual(progress, [{loaded: 0, total: 0, percent: null}]);
        lease.release();
    }
    assert.equal(host.requests.length, 0);
    const nativeHost = createHost();
    delete nativeHost.XMLHttpRequest;
    const native = createImageLoader({host: nativeHost}).load('/native.jpg');
    assert.equal((await native.promise).src, 'https://notebook.test/native.jpg');
    native.release();
});

test('native HTTP retries bust the request cache while file and data sources stay intact', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost();
    delete host.XMLHttpRequest;
    const loader = createImageLoader({host});
    for (const originalSrc of ['https://photos.test/a.jpg?token=original', 'https://notebook.test/a.jpg']) {
        const progress = [];
        const lease = loader.load(originalSrc, {retry: true, onProgress: event => progress.push(event)});
        const result = await lease.promise;
        assert.equal(result.originalSrc, originalSrc);
        assert.ok(new URL(result.src).searchParams.get('__image_retry'));
        assert.equal(new URL(result.src).searchParams.get('token'), new URL(originalSrc).searchParams.get('token'));
        assert.equal(progress.at(-1).percent, null);
        lease.release();
    }
    for (const originalSrc of ['file:///photos/a.jpg', 'data:image/png;base64,AA==']) {
        const lease = loader.load(originalSrc, {retry: true});
        assert.equal((await lease.promise).src, originalSrc);
        lease.release();
    }
});

test('retry bypasses failed or resolved entries while keeping older leased URLs valid', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), loader = createImageLoader({host});
    const failed = loader.load('/retry.jpg?original=1');
    host.requests[0].fail();
    await assert.rejects(failed.promise, /Image download failed/);
    const retry = loader.load('/retry.jpg?original=1', {retry: true});
    const retryURL = new URL(host.requests[1].url);
    assert.equal(retryURL.searchParams.get('original'), '1');
    assert.ok(retryURL.searchParams.get('__image_retry'));
    host.requests[1].complete(100);
    const oldResult = await retry.promise;
    const refresh = loader.load('/retry.jpg?original=1', {retry: true});
    host.requests[2].complete(200);
    const newResult = await refresh.promise;
    assert.notEqual(newResult.src, oldResult.src);
    assert.equal(newResult.originalSrc, 'https://notebook.test/retry.jpg?original=1');
    failed.release();
    retry.release();
    assert.deepEqual(host.revoked, [oldResult.src]);
    const sharedRefresh = loader.load('/retry.jpg?original=1');
    assert.deepEqual(await sharedRefresh.promise, newResult);
    refresh.release();
    sharedRefresh.release();
    assert.deepEqual(host.revoked, [oldResult.src, newResult.src]);
});

test('HTTP failures reject and disposal aborts pending leases and revokes retired retry URLs', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), loader = createImageLoader({host});
    const missing = loader.load('/404.jpg');
    host.requests[0].complete(0, 404);
    await assert.rejects(missing.promise, /404/);
    const old = loader.load('/a.jpg');
    host.requests[1].complete();
    const oldResult = await old.promise;
    const refreshed = loader.load('/a.jpg', {retry: true});
    host.requests[2].complete();
    const newResult = await refreshed.promise;
    const pending = loader.load('/b.jpg');
    loader.dispose();
    await assert.rejects(pending.promise, {name: 'AbortError'});
    assert.equal(host.requests[3].aborts, 1);
    assert.deepEqual(host.revoked, [oldResult.src, newResult.src]);
    for (const lease of [missing, old, refreshed, pending]) lease.release();
    loader.dispose();
    assert.throws(() => loader.load('/after-dispose.jpg'), /disposed/);
});

test('a throwing observer cannot interrupt another lease or prevent request completion', async () => {
    const {createImageLoader} = await imageLoading;
    const host = createHost(), loader = createImageLoader({host}), seen = [];
    const first = loader.load('/observer.jpg', {onProgress() { throw new Error('consumer error'); }});
    const second = loader.load('/observer.jpg', {onProgress: event => seen.push(event)});
    host.requests[0].progress(500, 1000);
    host.requests[0].complete();
    await second.promise;
    assert.equal(seen.at(-1).percent, 100);
    first.release();
    second.release();
});
