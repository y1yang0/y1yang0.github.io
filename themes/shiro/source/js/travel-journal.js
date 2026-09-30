document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('travelJournal');
    if (!root) return;

    const svg = document.getElementById('travelMap');
    const canvas = document.getElementById('travelMapCanvas');
    const mapStatus = document.getElementById('travelMapStatus');
    const retry = document.getElementById('travelRetry');
    const tooltip = document.getElementById('travelMapTooltip');
    const search = document.getElementById('travelSearch');
    const cityList = document.getElementById('travelCityList');
    const albumCities = document.getElementById('travelAlbumCities');
    const citySearch = document.getElementById('travelCitySearch');
    const searchResults = document.getElementById('travelSearchResults');
    const searchEmpty = document.getElementById('travelSearchEmpty');
    const details = document.getElementById('travelDetails');
    const heading = document.getElementById('travelCityName');
    const entriesNode = document.getElementById('travelEntries');
    const empty = document.getElementById('travelEmpty');
    const live = document.getElementById('travelStatus');
    const viewer = document.getElementById('travelPhotoViewer');
    const viewerImage = document.getElementById('travelViewerImage');
    const viewerCaption = document.getElementById('travelViewerCaption');
    const viewerCounter = document.getElementById('travelViewerCounter');
    const allCitiesButton = document.getElementById('travelAllCities');
    const svgNS = 'http://www.w3.org/2000/svg';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fallbackCities = [
        ['330100', '杭州市', '浙江省'], ['110000', '北京市', '北京市'],
        ['310000', '上海市', '上海市'], ['510100', '成都市', '四川省'],
        ['320100', '南京市', '江苏省'], ['440100', '广州市', '广东省'],
        ['610100', '西安市', '陕西省'], ['320500', '苏州市', '江苏省'],
        ['500000', '重庆市', '重庆市'], ['350200', '厦门市', '福建省']
    ].map(([id, name, province]) => ({id, name, province}));
    let journal = {cities: {}, defaultCity: '330100'};
    try {
        const parsed = JSON.parse(document.getElementById('travelJournalData')?.textContent || '{}');
        if (parsed && typeof parsed === 'object') journal = {...journal, ...parsed};
    } catch (_) {
        live.textContent = '旅行记录暂时无法读取，仍可浏览城市地图。';
    }
    if (!journal.cities || typeof journal.cities !== 'object') journal.cities = {};

    let cities = [...fallbackCities];
    Object.keys(journal.cities).forEach(id => {
        if (!cities.some(city => city.id === id)) cities.push({id, name: textFallbackName(id), province: ''});
    });
    let cityById = new Map(cities.map(city => [city.id, city]));
    let activeId = '';
    let activeResult = -1;
    let gallery = [];
    let viewerIndex = 0;
    let viewerTrigger = null;
    const authoredBox = svg.viewBox.baseVal;
    let initialBox = [authoredBox.x, authoredBox.y, authoredBox.width, authoredBox.height];
    let view = [...initialBox];
    let mapReady = false;
    let drag = null;
    let suppressClick = false;
    let pendingMapCity = '';
    let viewAnimation = 0;
    let markers;
    let provinceLabels;
    let provinces = [];
    let paths = new Map();
    let heartCityIds = new Set();

    const text = value => typeof value === 'string' ? value : '';
    function textFallbackName(id) {
        const cityName = journal.cities[id]?.name;
        return typeof cityName === 'string' && cityName.trim() ? cityName : `城市 ${id}`;
    }
    const record = id => journal.cities[id] || {};
    const entries = id => Array.isArray(record(id).entries) ? record(id).entries.filter(entry => entry && typeof entry === 'object') : [];
    const photos = entry => Array.isArray(entry.photos) ? entry.photos.filter(photo => photo && typeof photo.src === 'string') : [];
    const hasRecord = id => entries(id).length > 0;
    const shortName = name => text(name).replace(/(?:特别行政区|自治州|地区|市)$/u, '');
    const make = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };
    const svgNode = (tag, attrs) => {
        const node = document.createElementNS(svgNS, tag);
        Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
        return node;
    };
    const validImage = src => {
        try {
            const url = new URL(src, document.baseURI);
            return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : '';
        } catch (_) { return ''; }
    };
    function updateStats() {
        const visited = Object.keys(journal.cities).filter(hasRecord);
        document.getElementById('travelPlaceCount').textContent = String(visited.length);
        const total = Number(journal.totalCities) || (mapReady ? cities.length : 0);
        const coverage = document.getElementById('travelCoverage');
        coverage.textContent = total ? `${(visited.length / total * 100).toLocaleString('en', {maximumFractionDigits: 1})}%` : '—';
        coverage.parentElement.title = `${visited.length} / ${total} 座城市`;
        coverage.parentElement.setAttribute('aria-label', total ? `城市点亮率 ${coverage.textContent}，${visited.length} / ${total} 座城市` : '城市点亮率');
    }
    function renderCityControls() {
        const recordedCities = cities.filter(city => hasRecord(city.id));
        albumCities.hidden = !recordedCities.length;
        albumCities.replaceChildren();
        recordedCities.slice(0, 8).forEach(city => {
            const button = make('button', '', shortName(city.name));
            button.type = 'button';
            button.dataset.cityId = city.id;
            button.setAttribute('aria-pressed', String(city.id === activeId));
            button.addEventListener('click', () => selectCity(city.id, {scroll: true, focus: true}));
            albumCities.append(button);
        });
    }
    function closeSearch() {
        searchResults.hidden = true;
        search.setAttribute('aria-expanded', 'false');
        search.removeAttribute('aria-activedescendant');
        activeResult = -1;
        cityList.querySelectorAll('[role="option"]').forEach(option => option.setAttribute('aria-selected', 'false'));
    }
    function setActiveResult(index, scroll = false) {
        const options = [...cityList.querySelectorAll('[role="option"]')];
        if (!options.length) return;
        activeResult = (index + options.length) % options.length;
        options.forEach((option, i) => option.setAttribute('aria-selected', String(i === activeResult)));
        const option = options[activeResult];
        search.setAttribute('aria-activedescendant', option.id);
        if (scroll) {
            const bounds = cityList.getBoundingClientRect();
            const item = option.getBoundingClientRect();
            if (item.top < bounds.top) cityList.scrollTop -= bounds.top - item.top;
            else if (item.bottom > bounds.bottom) cityList.scrollTop += item.bottom - bounds.bottom;
        }
    }
    function renderSearchResults() {
        const query = search.value.trim().toLocaleLowerCase();
        closeSearch();
        cityList.replaceChildren();
        cityList.scrollTop = 0;
        if (!query) return;
        const matching = cities.filter(city => {
            const aliases = Array.isArray(city.aliases) ? city.aliases.filter(alias => typeof alias === 'string').join(' ') : '';
            return `${city.name} ${shortName(city.name)} ${city.province} ${text(city.pinyin)} ${aliases} ${city.id}`.toLocaleLowerCase().includes(query);
        });
        const rank = city => shortName(city.name).toLocaleLowerCase() === query ? 0 : city.name.toLocaleLowerCase().startsWith(query) ? 1 : hasRecord(city.id) ? 2 : 3;
        matching.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'zh-CN'));
        matching.forEach(city => {
            const option = make('button', 'travel-city-option');
            option.type = 'button';
            option.tabIndex = -1;
            option.id = `travelSearchOption-${city.id}`;
            option.dataset.cityId = city.id;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.title = city.name;
            option.addEventListener('pointerdown', event => event.preventDefault());
            option.append(make('span', '', shortName(city.name)));
            if (city.province && city.province !== city.name) option.append(make('small', '', city.province));
            option.addEventListener('click', () => selectCity(city.id, {scroll: true, focus: true}));
            cityList.append(option);
        });
        cityList.hidden = !matching.length;
        searchEmpty.hidden = !!matching.length;
        searchResults.hidden = false;
        search.setAttribute('aria-expanded', 'true');
        if (matching.length) setActiveResult(0);
    }
    function renderEntries(city) {
        gallery = [];
        const notes = entries(city.id);
        entriesNode.replaceChildren();
        entriesNode.hidden = !notes.length;
        empty.hidden = !!notes.length;
        document.getElementById('travelActiveProvince').textContent = city.province || '中国';
        heading.textContent = shortName(city.name);
        const photoCount = notes.reduce((sum, entry) => sum + photos(entry).length, 0);
        document.getElementById('travelCityMeta').textContent = notes.length
            ? (photoCount ? `${photoCount} 张照片` : `${notes.length} 次记录`)
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
                const index = gallery.length;
                gallery.push({...photo, src, alt});
                button.addEventListener('click', () => openViewer(index, button));
                image.addEventListener('error', () => {
                    image.hidden = true;
                    button.disabled = true;
                    button.classList.add('is-unavailable');
                    button.append(make('span', 'travel-photo-error', '照片暂时无法载入'));
                }, {once: true});
                image.src = src;
                button.append(image);
                figure.append(button);
                if (text(photo.caption)) figure.append(make('figcaption', '', photo.caption));
                grid.append(figure);
            });
            if (grid.childElementCount) article.append(grid);
            entriesNode.append(article);
        });
    }
    function renderMarkers() {
        if (!markers) return;
        const matrix = svg.getScreenCTM();
        const scale = matrix ? Math.max(.01, Math.hypot(matrix.a, matrix.b)) : 1;
        markers.replaceChildren();
        const selected = root.dataset.view === 'album' ? cityById.get(activeId) : null;
        const visible = [...heartCityIds].map(id => cityById.get(id)).filter(Boolean);
        if (selected && !heartCityIds.has(selected.id)) visible.push(selected);
        visible.forEach(city => {
            if (!Array.isArray(city.center)) return;
            const [cx, cy] = city.center;
            const group = svgNode('g', {'data-city-id': city.id, 'class': 'travel-map-pin'});
            if (heartCityIds.has(city.id)) {
                group.append(svgNode('use', {href: '#travelMapHeart', transform: `translate(${cx} ${cy}) scale(${1 / scale})`, 'class': 'travel-map-heart'}));
            } else {
                group.append(svgNode('circle', {cx, cy, r: 5 / scale, 'class': 'travel-map-marker'}));
            }
            if (selected?.id === city.id) {
                const alignLeft = cx > view[0] + view[2] * .8;
                const label = svgNode('text', {x: cx + (alignLeft ? -10 : 10) / scale, y: cy + 4 / scale, 'class': 'travel-map-label', 'text-anchor': alignLeft ? 'end' : 'start'});
                label.style.fontSize = `${13 / scale}px`;
                label.style.strokeWidth = `${3 / scale}px`;
                label.textContent = shortName(city.name);
                group.append(label);
            }
            markers.append(group);
        });
        renderProvinceLabels(scale);
        const insetLabel = canvas.querySelector('.travel-map-inset-label');
        if (insetLabel) {
            const insetMatrix = insetLabel.getScreenCTM();
            const insetScale = insetMatrix ? Math.max(.01, Math.hypot(insetMatrix.a, insetMatrix.b)) : scale;
            const insetWidth = insetLabel.ownerSVGElement.viewBox.baseVal.width;
            insetLabel.style.fontSize = `${Math.min(11 / insetScale, insetWidth * .22)}px`;
            insetLabel.setAttribute('x', String(insetWidth / 2));
            insetLabel.setAttribute('text-anchor', 'middle');
        }
    }
    function renderProvinceLabels(scale) {
        if (!provinceLabels) return;
        provinceLabels.replaceChildren();
        const selected = root.dataset.view === 'album' ? cityById.get(activeId) : null;
        const national = initialBox[2] / view[2] < 2.5;
        const fontSize = national && scale < .45 ? 9 : 11;
        const provinceName = name => text(name).replace(/(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
        const margin = (national ? 4 : 12) / scale;
        const frame = [view[0] + margin, view[1] + margin, view[0] + view[2] - margin, view[1] + view[3] - margin];
        const occupied = [...markers.querySelectorAll('.travel-map-label')].map(label => {
            const box = label.getBBox();
            return [box.x, box.y, box.x + box.width, box.y + box.height];
        });
        heartCityIds.forEach(id => {
            const center = cityById.get(id)?.center;
            if (center) occupied.push([center[0] - 5 / scale, center[1] - 5 / scale, center[0] + 5 / scale, center[1] + 5 / scale]);
        });
        const fits = box => box[0] >= frame[0] && box[1] >= frame[1] && box[2] <= frame[2] && box[3] <= frame[3];
        const padding = 4 / scale;
        const overlaps = box => occupied.some(other => box[0] < other[2] + padding && box[2] > other[0] - padding && box[1] < other[3] + padding && box[3] > other[1] - padding);
        const nationalOffsets = [[0, 0]];
        [14, 28, 42, 56].forEach(distance => {
            [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
                .forEach(([dx, dy]) => nationalOffsets.push([dx * distance, dy * distance]));
        });
        const area = province => province.bounds ? (province.bounds[2] - province.bounds[0]) * (province.bounds[3] - province.bounds[1]) : Infinity;
        // Small regions have less room to place their names; reserve that
        // space before labeling the wider provinces in the national view.
        const ordered = [...provinces].sort((a, b) => Number(b.name === selected?.province) - Number(a.name === selected?.province)
            || (national ? area(a) - area(b) : 0));
        ordered.forEach(province => {
            const name = provinceName(province.name);
            if (selected && name === shortName(selected.name)) return;
            const bounds = province.bounds;
            if (bounds && (bounds[2] < view[0] || bounds[0] > view[0] + view[2] || bounds[3] < view[1] || bounds[1] > view[1] + view[3])) return;
            const label = svgNode('text', {'class': 'travel-map-province-label', 'text-anchor': 'middle', 'dominant-baseline': 'central'});
            label.textContent = name;
            label.style.fontSize = `${fontSize / scale}px`;
            label.style.strokeWidth = `${2.5 / scale}px`;
            provinceLabels.append(label);
            const box = label.getBBox();
            let [x, y] = province.center;
            const active = province.name === selected?.province;
            if (active) {
                x = Math.max(frame[0] - box.x, Math.min(frame[2] - box.x - box.width, x));
                y = Math.max(frame[1] - box.y, Math.min(frame[3] - box.y - box.height, y));
            }
            const offsets = national
                ? nationalOffsets
                : active ? [[0, 0], [0, -16], [0, 16]] : [[0, 0]];
            const offset = offsets.find(([dx, dy]) => {
                const area = [x + dx / scale + box.x, y + dy / scale + box.y, x + dx / scale + box.x + box.width, y + dy / scale + box.y + box.height];
                return fits(area) && !overlaps(area);
            });
            if (offset === undefined) { label.remove(); return; }
            const labelX = x + offset[0] / scale;
            const labelY = y + offset[1] / scale;
            if (national && (offset[0] || offset[1])) {
                const edgeX = Math.max(labelX + box.x, Math.min(labelX + box.x + box.width, x));
                const edgeY = Math.max(labelY + box.y, Math.min(labelY + box.y + box.height, y));
                provinceLabels.insertBefore(svgNode('path', {
                    d: `M${x} ${y}L${edgeX} ${edgeY}`, class: 'travel-map-province-leader'
                }), label);
            }
            label.setAttribute('x', String(labelX));
            label.setAttribute('y', String(labelY));
            occupied.push([labelX + box.x, labelY + box.y, labelX + box.x + box.width, labelY + box.y + box.height]);
        });
    }
    function hashCity() {
        const match = location.hash.match(/^#city=([^&]+)/);
        if (!match) return '';
        try { return decodeURIComponent(match[1]); } catch (_) { return ''; }
    }
    function selectCity(id, {scroll = false, focus = false, hash = true} = {}) {
        const city = cityById.get(String(id));
        if (!city) return false;
        if (viewer?.open) viewer.close();
        const enteringAlbum = root.dataset.view !== 'album';
        activeId = city.id;
        root.dataset.view = 'album';
        details.hidden = false;
        allCitiesButton.hidden = false;
        tooltip.hidden = true;
        cancelViewAnimation();
        if (enteringAlbum) view = [...initialBox];
        closeSearch();
        search.value = '';
        paths.forEach((cityPaths, cityId) => cityPaths.forEach(path => path.classList.toggle('is-selected', cityId === activeId)));
        focusCityMap(city, {animate: scroll});
        renderEntries(city);
        renderCityControls();
        if (hash && hashCity() !== city.id) history.replaceState(null, '', `${location.pathname}${location.search}#city=${encodeURIComponent(city.id)}`);
        live.textContent = `已选择${city.name}，${hasRecord(city.id) ? `${entries(city.id).reduce((sum, entry) => sum + photos(entry).length, 0)} 张照片` : '还没有旅行记录'}。`;
        if (scroll) {
            const target = root.querySelector('.travel-atlas-layout');
            const top = target.getBoundingClientRect().top;
            const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
            if (enteringAlbum || top < headerBottom || top > window.innerHeight * .65) target.scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'});
        }
        if (focus) heading.focus({preventScroll: true});
        return true;
    }
    function showAtlas({hash = true, scroll = false, focus = false} = {}) {
        cancelViewAnimation();
        if (viewer?.open) viewer.close();
        activeId = '';
        gallery = [];
        root.dataset.view = 'atlas';
        details.hidden = true;
        allCitiesButton.hidden = true;
        closeSearch();
        search.value = '';
        tooltip.hidden = true;
        paths.forEach(cityPaths => cityPaths.forEach(path => path.classList.remove('is-selected')));
        view = [...initialBox];
        applyView();
        renderCityControls();
        if (hash && location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
        live.textContent = '全国旅行地图，选择一座城市查看相册。';
        if (scroll) root.querySelector('.travel-atlas-layout').scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block: 'start'});
        if (focus) svg.focus({preventScroll: true});
    }
    allCitiesButton.addEventListener('click', () => showAtlas({scroll: true, focus: true}));
    function viewerPhoto(index) {
        if (!gallery.length) return;
        viewerIndex = (index + gallery.length) % gallery.length;
        const photo = gallery[viewerIndex];
        viewerImage.hidden = false;
        viewerImage.alt = photo.alt;
        viewerImage.src = photo.src;
        viewerCaption.textContent = text(photo.caption) || photo.alt;
        viewerCounter.textContent = `${viewerIndex + 1} / ${gallery.length}`;
        viewer.querySelectorAll('[data-prev-photo],[data-next-photo]').forEach(button => { button.disabled = gallery.length < 2; });
    }
    function openViewer(index, trigger) {
        if (!viewer || !gallery[index]) return;
        viewerTrigger = trigger;
        viewerPhoto(index);
        viewer.showModal();
    }
    viewer?.querySelector('[data-close-photo]')?.addEventListener('click', () => viewer.close());
    viewer?.querySelector('[data-prev-photo]')?.addEventListener('click', () => viewerPhoto(viewerIndex - 1));
    viewer?.querySelector('[data-next-photo]')?.addEventListener('click', () => viewerPhoto(viewerIndex + 1));
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
        (viewerTrigger?.isConnected ? viewerTrigger : heading)?.focus({preventScroll: true});
        viewerImage.removeAttribute('src');
    });
    viewerImage?.addEventListener('error', () => {
        if (!viewer.open) return;
        viewerImage.hidden = true;
        viewerCaption.textContent = '照片暂时无法载入，请检查照片文件的位置。';
    });

    function cancelViewAnimation() {
        cancelAnimationFrame(viewAnimation);
        viewAnimation = 0;
    }
    function focusCityMap(city, {animate = false} = {}) {
        cancelViewAnimation();
        if (!mapReady || !Array.isArray(city.center)) { applyView(); return; }
        // Fit the selected city's boundary, leaving room for nearby cities.
        // Inset cities use their already transformed map coordinates.
        const bounds = !city.insetCenter && paths.get(city.id)?.[0]?.getBBox();
        const zoom = bounds?.width > 0 && bounds?.height > 0
            ? Math.max(1.5, Math.min(12, initialBox[2] / (bounds.width * 2.6), initialBox[3] / (bounds.height * 2.6)))
            : 6.75;
        const center = bounds?.width > 0 && bounds?.height > 0
            ? [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
            : city.center;
        const width = initialBox[2] / zoom;
        const height = initialBox[3] / zoom;
        const target = [center[0] - width / 2, center[1] - height / 2, width, height];
        if (!animate || reducedMotion) { view = target; applyView(); return; }
        const start = [...view];
        const started = performance.now();
        function step(now) {
            const progress = Math.min(1, (now - started) / 320);
            const ease = 1 - (1 - progress) ** 3;
            view = start.map((value, index) => value + (target[index] - value) * ease);
            applyView();
            viewAnimation = progress < 1 ? requestAnimationFrame(step) : 0;
        }
        viewAnimation = requestAnimationFrame(step);
    }
    function applyView() {
        const zoom = initialBox[2] / view[2];
        const marginX = initialBox[2] * .04;
        const marginY = initialBox[3] * .04;
        view[0] = Math.max(initialBox[0] - marginX, Math.min(initialBox[0] + initialBox[2] - view[2] + marginX, view[0]));
        view[1] = Math.max(initialBox[1] - marginY, Math.min(initialBox[1] + initialBox[3] - view[3] + marginY, view[1]));
        svg.setAttribute('viewBox', view.join(' '));
        root.dataset.zoomed = String(zoom > 1.01);
        root.querySelector('[data-travel-zoom="in"]').disabled = !mapReady || zoom >= 11.99;
        root.querySelector('[data-travel-zoom="out"]').disabled = !mapReady || zoom <= 1.01;
        root.querySelector('[data-travel-zoom="reset"]').disabled = !mapReady || zoom <= 1.01;
        renderMarkers();
    }
    function zoomBy(factor, center) {
        cancelViewAnimation();
        if (!mapReady) return;
        const zoom = Math.max(1, Math.min(12, initialBox[2] / view[2] * factor));
        const target = center || [view[0] + view[2] / 2, view[1] + view[3] / 2];
        const width = initialBox[2] / zoom;
        const height = initialBox[3] / zoom;
        view = zoom === 1 ? [...initialBox] : [target[0] - width / 2, target[1] - height / 2, width, height];
        applyView();
    }
    root.querySelectorAll('[data-travel-zoom]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.travelZoom === 'reset') { cancelViewAnimation(); view = [...initialBox]; applyView(); }
        else zoomBy(button.dataset.travelZoom === 'in' ? 1.5 : 1 / 1.5, cityById.get(activeId)?.center);
    }));
    function pointInMap(event) {
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
    }
    svg.addEventListener('pointerdown', event => {
        if (!mapReady || event.button !== 0 || !event.isPrimary) return;
        suppressClick = false;
        pendingMapCity = '';
        cancelViewAnimation();
        if (root.dataset.zoomed !== 'true') return;
        const point = pointInMap(event);
        drag = {pointerId: event.pointerId, x: point.x, y: point.y, startX: event.clientX, startY: event.clientY, view: [...view], moved: false, cityId: event.target.closest('[data-city-id]')?.dataset.cityId};
        svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', event => {
        if (drag?.pointerId === event.pointerId) {
            if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
            if (drag.moved) {
                const bounds = svg.getBoundingClientRect();
                const ratio = Math.max(view[2] / bounds.width, view[3] / bounds.height);
                view[0] = drag.view[0] - (event.clientX - drag.startX) * ratio;
                view[1] = drag.view[1] - (event.clientY - drag.startY) * ratio;
                applyView();
                root.classList.add('is-panning');
                tooltip.hidden = true;
            }
            return;
        }
        const city = cityById.get(event.target.closest('[data-city-id]')?.dataset.cityId);
        if (!city) { tooltip.hidden = true; return; }
        tooltip.textContent = `${shortName(city.name)}${hasRecord(city.id) ? ` · ${entries(city.id).reduce((sum, entry) => sum + photos(entry).length, 0)} 张照片` : ''}`;
        tooltip.hidden = false;
        const bounds = tooltip.parentElement.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(bounds.width - tooltip.offsetWidth - 8, event.clientX - bounds.left + 12))}px`;
        tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 36)}px`;
    });
    function endDrag(event) {
        if (drag?.pointerId !== event.pointerId) return;
        const clickedCity = !drag.moved && event.type !== 'pointercancel' ? drag.cityId : '';
        suppressClick = drag.moved || event.type === 'pointercancel';
        pendingMapCity = clickedCity || '';
        drag = null;
        root.classList.remove('is-panning');
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        // Wait for the click before changing layout. On touch devices,
        // rebuilding the album during pointerup can send that click to a
        // newly positioned photo underneath the finger.
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    svg.addEventListener('click', event => {
        if (suppressClick) {
            suppressClick = false;
            pendingMapCity = '';
            event.preventDefault();
            return;
        }
        const id = pendingMapCity || event.target.closest('[data-city-id]')?.dataset.cityId;
        pendingMapCity = '';
        if (id) selectCity(id, {scroll: true});
    });
    svg.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.5); return; }
        if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.5); return; }
        if (event.key === '0') { event.preventDefault(); cancelViewAnimation(); view = [...initialBox]; applyView(); return; }
        const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
        if (!direction || !mapReady) return;
        event.preventDefault();
        const current = cityById.get(activeId || journal.defaultCity) || cities.find(city => hasRecord(city.id)) || cities[0];
        if (!current?.center) return;
        let nearest;
        let distance = Infinity;
        cities.forEach(city => {
            if (city.id === activeId || !city.center) return;
            const dx = city.center[0] - current.center[0];
            const dy = city.center[1] - current.center[1];
            const forward = dx * direction[0] + dy * direction[1];
            if (forward <= 0) return;
            const lateral = Math.abs(dx * direction[1] - dy * direction[0]);
            const score = Math.hypot(dx, dy) + lateral * 1.5;
            if (score < distance) { distance = score; nearest = city; }
        });
        if (nearest) selectCity(nearest.id);
    });

    function setMapStatus(message) {
        mapStatus.hidden = false;
        mapStatus.replaceChildren(make('p', 'travel-map-message', message));
        if (retry) mapStatus.append(retry);
    }
    function initializeMap() {
        mapReady = false;
        if (retry) retry.hidden = true;
        try {
            const data = JSON.parse(document.getElementById('travelMapData').textContent);
            if (!Array.isArray(data.cities) || !data.cities.length || !Array.isArray(data.viewBox) || data.viewBox.length !== 4) throw new Error('Invalid map');
            paths = new Map();
            canvas.querySelectorAll('path[data-city-id]').forEach(path => {
                const id = path.dataset.cityId;
                if (!paths.has(id)) paths.set(id, []);
                paths.get(id).push(path);
            });
            cities = data.cities.filter(city => city && city.id && city.name && paths.has(String(city.id))).map(city => {
                const mapped = {...city, id: String(city.id)};
                if (city.insetCenter && data.inset?.placement && data.inset?.viewBox) {
                    const [x, y, width, height] = data.inset.placement;
                    const [originX, originY, insetWidth, insetHeight] = data.inset.viewBox;
                    mapped.center = [x + (city.insetCenter[0] - originX) * width / insetWidth, y + (city.insetCenter[1] - originY) * height / insetHeight];
                }
                return mapped;
            });
            if (!cities.length || !data.viewBox.every(Number.isFinite) || data.viewBox[2] <= 0 || data.viewBox[3] <= 0) throw new Error('Invalid map');
            cityById = new Map(cities.map(city => [city.id, city]));
            heartCityIds = new Set((data.heartCities || []).map(String));
            provinces = (Array.isArray(data.provinces) ? data.provinces : []).filter(province => province && typeof province.name === 'string' && Array.isArray(province.center) && province.center.length === 2 && province.center.every(Number.isFinite));
            initialBox = [...data.viewBox];
            view = [...initialBox];
            paths.forEach((cityPaths, id) => cityPaths.forEach(path => path.classList.toggle('is-recorded', hasRecord(id))));
            markers = canvas.querySelector('.travel-map-markers');
            if (!markers) throw new Error('Missing map markers');
            provinceLabels = canvas.querySelector('.travel-map-province-labels');
            if (!provinceLabels) {
                provinceLabels = svgNode('g', {'class': 'travel-map-province-labels', 'pointer-events': 'none'});
                canvas.insertBefore(provinceLabels, markers);
            }
            mapReady = true;
            mapStatus.hidden = true;
            updateStats();
            const requested = hashCity() || activeId;
            const pendingQuery = search.value;
            if (!requested || !selectCity(requested, {hash: false})) showAtlas({hash: false});
            if (pendingQuery) { search.value = pendingQuery; renderSearchResults(); }
            applyView();
        } catch (_) {
            setMapStatus('地图交互暂时不可用，仍可查看已记录城市的相册。');
            if (retry) retry.hidden = false;
            renderCityControls();
            applyView();
        }
    }
    retry?.addEventListener('click', initializeMap);
    search.addEventListener('input', event => { if (!event.isComposing) renderSearchResults(); });
    search.addEventListener('compositionend', renderSearchResults);
    search.addEventListener('focus', () => { if (search.value.trim()) renderSearchResults(); });
    search.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape') {
            if (!searchResults.hidden) { event.preventDefault(); closeSearch(); }
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!search.value.trim()) return;
            event.preventDefault();
            const wasClosed = searchResults.hidden;
            if (wasClosed) renderSearchResults();
            const count = cityList.querySelectorAll('[role="option"]').length;
            if (!count) return;
            setActiveResult(wasClosed ? (event.key === 'ArrowDown' ? 0 : count - 1) : activeResult + (event.key === 'ArrowDown' ? 1 : -1), true);
        }
        if (event.key === 'Enter' && !searchResults.hidden && activeResult >= 0) {
            event.preventDefault();
            cityList.querySelectorAll('[role="option"]')[activeResult]?.click();
        }
    });
    document.addEventListener('pointerdown', event => { if (!citySearch.contains(event.target)) closeSearch(); });
    citySearch.addEventListener('focusout', event => { if (!citySearch.contains(event.relatedTarget)) closeSearch(); });
    window.addEventListener('hashchange', () => {
        if (!hashCity() || !selectCity(hashCity(), {hash: false})) showAtlas({hash: false});
    });
    new ResizeObserver(() => renderMarkers()).observe(svg);
    svg.tabIndex = 0;
    updateStats();
    if (!hashCity() || !selectCity(hashCity(), {hash: false})) showAtlas({hash: false});
    applyView();
    initializeMap();
});
