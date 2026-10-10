export function createPhotoViewer({dialog, onChange = () => {}, onClose = () => {}, focusFallback = null}) {
    const viewer = dialog;
    const viewerImage = viewer.querySelector('#travelViewerImage');
    const viewerCaption = viewer.querySelector('#travelViewerCaption');
    const viewerCounter = viewer.querySelector('#travelViewerCounter');
    const viewerStatus = viewer.querySelector('#travelViewerStatus');
    const viewerRetry = viewer.querySelector('#travelViewerRetry');
    const viewerReset = viewer.querySelector('#travelViewerReset');
    const viewerStage = viewer.querySelector('#travelViewerStage');
    const photoLens = viewer.querySelector('#travelPhotoLens');
    const photoMagnifier = viewer.querySelector('#travelPhotoMagnifier');
    const photoContext = photoMagnifier?.getContext('2d');
    const mouseMagnifier = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const text = value => typeof value === 'string' ? value : '';
    let gallery = [];
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
        onChange(viewerIndex, photo);
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
        (viewerTrigger?.isConnected ? viewerTrigger : focusFallback)?.focus({preventScroll: true});
        viewerImage.removeAttribute('src');
        viewerImage.setAttribute('aria-busy', 'false');
        viewerStatus.textContent = '';
        onClose();
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


    return {
        setPhotos(photos) {
            if (gallery === photos) return;
            if (viewer.open) viewer.close();
            cancelViewerLoad();
            gallery = Array.isArray(photos) ? photos : [];
            viewerIndex = 0;
        },
        open: openViewer,
        close() { if (viewer.open) viewer.close(); },
        get isOpen() { return viewer.open; },
        get index() { return viewerIndex; },
        get photo() { return gallery[viewerIndex] || null; }
    };
}

