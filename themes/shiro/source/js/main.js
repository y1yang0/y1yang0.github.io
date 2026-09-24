document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const themeToggle = document.getElementById('themeToggle');
    const themePicker = document.getElementById('themePicker');
    const themeMenu = document.getElementById('themeMenu');
    const themeOptions = Array.from(document.querySelectorAll('[data-theme-choice]'));
    const themeNames = { warm: '暖', dark: '黑', white: '白' };
    const validTheme = value => Object.hasOwn(themeNames, value);
    function applyTheme(value) {
        const theme = validTheme(value) ? value : 'warm';
        root.dataset.theme = theme;
        root.classList.toggle('dark', theme === 'dark');
        if (themeToggle) {
            const label = `切换主题 · ${themeNames[theme]}`;
            themeToggle.setAttribute('aria-label', label);
            themeToggle.setAttribute('title', label);
        }
        themeOptions.forEach(option => option.setAttribute('aria-checked', String(option.dataset.themeChoice === theme)));
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim());
    }
    function closeThemeMenu(restoreFocus = false) {
        if (!themeMenu || themeMenu.hidden) return;
        themeMenu.hidden = true;
        themeToggle?.setAttribute('aria-expanded', 'false');
        if (restoreFocus) themeToggle?.focus({ preventScroll: true });
    }
    function openThemeMenu(index = themeOptions.findIndex(option => option.dataset.themeChoice === root.dataset.theme)) {
        if (!themeMenu) return;
        themeMenu.hidden = false;
        themeToggle?.setAttribute('aria-expanded', 'true');
        themeOptions[Math.max(0, index)]?.focus({ preventScroll: true });
    }
    applyTheme(root.dataset.theme);
    themeToggle?.addEventListener('click', () => themeMenu?.hidden ? openThemeMenu() : closeThemeMenu());
    themeToggle?.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openThemeMenu(event.key === 'ArrowDown' ? 0 : themeOptions.length - 1);
    });
    themeOptions.forEach(option => option.addEventListener('click', () => {
        const theme = option.dataset.themeChoice;
        applyTheme(theme);
        try {
            localStorage.setItem('shiro-theme', theme);
            localStorage.removeItem('shiro-dark-mode');
        } catch (_) {}
        closeThemeMenu(true);
    }));
    themeMenu?.addEventListener('keydown', event => {
        const index = themeOptions.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % themeOptions.length;
        if (event.key === 'ArrowUp') next = (index + themeOptions.length - 1) % themeOptions.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = themeOptions.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            themeOptions[next]?.focus({ preventScroll: true });
        }
    });
    themePicker?.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !themeMenu?.hidden) {
            event.preventDefault();
            event.stopPropagation();
            closeThemeMenu(true);
        }
    });
    themePicker?.addEventListener('focusout', event => {
        if (!themePicker.contains(event.relatedTarget)) closeThemeMenu();
    });
    document.addEventListener('click', event => {
        if (!themePicker?.contains(event.target)) closeThemeMenu();
    });
    window.addEventListener('storage', event => {
        if (event.key === 'shiro-theme' || event.key === null) applyTheme(event.newValue);
    });

    // Keep archive rows equal without reserving two title lines on every screen.
    document.querySelectorAll('.archive-list').forEach(list => {
        const entries = [...list.querySelectorAll('.archive-entry')];
        if (!entries.length) return;
        const titles = entries.map(entry => entry.querySelector('h3'));
        let previousHeight = 0;
        function sizeArchiveRows() {
            const style = getComputedStyle(entries[0]);
            const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
            const titleHeight = Math.max(...titles.map(title => title.getBoundingClientRect().height));
            const stacked = window.matchMedia('(max-width:720px)').matches;
            const contentHeight = stacked ? titleHeight + 18 + parseFloat(style.rowGap) : Math.max(40, titleHeight);
            const height = Math.ceil(Math.max(stacked ? 0 : 72, contentHeight + padding));
            if (height === previousHeight) return;
            list.style.setProperty('--archive-row-height', `${height}px`);
            previousHeight = height;
        }
        const observer = new ResizeObserver(sizeArchiveRows);
        titles.forEach(title => observer.observe(title));
        sizeArchiveRows();
    });

    const getCode = pre => {
        if (!pre) return '';
        const lines = pre.querySelectorAll('.line');
        if (lines.length) return Array.from(lines, line => line.textContent).join('\n');
        const clone = pre.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        return clone.textContent;
    };
    const copyTimers = new WeakMap();
    const copyStatus = document.createElement('span');
    copyStatus.className = 'visually-hidden';
    copyStatus.setAttribute('role', 'status');
    document.body.append(copyStatus);
    async function copyText(text, button, success = 'Copied') {
        const icon = button.dataset.copyIcon;
        const original = icon || button.textContent;
        clearTimeout(copyTimers.get(button));
        const restore = () => {
            button.textContent = original;
            button.classList.remove('copied');
            copyStatus.textContent = '';
        };
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = icon ? '✓' : success;
            button.classList.add('copied');
            copyStatus.textContent = `${success} to clipboard`;
            copyTimers.set(button, setTimeout(restore, 1800));
            return true;
        } catch (_) {
            button.textContent = icon ? '!' : 'Copy failed';
            copyStatus.textContent = 'Copy failed. Select and copy the text manually.';
            copyTimers.set(button, setTimeout(restore, 2000));
            return false;
        }
    }
    const scrollRegions = new Map();
    const updateScrollRegion = scroll => {
        const {frame, label} = scrollRegions.get(scroll);
        const overflow = scroll.scrollWidth > scroll.clientWidth + 1;
        if (overflow) {
            scroll.tabIndex = 0;
            scroll.setAttribute('role', 'region');
            scroll.setAttribute('aria-label', `${label}, scroll horizontally for more`);
        } else {
            scroll.removeAttribute('tabindex');
            scroll.removeAttribute('role');
            scroll.removeAttribute('aria-label');
        }
        frame.classList.toggle('can-scroll-left', overflow && scroll.scrollLeft > 1);
        frame.classList.toggle('can-scroll-right', overflow && scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1);
    };
    const scrollObserver = new ResizeObserver(entries => {
        entries.forEach(({target}) => updateScrollRegion(scrollRegions.has(target) ? target : target.parentElement));
    });
    const watchScroll = (scroll, frame, label) => {
        scrollRegions.set(scroll, {frame, label});
        scroll.addEventListener('scroll', () => updateScrollRegion(scroll), {passive:true});
        scrollObserver.observe(scroll);
        scrollObserver.observe(scroll.firstElementChild);
        updateScrollRegion(scroll);
    };
    document.querySelectorAll('.prose-shiro .highlight').forEach(block => {
        const table = block.querySelector('table');
        if (table) {
            const scroll = document.createElement('div');
            scroll.className = 'highlight-scroll';
            table.before(scroll);
            scroll.append(table);
            table.setAttribute('role', 'presentation');
            block.querySelector('.gutter')?.setAttribute('aria-hidden', 'true');
            watchScroll(scroll, block, 'Code example');
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-btn';
        button.dataset.copyIcon = '⧉';
        button.textContent = '⧉';
        button.setAttribute('aria-label', 'Copy code');
        button.title = 'Copy code';
        button.addEventListener('click', () => copyText(getCode(block.querySelector('.code pre') || block.querySelector('pre')), button));
        block.append(button);
    });
    document.querySelectorAll('.prose-shiro table').forEach(table => {
        if (table.closest('.highlight')) return;
        const scroll = document.createElement('div');
        scroll.className = 'table-scroll';
        const frame = document.createElement('div');
        frame.className = 'table-frame';
        table.before(frame);
        frame.append(scroll);
        scroll.append(table);
        const columns = [...(table.rows[0]?.cells || [])].reduce((n, cell) => n + cell.colSpan, 0);
        if (columns > 3) table.style.setProperty('--table-min-width', `${columns * 104}px`);
        const rows = [...table.tBodies].flatMap(body => [...body.rows]);
        const simple = [...table.rows].every(row => row.cells.length === columns && [...row.cells].every(cell => cell.colSpan === 1 && cell.rowSpan === 1));
        if (simple) {
            for (let column = 0; column < columns; column++) {
                const cells = rows.map(row => row.cells[column]);
                if (cells.length && cells.every(cell => /^[+−-]?(?:\d[\d,]*\.?\d*|\.\d+)%?$/.test(cell.textContent.trim()))) {
                    [...table.rows].forEach(row => row.cells[column].classList.add('numeric'));
                }
            }
        }
        table.querySelectorAll('thead th').forEach(th => { if (!th.hasAttribute('scope')) th.setAttribute('scope', 'col'); });
        const caption = frame.nextElementSibling;
        if (caption?.matches('p[align="center"]') && /^Table\s*\d/i.test(caption.textContent.trim())) caption.classList.add('media-caption');
        watchScroll(scroll, frame, 'Data table');
    });

    const tocButton = document.getElementById('tocFab');
    const tocDialog = document.getElementById('tocPanel');
    function revealTocLocation(container) {
        const link = container?.querySelector('a.toc-active');
        if (!link || !container.getClientRects().length) return;
        const bounds = container.getBoundingClientRect();
        const heading = container.querySelector('.eyebrow,.toc-dialog-heading');
        const top = (heading?.getBoundingClientRect().bottom || bounds.top) + 10;
        const bottom = bounds.bottom - 12;
        const item = link.getBoundingClientRect();
        if (item.top < top) container.scrollTop += item.top - top;
        else if (item.bottom > bottom) container.scrollTop += item.bottom - bottom;
    }
    const closeToc = () => tocDialog?.close();
    tocButton?.addEventListener('click', () => {
        tocDialog.showModal();
        tocButton.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => revealTocLocation(tocDialog));
    });
    document.getElementById('tocClose')?.addEventListener('click', closeToc);
    tocDialog?.addEventListener('close', () => tocButton?.setAttribute('aria-expanded', 'false'));
    tocDialog?.addEventListener('click', event => {
        if (event.target === tocDialog) {
            const rect = tocDialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeToc();
        }
    });
    document.querySelectorAll('.toc a').forEach(link => link.addEventListener('click', () => { if (tocDialog?.open) closeToc(); }));
    document.getElementById('toTopBtn')?.addEventListener('click', () => window.scrollTo({top: 0, behavior: reducedMotion ? 'instant' : 'smooth'}));

    const progress = document.getElementById('readingProgress');
    const header = document.querySelector('.site-header');
    const article = document.querySelector('.post-page .prose-shiro');
    const headings = article ? [...article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')] : [];
    const tocLinks = [...document.querySelectorAll('.toc a')];
    const tocIndex = document.querySelector('.article-index');
    const readingTools = document.querySelector('.reading-tools');
    function alignReadingTools() {
        if (!readingTools) return;
        const hasVisibleIndex = !!tocIndex?.offsetWidth;
        readingTools.classList.toggle('align-with-index', hasVisibleIndex);
        if (!hasVisibleIndex) {
            tocDialog?.style.removeProperty('right');
            return;
        }
        // Follow the index text edge, including its border and inner padding.
        const left = tocIndex.getBoundingClientRect().left + tocIndex.clientLeft + parseFloat(getComputedStyle(tocIndex).paddingLeft);
        readingTools.style.setProperty('--tools-left', `${left}px`);
        tocDialog?.style.setProperty('right', `${document.documentElement.clientWidth - left - readingTools.offsetWidth}px`);
    }
    let previousHeading = '';
    let previousIndexHeight = -1;
    function updateReading() {
        const readingTop = (header?.getBoundingClientRect().bottom || 0) + 24;
        const articleBounds = article?.getBoundingClientRect();
        let indexResized = false;
        if (tocIndex?.offsetWidth && articleBounds) {
            const indexTop = Math.max(parseFloat(getComputedStyle(tocIndex).top), tocIndex.getBoundingClientRect().top);
            // Shrink the index near the article's end instead of pushing its
            // heading behind the sticky site header above the next-note links.
            const indexBottom = readingTools?.classList.contains('align-with-index') ? readingTools.getBoundingClientRect().top - 16 : innerHeight - 40;
            const height = Math.max(0, Math.floor(Math.min(indexBottom, articleBounds.bottom) - indexTop));
            if (height !== previousIndexHeight) {
                tocIndex.style.maxHeight = `${height}px`;
                previousIndexHeight = height;
                indexResized = true;
            }
        }
        if (progress && article) {
            const start = articleBounds.top + window.scrollY - readingTop;
            const end = articleBounds.bottom + window.scrollY - window.innerHeight;
            const fraction = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start)));
            progress.style.transform = `scaleX(${fraction})`;
        }
        let active = '';
        headings.forEach(heading => { if (heading.getBoundingClientRect().top <= readingTop + 12) active = heading.id; });
        if (headings.length && articleBounds.bottom <= window.innerHeight + 1) {
            active = headings[headings.length - 1].id;
        }
        tocLinks.forEach(link => {
            let target;
            try { target = decodeURIComponent(link.hash.slice(1)); } catch (_) { target = link.hash.slice(1); }
            const selected = !!active && target === active;
            link.classList.toggle('toc-active', selected);
            if (selected) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
        if (active !== previousHeading || indexResized) {
            // Follow reading progress without fighting someone browsing the index.
            if (tocIndex && !tocIndex.matches(':hover') && !tocIndex.contains(document.activeElement)) revealTocLocation(tocIndex);
            previousHeading = active;
        }
    }
    if (article) {
        let scheduled = false;
        window.addEventListener('scroll', () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { updateReading(); scheduled = false; });
        }, {passive: true});
        window.addEventListener('resize', () => {
            alignReadingTools();
            updateReading();
            revealTocLocation(tocIndex);
        }, {passive: true});
        window.addEventListener('load', () => {
            alignReadingTools();
            updateReading();
        });
        alignReadingTools();
        updateReading();
    }

    // Copy the article without line numbers or UI labels.
    function extractArticle() {
        if (!article) return '';
        const clone = article.cloneNode(true);
        clone.querySelectorAll('.highlight').forEach(block => {
            const pre = block.querySelector('.code pre') || block.querySelector('pre');
            block.replaceWith(document.createTextNode(`\n\n\`\`\`\n${getCode(pre)}\n\`\`\`\n\n`));
        });
        clone.querySelectorAll('pre').forEach(pre => pre.replaceWith(document.createTextNode(`\n\n\`\`\`\n${getCode(pre)}\n\`\`\`\n\n`)));
        clone.querySelectorAll('button,.gutter').forEach(node => node.remove());
        clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => h.replaceWith(document.createTextNode(`\n\n${'#'.repeat(Number(h.tagName[1]))} ${h.textContent}\n\n`)));
        clone.querySelectorAll('table').forEach(table => {
            const rows = [...table.rows].map(row => '| ' + [...row.cells].map(cell => cell.textContent.trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
            if (rows.length) rows.splice(1, 0, '| ' + [...table.rows[0].cells].map(() => '---').join(' | ') + ' |');
            table.replaceWith(document.createTextNode('\n\n' + rows.join('\n') + '\n\n'));
        });
        clone.querySelectorAll('li').forEach(li => li.prepend(document.createTextNode('\n- ')));
        clone.querySelectorAll('p').forEach(p => {p.prepend('\n');p.append('\n');});
        return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
    }
    const copyArticle = document.getElementById('copyArticleBtn');
    copyArticle?.addEventListener('click', () => copyText(extractArticle(), copyArticle));
});
