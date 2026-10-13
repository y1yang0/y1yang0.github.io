const knownBytes = value => Number.isFinite(value) && value > 0 ? value : 0;

export function formatFileSize(bytes) {
    if (!knownBytes(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const amount = bytes / (1024 ** Math.max(0, unit));
    return `${unit <= 0 ? Math.round(amount) : Number(amount.toFixed(1))} ${units[Math.max(0, unit)]}`;
}

// Leases keep an album image and its viewer on the same download and blob URL.
export function createImageLoader({host = globalThis} = {}) {
    const current = new Map();
    const entries = new Set();
    let retryId = 0;
    let disposed = false;
    const URLConstructor = typeof host.URL === 'function' ? host.URL : URL;
    const objectURLs = host.URL;
    const abortError = () => {
        const error = new Error('Image download cancelled');
        error.name = 'AbortError';
        return error;
    };
    function resolveSource(src) {
        const original = typeof src === 'string' ? src : '';
        try {
            const url = new URLConstructor(original, host.document?.baseURI || host.location?.href);
            const origin = host.location?.origin || new URLConstructor(host.location?.href).origin;
            return {originalSrc: url.href, url, sameOrigin: ['http:', 'https:'].includes(url.protocol) && url.origin === origin};
        } catch (_) {
            return {originalSrc: original, sameOrigin: false};
        }
    }
    function notify(entry) {
        [...entry.leases].forEach(lease => {
            if (!lease.active) return;
            try { lease.onProgress({...entry.progress}); } catch (_) {}
        });
    }
    function updateProgress(entry) {
        const loaded = entry.loaded;
        const usable = total => knownBytes(total) && total >= loaded;
        const total = usable(entry.eventTotal) ? entry.eventTotal
            : entry.identity && usable(entry.headerTotal) ? entry.headerTotal
            : entry.identity && usable(entry.metadataSize) ? entry.metadataSize : 0;
        entry.progress = {loaded, total, percent: total ? Math.min(100, Math.floor(loaded / total * 100)) : null};
        notify(entry);
    }
    function detach(entry) {
        if (!entry.xhr) return;
        for (const name of ['onreadystatechange', 'onprogress', 'onload', 'onerror', 'onabort', 'ontimeout']) entry.xhr[name] = null;
    }
    function finish(entry, error, result) {
        if (entry.status !== 'pending') return;
        entry.status = error ? 'failed' : 'resolved';
        detach(entry);
        entry.xhr = null;
        if (error) entry.reject(error);
        else entry.resolve(result);
    }
    function stop(entry) {
        if (current.get(entry.originalSrc) === entry) current.delete(entry.originalSrc);
        entries.delete(entry);
        if (entry.status === 'pending') {
            const xhr = entry.xhr;
            finish(entry, abortError());
            try { xhr?.abort(); } catch (_) {}
        }
        if (entry.objectURL) {
            try { objectURLs.revokeObjectURL(entry.objectURL); } catch (_) {}
            entry.objectURL = '';
        }
    }
    function start(entry, source, retry) {
        const requestURL = source.url ? new URLConstructor(source.url.href) : null;
        if (retry && requestURL && ['http:', 'https:'].includes(requestURL.protocol)) {
            requestURL.searchParams.set('__image_retry', `${Date.now()}-${++retryId}`);
        }
        if (!source.sameOrigin || typeof host.XMLHttpRequest !== 'function'
            || typeof objectURLs?.createObjectURL !== 'function' || typeof objectURLs?.revokeObjectURL !== 'function') {
            finish(entry, null, {src: requestURL?.href || entry.originalSrc, sizeBytes: entry.metadataSize, originalSrc: entry.originalSrc});
            return;
        }
        try {
            const xhr = entry.xhr = new host.XMLHttpRequest();
            function readHeaders() {
                if (xhr.readyState < 2) return;
                try {
                    const encoding = (xhr.getResponseHeader('Content-Encoding') || '').trim().toLowerCase();
                    const length = (xhr.getResponseHeader('Content-Length') || '').trim();
                    entry.identity = !encoding || encoding === 'identity';
                    entry.headerTotal = /^\d+$/.test(length) ? knownBytes(Number(length)) : 0;
                } catch (_) {
                    entry.identity = false;
                    entry.headerTotal = 0;
                }
            }
            xhr.onreadystatechange = () => {
                if (entry.status !== 'pending') return;
                readHeaders();
                updateProgress(entry);
            };
            xhr.onprogress = event => {
                if (entry.status !== 'pending') return;
                readHeaders();
                entry.loaded = Math.max(entry.loaded, knownBytes(event.loaded));
                if (event.lengthComputable) entry.eventTotal = knownBytes(event.total);
                updateProgress(entry);
            };
            xhr.onload = () => {
                if (entry.status !== 'pending') return;
                if (!(xhr.status >= 200 && xhr.status < 300) && xhr.status !== 304) {
                    finish(entry, new Error(`Image download failed (${xhr.status})`));
                    return;
                }
                const blob = xhr.response;
                if (!blob || !Number.isFinite(blob.size)) {
                    finish(entry, new Error('Image download returned no data'));
                    return;
                }
                try {
                    entry.objectURL = objectURLs.createObjectURL(blob);
                    const sizeBytes = knownBytes(blob.size);
                    const total = knownBytes(entry.eventTotal) && entry.eventTotal >= entry.loaded ? entry.eventTotal : sizeBytes;
                    entry.progress = {loaded: total, total, percent: 100};
                    notify(entry);
                    // A progress listener can release the final lease synchronously.
                    if (entry.status !== 'pending') return;
                    finish(entry, null, {src: entry.objectURL, sizeBytes, originalSrc: entry.originalSrc});
                } catch (error) {
                    finish(entry, error);
                }
            };
            xhr.onerror = () => finish(entry, new Error('Image download failed'));
            xhr.ontimeout = () => finish(entry, new Error('Image download timed out'));
            xhr.onabort = () => finish(entry, abortError());
            xhr.open('GET', requestURL.href, true);
            xhr.responseType = 'blob';
            xhr.send();
        } catch (error) {
            finish(entry, error);
        }
    }
    function load(src, {sizeBytes = 0, onProgress = () => {}, retry = false} = {}) {
        if (disposed) throw new Error('Image loader is disposed');
        const source = resolveSource(src);
        let entry = retry ? null : current.get(source.originalSrc);
        const fresh = !entry;
        if (fresh) {
            entry = {originalSrc: source.originalSrc, metadataSize: knownBytes(sizeBytes), status: 'pending',
                loaded: 0, eventTotal: 0, headerTotal: 0, identity: false, objectURL: '', xhr: null,
                progress: {loaded: 0, total: 0, percent: null}, leases: new Set()};
            entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
            // Cancellation may outlive a disconnected image without a consumer catch.
            entry.promise.catch(() => {});
            current.set(source.originalSrc, entry);
            entries.add(entry);
        } else if (!entry.metadataSize && knownBytes(sizeBytes)) {
            entry.metadataSize = sizeBytes;
            if (entry.status === 'pending') updateProgress(entry);
        }
        const lease = {onProgress: typeof onProgress === 'function' ? onProgress : () => {}, active: true};
        entry.leases.add(lease);
        try { lease.onProgress({...entry.progress}); } catch (_) {}
        if (fresh && lease.active) start(entry, source, retry);
        return {
            promise: entry.promise,
            release() {
                if (!lease.active) return;
                lease.active = false;
                entry.leases.delete(lease);
                if (!entry.leases.size) stop(entry);
            }
        };
    }
    return {
        load,
        dispose() {
            if (disposed) return;
            disposed = true;
            entries.forEach(entry => {
                entry.leases.forEach(lease => { lease.active = false; });
                entry.leases.clear();
                stop(entry);
            });
            current.clear();
        }
    };
}
