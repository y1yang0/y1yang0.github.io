export function createAlbum({root, albums, stats, available = true, places = [], onSelect, onOpenPhoto, imageLoader, formatFileSize = () => ''}) {
    const albumCities = root.querySelector('#travelAlbumCities');
    const details = root.querySelector('#travelDetails');
    const heading = root.querySelector('#travelCityName');
    const entriesNode = root.querySelector('#travelEntries');
    const empty = root.querySelector('#travelEmpty');
    const countryName = root.dataset.countryName || '中国';
    const provinceLevel = root.dataset.mapLevel === 'province';
    const text = value => typeof value === 'string' ? value : '';
    const entries = id => Array.isArray(albums[id]?.entries) ? albums[id].entries.filter(entry => entry && typeof entry === 'object') : [];
    const photos = entry => Array.isArray(entry.photos) ? entry.photos.filter(photo => photo && typeof photo.src === 'string') : [];
    const hasRecord = id => !!stats[id]?.recorded;
    const photoCount = id => stats[id]?.photos || 0;
    const shortName = name => provinceLevel ? text(name) : text(name).replace(/(?:特别行政区|自治州|地区|市)$/u, '');
    const cityDescription = place => `${place.name}${hasRecord(place.id) ? ` · ${photoCount(place.id)} 张照片` : ''}`;
    const make = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };
    const validImage = src => {
        if (!text(src).trim()) return '';
        try {
            const url = new URL(src, document.baseURI);
            return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : '';
        } catch (_) { return ''; }
    };
    let selectedId = '';
    let gallery = [];
    let albumObserver;
    let albumLoadEpoch = 0;
    let albumLoading = 0;
    const albumLoadQueue = [];
    function renderCityControls() {
        const recordedCities = places.filter(city => hasRecord(city.id)).sort((a, b) => photoCount(b.id) - photoCount(a.id));
        albumCities.hidden = !recordedCities.length;
        albumCities.replaceChildren();
        recordedCities.forEach(city => {
            const count = photoCount(city.id);
            const button = make('button', '', `${shortName(city.name)}(${count})`);
            button.type = 'button';
            button.dataset.cityId = city.id;
            button.setAttribute('aria-label', `${shortName(city.name)}，${count} 张照片`);
            button.title = cityDescription(city);
            button.setAttribute('aria-pressed', String(city.id === selectedId));
            button.addEventListener('click', () => onSelect(city.id, {scroll: true, focus: true}));
            albumCities.append(button);
        });
    }
    function clearAlbumLoads() {
        albumLoadEpoch += 1;
        albumObserver?.disconnect();
        albumLoadQueue.length = 0;
        albumLoading = 0;
        gallery.forEach(photo => {
            photo.loading = false;
            photo.queued = false;
            photo.image.removeAttribute('src');
            photo.image.setAttribute('aria-busy', 'false');
            photo.request?.release();
            photo.request = null;
            updatePhotoMeta(photo);
        });
    }
    function updatePhotoMeta(photo, progress = '') {
        photo.fileSize.textContent = formatFileSize(photo.sizeBytes);
        photo.fileSize.hidden = !photo.fileSize.textContent;
        photo.progress.textContent = progress;
        photo.progress.hidden = !progress;
        photo.metadata.hidden = photo.fileSize.hidden && photo.progress.hidden;
    }
    function photoIsCurrent(photo, token = photo.loadToken) {
        return photo.loadEpoch === albumLoadEpoch && token === photo.loadToken && photo.image.isConnected;
    }
    function failPhotoLoad(photo, token = photo.loadToken) {
        if (!photoIsCurrent(photo, token)) return;
        photo.image.removeAttribute('src');
        photo.request?.release();
        photo.request = null;
        photo.image.hidden = true;
        photo.image.setAttribute('aria-busy', 'false');
        photo.image.dataset.imageState = 'error';
        photo.button.classList.add('is-unavailable');
        if (!photo.button.querySelector('.travel-photo-error')) {
            photo.button.append(make('span', 'travel-photo-error', '照片暂时无法载入，点击重试'));
        }
        updatePhotoMeta(photo);
        finishAlbumLoad(photo);
    }
    function finishPhotoLoad(photo) {
        if (!photoIsCurrent(photo) || !photo.image.naturalWidth) return;
        photo.image.style.aspectRatio = photo.button.style.aspectRatio = `${photo.image.naturalWidth} / ${photo.image.naturalHeight}`;
        photo.image.hidden = false;
        photo.image.setAttribute('aria-busy', 'false');
        photo.image.dataset.imageState = 'loaded';
        photo.button.classList.remove('is-unavailable');
        photo.button.querySelector('.travel-photo-error')?.remove();
        updatePhotoMeta(photo);
        finishAlbumLoad(photo);
    }
    function pumpAlbumLoads() {
        while (albumLoading < 2 && albumLoadQueue.length) {
            const photo = albumLoadQueue.shift();
            photo.queued = false;
            if (!photo.image.isConnected || photo.image.hasAttribute('src')) continue;
            photo.loading = true;
            photo.loadEpoch = albumLoadEpoch;
            const token = photo.loadToken = (photo.loadToken || 0) + 1;
            albumLoading += 1;
            photo.image.loading = 'eager';
            photo.image.setAttribute('aria-busy', 'true');
            photo.image.dataset.imageState = 'loading';
            updatePhotoMeta(photo, '加载中…');
            if (!imageLoader) { photo.image.src = photo.src; continue; }
            const request = imageLoader.load(photo.src, {
                sizeBytes: photo.sizeBytes,
                onProgress: ({percent}) => {
                    if (!photoIsCurrent(photo, token) || !photo.loading) return;
                    updatePhotoMeta(photo, Number.isFinite(percent) ? `加载 ${percent}%` : '加载中…');
                }
            });
            photo.request = request;
            request.promise.then(resource => {
                if (!photoIsCurrent(photo, token)) return;
                if (resource.sizeBytes > 0) photo.sizeBytes = resource.sizeBytes;
                updatePhotoMeta(photo, photo.progress.textContent || '加载中…');
                photo.image.src = resource.src;
                if (photo.image.complete && photo.image.naturalWidth) finishPhotoLoad(photo);
            }).catch(error => {
                if (error?.name !== 'AbortError') failPhotoLoad(photo, token);
            });
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
    function retryPhoto(photo) {
        if (!photoIsCurrent(photo) || photo.loading || photo.queued) return;
        photo.image.removeAttribute('src');
        photo.request?.release();
        photo.request = null;
        photo.image.hidden = false;
        photo.button.classList.remove('is-unavailable');
        photo.button.querySelector('.travel-photo-error')?.remove();
        queueAlbumPhoto(photo);
    }
    function renderEntries(city) {
        clearAlbumLoads();
        gallery = [];
        const notes = entries(city.id);
        entriesNode.replaceChildren();
        entriesNode.hidden = !notes.length;
        empty.hidden = !!notes.length;
        if (!available) empty.querySelector('p').textContent = '旅行记录暂时无法读取，请刷新页面后再试。';
        document.getElementById('travelActiveProvince').textContent = provinceLevel ? countryName : city.province || countryName;
        heading.textContent = shortName(city.name);
        const count = photoCount(city.id);
        document.getElementById('travelCityMeta').textContent = !available ? '旅行记录暂时无法读取' : notes.length
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
                const caption = make('figcaption');
                if (text(photo.caption)) caption.append(document.createTextNode(photo.caption));
                const metadata = make('span', 'image-file-meta');
                if (!text(photo.caption)) metadata.classList.add('image-file-meta-standalone');
                const fileSize = make('span', 'image-file-size');
                const progress = make('span', 'image-load-progress');
                metadata.append(fileSize, progress);
                caption.append(metadata);
                const item = {...photo, src, alt, image, button, metadata, fileSize, progress};
                item.retryLoad = () => retryPhoto(item);
                updatePhotoMeta(item);
                gallery.push(item);
                button.addEventListener('click', () => onOpenPhoto(index, button, {retry: button.classList.contains('is-unavailable')}));
                image.addEventListener('load', () => {
                    finishPhotoLoad(item);
                });
                image.addEventListener('error', () => {
                    if (!image.complete || image.naturalWidth > 0) return;
                    failPhotoLoad(item);
                });
                button.append(image);
                figure.append(button, caption);
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
        return gallery;
    }

    renderCityControls();
    return {
        render(place) {
            details.hidden = false;
            selectedId = place.id;
            const items = renderEntries(place);
            renderCityControls();
            return items;
        },
        hide() {
            clearAlbumLoads();
            gallery = [];
            selectedId = '';
            details.hidden = true;
            renderCityControls();
        },
        setPlaces(nextPlaces) {
            places = nextPlaces;
            renderCityControls();
        },
        get photos() { return gallery; },
        get heading() { return heading; }
    };
}

