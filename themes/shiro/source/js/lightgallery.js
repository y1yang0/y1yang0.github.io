document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.prose-shiro');
    if (!containers.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const escapeHtml = (value) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getCaption = (img) => {
        const paragraph = img.closest('p');
        const next = paragraph?.nextElementSibling;
        const explicit = next?.matches('p[align="center"]') && /^Fig(?:ure)?\s*\d/i.test(next.textContent.trim()) ? next : null;
        if (explicit) explicit.classList.add('media-caption');
        const caption = explicit?.textContent.trim() || img.getAttribute('title') || img.getAttribute('alt') || '';
        return /^(image|img|图片)$/i.test(caption.trim()) ? '' : caption;
    };

    const setCaption = (link, caption) => {
        if (!caption) {
            link.removeAttribute('data-sub-html');
            return;
        }
        link.setAttribute('data-sub-html', `<p>${escapeHtml(caption)}</p>`);
    };

    const ensureLink = (container, img) => {
        const src = img.currentSrc || img.src;
        if (!src) return null;

        const existing = img.closest('a');
        // An illustration that links to another page should keep that destination.
        if (existing && existing.href && existing.href !== src && !existing.hasAttribute('data-lg-item')) return null;
        const link = existing && container.contains(existing) ? existing : document.createElement('a');

        if (!link.contains(img)) {
            img.parentNode.insertBefore(link, img);
            link.appendChild(img);
        }

        link.setAttribute('href', src);
        link.setAttribute('data-lg-item', 'true');
        setCaption(link, getCaption(img));
        return link;
    };

    containers.forEach((container) => {
        const images = container.querySelectorAll('img');
        if (!images.length) return;

        images.forEach((img, index) => {
            const link = ensureLink(container, img);
            if (!link) return;
            const caption = getCaption(img);
            link.setAttribute('aria-label', `${caption ? `${caption}. ` : ''}Enlarge image ${index + 1} of ${images.length}`);
            if (typeof window.lightGallery === 'function') link.setAttribute('aria-haspopup', 'dialog');
        });
        container.querySelectorAll('p').forEach(paragraph => {
            if (!paragraph.textContent.trim() && paragraph.querySelector('a[data-lg-item]') &&
                [...paragraph.children].every(child => child.matches('a[data-lg-item],br'))) paragraph.classList.add('media-block');
        });

        if (typeof window.lightGallery !== 'function') return;
        let trigger = null;
        container.addEventListener('click', event => {
            const link = event.target.closest('a[data-lg-item]');
            if (link) trigger = link;
        }, {capture:true});
        container.addEventListener('lgAfterClose', () => {
            if (trigger?.isConnected) trigger.focus({preventScroll:true});
        });
        window.lightGallery(container, {
            selector: 'a[data-lg-item]',
            plugins: typeof window.lgZoom === 'function' ? [window.lgZoom] : [],
            download: false,
            actualSize: true,
            infiniteZoom: false,
            getCaptionFromTitleOrAlt: false,
            hideScrollbar: true,
            speed: reducedMotion ? 0 : 250,
            backdropDuration: reducedMotion ? 0 : 200,
            startAnimationDuration: reducedMotion ? 0 : 250,
            enableZoomAfter: reducedMotion ? 0 : 250,
            mobileSettings: {controls:true, showCloseIcon:true, download:false}
        });
    });
});
