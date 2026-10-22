export function createMap({root, stats, defaultPlace, onSelect, onViewChange = () => {}, onReady = () => {}, onError = () => {}}) {
    const country = root.dataset.country || 'china';
    const provinceLevel = root.dataset.mapLevel === 'province';
    const svg = root.querySelector('#travelMap');
    const canvas = root.querySelector('#travelMapCanvas');
    const mapStatus = root.querySelector('#travelMapStatus');
    const retry = root.querySelector('#travelRetry');
    const tooltip = root.querySelector('#travelMapTooltip');
    const mouseMagnifier = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const svgNS = 'http://www.w3.org/2000/svg';
    const text = value => typeof value === 'string' ? value : '';
    const shortName = name => provinceLevel ? text(name) : text(name).replace(/(?:特别行政区|自治州|地区|市)$/u, '');
    const mapStats = stats || Object.fromEntries([...canvas.querySelectorAll('path[data-city-id]')].map(path => [path.dataset.cityId, {
        recorded: path.classList.contains('is-recorded'), photos: Number(path.dataset.photoCount) || 0
    }]));
    const hasRecord = id => !!mapStats[id]?.recorded;
    const photoCount = id => mapStats[id]?.photos || 0;
    const mapRecorded = hasRecord;
    const mapPhotoCount = photoCount;
    const photoWeight = id => stats[id]?.weight || '0.00%';
    const cityDescription = place => `${place.name}${hasRecord(place.id) ? ` · ${photoCount(place.id)} 张照片` : ''}`;
    const mapDescription = cityDescription;
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
    const hatchShape = path => {
        const shape = svgNode('path', {
            d: path.getAttribute('d'), class: 'travel-map-hatch',
            'data-hatch-city-id': path.dataset.cityId, 'pointer-events': 'none'
        });
        if (path.hasAttribute('transform')) shape.setAttribute('transform', path.getAttribute('transform'));
        return shape;
    };
    const authoredBox = svg.viewBox.baseVal;
    let initialBox = [authoredBox.x, authoredBox.y, authoredBox.width, authoredBox.height];
    let view = [...initialBox];
    let places = [];
    let placeById = new Map();
    let selectedId = '';
    let mode = 'atlas';
    let mapReady = false;
    let drag = null;
    let suppressClick = false;
    let pendingMapCity = '';
    let viewAnimation = 0;
    let markers;
    let provinceLabels;
    let provinces = [];
    let paths = new Map();
    let provinceFocus = null;
    let provinceFocusExtent = null;
    let hoverProvinceName = '';
    let provinceHideTimer = 0;
    let heartPlaceIds = new Set();
    function renderMarkers() {
        if (!markers) return;
        const matrix = svg.getScreenCTM();
        const scale = matrix ? Math.max(.01, Math.hypot(matrix.a, matrix.b)) : 1;
        // 重描轮廓的错位保持屏幕像素大小，不随地图放大而拉开。
        canvas.querySelectorAll('.travel-map-outline--echo').forEach(outline => {
            const outlineMatrix = outline.getScreenCTM();
            const outlineScale = outlineMatrix ? Math.max(.01, Math.hypot(outlineMatrix.a, outlineMatrix.b)) : scale;
            outline.setAttribute('transform', `translate(${.65 / outlineScale} ${.4 / outlineScale})`);
        });
        const pattern = canvas.querySelector('#travelMapHatching');
        if (pattern) pattern.setAttribute('patternTransform', `scale(${1 / scale})`);
        markers.replaceChildren();
        const selected = mode === 'album' ? placeById.get(selectedId) : null;
        const markerIds = new Set(provinceLevel ? [] : heartPlaceIds);
        const visible = [...markerIds].map(id => placeById.get(id)).filter(Boolean);
        if (selected && !heartPlaceIds.has(selected.id)) visible.push(selected);
        visible.forEach(city => {
            if (!Array.isArray(city.center)) return;
            const [cx, cy] = city.center;
            const isSelected = selected?.id === city.id;
            const group = svgNode('g', {'data-city-id': city.id, 'class': `travel-map-pin${isSelected ? ' is-selected' : ''}`});
            const transform = `translate(${cx} ${cy}) scale(${1 / scale})`;
            if (isSelected) group.append(svgNode('use', {
                href: '#travelMapSelectionRing', transform, class: 'travel-map-selection-ring'
            }));
            group.append(svgNode('use', {
                href: heartPlaceIds.has(city.id) ? '#travelMapHeart' : '#travelMapInkDot', transform,
                class: heartPlaceIds.has(city.id) ? 'travel-map-heart' : 'travel-map-marker'
            }));
            if (isSelected && !provinceLevel) {
                const alignLeft = cx > view[0] + view[2] * .8;
                const label = svgNode('text', {x: cx + (alignLeft ? -13 : 13) / scale, y: cy + 4 / scale, 'class': `travel-map-label${hasRecord(city.id) ? ' is-recorded' : ''}`, 'text-anchor': alignLeft ? 'end' : 'start'});
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
        const selected = mode === 'album' ? placeById.get(selectedId) : null;
        const national = initialBox[2] / view[2] < 2.5;
        const fontSize = national && scale < .45 ? 9 : 11;
        const provinceName = name => text(name).replace(country === 'japan' ? /(?:都|府|县)$/u : /(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
        const margin = (national ? 4 : 12) / scale;
        const frame = [view[0] + margin, view[1] + margin, view[0] + view[2] - margin, view[1] + view[3] - margin];
        const occupied = [...markers.querySelectorAll('.travel-map-label')].map(label => {
            const box = label.getBBox();
            return [box.x, box.y, box.x + box.width, box.y + box.height];
        });
        const cityNames = new Set([...markers.querySelectorAll('.travel-map-label')].map(label => label.textContent));
        markers.querySelectorAll('.travel-map-pin').forEach(pin => {
            const center = placeById.get(pin.dataset.cityId)?.center;
            const radius = pin.classList.contains('is-selected') ? 9 : 5;
            if (center) occupied.push([center[0] - radius / scale, center[1] - radius / scale, center[0] + radius / scale, center[1] + radius / scale]);
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
        const ordered = [...provinces].sort((a, b) => Number(b.name === selected?.province) - Number(a.name === selected?.province)
            || (national ? area(a) - area(b) : 0));
        const recordedProvinces = new Set(places.filter(city => hasRecord(city.id)).map(city => city.province));
        const compactJapan = country === 'japan' && national && scale < .45;
        const overviewNames = compactJapan ? new Set(['北海道', '东京都', '京都府', '大阪府', '福冈县', '冲绳县',
            ...places.filter(city => hasRecord(city.id)).map(city => city.province)]) : null;
        ordered.forEach(province => {
            if (overviewNames && !overviewNames.has(province.name)) return;
            const name = provinceName(province.name);
            if (cityNames.has(name)) return;
            const bounds = province.bounds;
            if (bounds && (bounds[2] < view[0] || bounds[0] > view[0] + view[2] || bounds[3] < view[1] || bounds[1] > view[1] + view[3])) return;
            const label = svgNode('text', {'class': `travel-map-province-label${provinceLevel && recordedProvinces.has(province.name) ? ' is-recorded' : ''}`, 'text-anchor': 'middle', 'dominant-baseline': 'central'});
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
    function cancelViewAnimation() {
        cancelAnimationFrame(viewAnimation);
        viewAnimation = 0;
    }
    function focusCityMap(city, {animate = false} = {}) {
        cancelViewAnimation();
        if (!mapReady || !Array.isArray(city.center)) { applyView(); return; }
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
        hideProvinceFocus();
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
        if (mode === 'atlas') onViewChange([...view]);
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
        if (button.dataset.travelZoom === 'reset') {
            cancelViewAnimation(); view = [...initialBox]; applyView();
        }
        else zoomBy(button.dataset.travelZoom === 'in' ? 1.5 : 1 / 1.5, placeById.get(selectedId)?.center);
    }));
    function pointInMap(event) {
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
    }
    function hideProvinceFocus() {
        clearTimeout(provinceHideTimer);
        provinceHideTimer = 0;
        provinceFocus?.remove();
        provinceFocus = null;
        provinceFocusExtent = null;
        hoverProvinceName = '';
        delete root.dataset.hoverProvince;
    }
    function scheduleProvinceHide() {
        if (provinceHideTimer || !provinceFocus) return;
        provinceHideTimer = window.setTimeout(hideProvinceFocus, 120);
    }
    function provinceCityName(city) {
        if (city.province === '台湾省') return city.name;
        return shortName(city.name).replace(/自治县$/u, '')
            .replace(/(?:蒙古族?|藏族|羌族|彝族|苗族|白族|傣族|哈尼族|壮族|黎族|回族|土家族|布依族|侗族|傈僳族|景颇族|朝鲜族|哈萨克|柯尔克孜)+$/u, '');
    }
    function renderProvinceCityLabels(group, provinceCities, bounds, pixelScale) {
        const padding = 3 / pixelScale;
        const occupied = [];
        const frame = [bounds[0] - 44 / pixelScale, bounds[1] - 36 / pixelScale,
            bounds[2] + 44 / pixelScale, bounds[3] + 36 / pixelScale];
        const labels = provinceCities.map(city => {
            const cityPaths = paths.get(city.id).filter(path => path.ownerSVGElement === svg);
            let center = city.mainCenter || city.center;
            if (city.insetCenter || !Array.isArray(center)) {
                const box = cityPaths[0].getBBox();
                center = [box.x + box.width / 2, box.y + box.height / 2];
            }
            const label = svgNode('text', {
                class: `travel-province-city-label${hasRecord(city.id) ? ' is-recorded' : ''}`,
                'data-city-id': city.id, 'text-anchor': 'middle', 'dominant-baseline': 'central'
            });
            label.textContent = provinceCityName(city);
            label.style.fontSize = `${12 / pixelScale}px`;
            label.style.strokeWidth = `${3 / pixelScale}px`;
            const title = svgNode('title');
            title.textContent = cityDescription(city);
            label.append(title);
            group.append(label);
            return {city, center, label, box: label.getBBox()};
        });
        const nearestDistance = item => Math.min(...labels.filter(other => other !== item)
            .map(other => Math.hypot(item.center[0] - other.center[0], item.center[1] - other.center[1])));
        labels.sort((a, b) => nearestDistance(a) - nearestDistance(b) || b.box.width - a.box.width);
        const fits = box => box[0] >= frame[0] && box[1] >= frame[1] && box[2] <= frame[2] && box[3] <= frame[3];
        const overlaps = box => occupied.some(other => box[0] < other[2] + padding && box[2] > other[0] - padding
            && box[1] < other[3] + padding && box[3] > other[1] - padding);
        const offsets = [[0, 0]];
        [14, 28, 42, 56, 70].forEach(distance => {
            [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
                .forEach(([dx, dy]) => offsets.push([dx * distance / pixelScale, dy * distance / pixelScale]));
        });
        labels.forEach(({center, label, box}) => {
            const areaAt = (x, y) => [x + box.x, y + box.y, x + box.x + box.width, y + box.y + box.height];
            const available = (x, y) => fits(areaAt(x, y)) && !overlaps(areaAt(x, y));
            let position = offsets.map(([dx, dy]) => [center[0] + dx, center[1] + dy])
                .find(([x, y]) => available(x, y));
            if (!position) {
                const candidates = [];
                const step = 8 / pixelScale;
                for (let y = frame[1] - box.y; y <= frame[3] - box.y - box.height; y += step) {
                    for (let x = frame[0] - box.x; x <= frame[2] - box.x - box.width; x += step) {
                        if (available(x, y)) candidates.push([x, y]);
                    }
                }
                candidates.sort((a, b) => Math.hypot(a[0] - center[0], a[1] - center[1])
                    - Math.hypot(b[0] - center[0], b[1] - center[1]));
                position = candidates[0];
            }
            if (!position) {
                const x = Math.max(frame[0] - box.x, Math.min(frame[2] - box.x - box.width, center[0]));
                let y = frame[3] - box.y + padding;
                while (overlaps(areaAt(x, y))) y += (box.height + padding);
                position = [x, y];
                frame[3] = y + box.y + box.height;
            }
            label.setAttribute('x', String(position[0]));
            label.setAttribute('y', String(position[1]));
            occupied.push(areaAt(...position));
        });
        return occupied;
    }
    function showProvinceFocus(name) {
        clearTimeout(provinceHideTimer);
        provinceHideTimer = 0;
        if (hoverProvinceName === name && provinceFocus) return;
        const provinceCities = places.filter(city => city.province === name
            && paths.get(city.id)?.some(path => path.ownerSVGElement === svg));
        if (!provinceCities.length) { hideProvinceFocus(); return; }
        const matrix = svg.getScreenCTM();
        const screenScale = matrix && Math.hypot(matrix.a, matrix.b);
        if (!screenScale) return;
        const geometry = provinceCities.flatMap(city => paths.get(city.id).filter(path => path.ownerSVGElement === svg));
        const boxes = geometry.map(path => path.getBBox()).filter(box => box.width || box.height);
        if (!boxes.length) return;
        const bounds = [Math.min(...boxes.map(box => box.x)), Math.min(...boxes.map(box => box.y)),
            Math.max(...boxes.map(box => box.x + box.width)), Math.max(...boxes.map(box => box.y + box.height))];
        const width = bounds[2] - bounds[0];
        const height = bounds[3] - bounds[1];
        const cx = (bounds[0] + bounds[2]) / 2;
        const cy = (bounds[1] + bounds[3]) / 2;
        const targetSize = provinceCities.length === 1 ? 72 : Math.min(300, 210 + provinceCities.length * 4);
        const maximumScale = provinceCities.length === 1 ? 24 : 3.2;
        const viewportScale = Math.min((view[2] - 32 / screenScale) / width, (view[3] - 58 / screenScale) / height);
        const minimumScale = initialBox[2] / view[2] > 1.01 ? .01 : 1.06;
        const focusScale = Math.min(viewportScale, Math.max(minimumScale,
            Math.min(maximumScale, targetSize / (Math.max(width, height) * screenScale))));
        const pixelScale = screenScale * focusScale;
        const focus = svgNode('g', {id: 'travelProvinceFocus', class: 'travel-province-focus', 'data-province': name});
        const surface = svgNode('g', {class: 'travel-province-surface'});
        // 用不参与交互的轮廓纸片投影替代模糊滤镜，偏移固定为 3×4 屏幕像素。
        const shadow = svgNode('g', {
            class: 'travel-province-shadow', transform: `translate(${3 / pixelScale} ${4 / pixelScale})`,
            'pointer-events': 'none', 'aria-hidden': 'true'
        });
        const hatching = svgNode('g', {class: 'travel-map-hatching', 'pointer-events': 'none', 'aria-hidden': 'true'});
        const terrain = canvas.querySelector('.travel-map-terrain');
        const clip = terrain ? svgNode('clipPath', {id: 'travelProvinceClip', clipPathUnits: 'userSpaceOnUse'}) : null;
        geometry.forEach(path => {
            const shape = path.cloneNode(true);
            shape.removeAttribute('id');
            shape.classList.add('travel-province-city');
            shape.classList.remove('is-selected');
            shape.querySelector('title')?.remove();
            surface.append(shape);
            const silhouette = svgNode('path', {d: path.getAttribute('d')});
            if (path.hasAttribute('transform')) silhouette.setAttribute('transform', path.getAttribute('transform'));
            shadow.append(silhouette);
            if (photoCount(path.dataset.cityId) > 0) hatching.append(hatchShape(path));
            if (clip) {
                const outline = svgNode('path', {d: path.getAttribute('d')});
                if (path.hasAttribute('transform')) outline.setAttribute('transform', path.getAttribute('transform'));
                clip.append(outline);
            }
        });
        if (terrain) {
            const defs = svgNode('defs');
            defs.append(clip);
            focus.append(defs);
            const relief = terrain.cloneNode(false);
            relief.removeAttribute('id');
            relief.setAttribute('clip-path', 'url(#travelProvinceClip)');
            surface.append(relief);
        }
        surface.append(hatching);
        focus.append(shadow, surface);
        canvas.querySelectorAll('.travel-map-province-border[data-province-name]').forEach(path => {
            if (path.dataset.provinceName !== name) return;
            const outline = path.cloneNode(false);
            outline.removeAttribute('id');
            outline.setAttribute('class', 'travel-province-outline');
            surface.append(outline);
        });
        hideProvinceFocus();
        svg.append(focus);
        provinceFocus = focus;
        hoverProvinceName = name;
        root.dataset.hoverProvince = name;
        const extent = [bounds[0], bounds[1], bounds[2] + 3 / pixelScale, bounds[3] + 4 / pixelScale];
        const include = box => {
            extent[0] = Math.min(extent[0], box[0]);
            extent[1] = Math.min(extent[1], box[1]);
            extent[2] = Math.max(extent[2], box[2]);
            extent[3] = Math.max(extent[3], box[3]);
        };
        renderProvinceCityLabels(focus, provinceCities, bounds, pixelScale).forEach(include);
        if (provinceCities.length > 1) {
            const title = svgNode('text', {class: 'travel-province-title', x: cx,
                y: extent[1] - 18 / pixelScale, 'text-anchor': 'middle', 'pointer-events': 'none'});
            title.textContent = name.replace(/(?:维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
            title.style.fontSize = `${18 / pixelScale}px`;
            title.style.strokeWidth = `${4 / pixelScale}px`;
            focus.append(title);
            const titleBox = title.getBBox();
            include([titleBox.x, titleBox.y, titleBox.x + titleBox.width, titleBox.y + titleBox.height]);
        }
        const left = cx + (extent[0] - cx) * focusScale;
        const top = cy + (extent[1] - cy) * focusScale;
        const right = cx + (extent[2] - cx) * focusScale;
        const bottom = cy + (extent[3] - cy) * focusScale;
        const margin = 10 / screenScale;
        let dx = 0;
        let dy = -10 / screenScale;
        if (left < view[0] + margin) dx = view[0] + margin - left;
        else if (right > view[0] + view[2] - margin) dx = view[0] + view[2] - margin - right;
        if (top + dy < view[1] + margin) dy = view[1] + margin - top;
        else if (bottom + dy > view[1] + view[3] - margin) dy = view[1] + view[3] - margin - bottom;
        focus.setAttribute('transform', `translate(${dx} ${dy}) translate(${cx} ${cy}) scale(${focusScale}) translate(${-cx} ${-cy})`);
        const focusMatrix = focus.getScreenCTM();
        const screenCorners = [[extent[0], extent[1]], [extent[2], extent[1]],
            [extent[0], extent[3]], [extent[2], extent[3]]].map(([x, y]) => {
            const point = svg.createSVGPoint();
            point.x = x;
            point.y = y;
            return point.matrixTransform(focusMatrix);
        });
        provinceFocusExtent = {
            left: Math.min(...screenCorners.map(point => point.x)), right: Math.max(...screenCorners.map(point => point.x)),
            top: Math.min(...screenCorners.map(point => point.y)), bottom: Math.max(...screenCorners.map(point => point.y))
        };
    }
    function showProvinceHover(event, city) {
        if (provinceLevel) return false;
        if (!mapReady || mode !== 'atlas'
            || event.pointerType !== 'mouse' || !mouseMagnifier.matches) {
            hideProvinceFocus();
            return false;
        }
        tooltip.hidden = true;
        if (event.buttons || drag) return true;
        if (event.target.closest('#travelProvinceFocus')) {
            clearTimeout(provinceHideTimer);
            provinceHideTimer = 0;
            return true;
        }
        const onMainMap = event.target.closest('path[data-city-id]')?.ownerSVGElement === svg
            || event.target.closest('.travel-map-pin');
        if (city?.province && onMainMap && city.province !== hoverProvinceName) {
            showProvinceFocus(city.province);
            return true;
        }
        if (provinceFocusExtent) {
            const bounds = provinceFocusExtent;
            if (event.clientX >= bounds.left - 5 && event.clientX <= bounds.right + 5
                && event.clientY >= bounds.top - 5 && event.clientY <= bounds.bottom + 5) {
                clearTimeout(provinceHideTimer);
                provinceHideTimer = 0;
                return true;
            }
        }
        if (city?.province && onMainMap) showProvinceFocus(city.province);
        else scheduleProvinceHide();
        return true;
    }
    svg.addEventListener('pointerdown', event => {
        if (!mapReady || event.button !== 0 || !event.isPrimary) return;
        suppressClick = false;
        pendingMapCity = event.target.closest('[data-city-id]')?.dataset.cityId || '';
        if (event.pointerType !== 'mouse') hideProvinceFocus();
        cancelViewAnimation();
        if (root.dataset.zoomed !== 'true') return;
        const point = pointInMap(event);
        drag = {pointerId: event.pointerId, x: point.x, y: point.y, startX: event.clientX, startY: event.clientY, view: [...view], moved: false, cityId: pendingMapCity};
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
        const city = placeById.get(event.target.closest('[data-city-id]')?.dataset.cityId);
        if (showProvinceHover(event, city)) return;
        if (!city) { tooltip.hidden = true; return; }
        tooltip.textContent = `${shortName(city.name)}${hasRecord(city.id) ? ` · ${photoCount(city.id)} 张照片` : ''}`;
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
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', () => { tooltip.hidden = true; hideProvinceFocus(); });
    svg.addEventListener('pointercancel', hideProvinceFocus);
    svg.addEventListener('keydown', hideProvinceFocus);
    window.addEventListener('scroll', hideProvinceFocus, {passive: true});
    window.addEventListener('resize', hideProvinceFocus, {passive: true});
    window.addEventListener('blur', hideProvinceFocus);
    mouseMagnifier.addEventListener('change', hideProvinceFocus);
    window.addEventListener('keydown', event => { if (event.key === 'Escape') hideProvinceFocus(); });
    svg.addEventListener('click', event => {
        if (suppressClick) {
            suppressClick = false;
            pendingMapCity = '';
            event.preventDefault();
            return;
        }
        const id = pendingMapCity || event.target.closest('[data-city-id]')?.dataset.cityId;
        pendingMapCity = '';
        if (id) onSelect(id, {scroll: true});
    });
    svg.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.5); return; }
        if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.5); return; }
        if (event.key === '0') { event.preventDefault(); cancelViewAnimation(); view = [...initialBox]; applyView(); return; }
        const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
        if (!direction || !mapReady) return;
        event.preventDefault();
        const current = placeById.get(selectedId || defaultPlace) || places.find(city => hasRecord(city.id)) || places[0];
        if (!current?.center) return;
        let nearest;
        let distance = Infinity;
        places.forEach(city => {
            if (city.id === selectedId || !city.center) return;
            const dx = city.center[0] - current.center[0];
            const dy = city.center[1] - current.center[1];
            const forward = dx * direction[0] + dy * direction[1];
            if (forward <= 0) return;
            const lateral = Math.abs(dx * direction[1] - dy * direction[0]);
            const score = Math.hypot(dx, dy) + lateral * 1.5;
            if (score < distance) { distance = score; nearest = city; }
        });
        if (nearest) onSelect(nearest.id, {historyMode: selectedId ? 'replace' : 'push'});
    });

    function setMapStatus(message) {
        mapStatus.hidden = false;
        mapStatus.replaceChildren(make('p', 'travel-map-message', message));
        if (retry) mapStatus.append(retry);
    }
    function initializeMap() {
        hideProvinceFocus();
        mapReady = false;
        if (retry) retry.hidden = true;
        try {
            const data = JSON.parse(document.getElementById('travelMapData').textContent);
            if (!Array.isArray(data.places) || !data.places.length || !Array.isArray(data.viewBox) || data.viewBox.length !== 4) throw new Error('Invalid map');
            paths = new Map();
            canvas.querySelectorAll('path[data-city-id]').forEach(path => {
                const id = path.dataset.cityId;
                if (!paths.has(id)) paths.set(id, []);
                paths.get(id).push(path);
            });
            places = data.places.filter(city => city && city.id && city.name && paths.has(String(city.id))).map(city => {
                const mapped = {...city, id: String(city.id), mainCenter: city.center};
                if (city.insetCenter && data.inset?.placement && data.inset?.viewBox) {
                    const [x, y, width, height] = data.inset.placement;
                    const [originX, originY, insetWidth, insetHeight] = data.inset.viewBox;
                    mapped.center = [x + (city.insetCenter[0] - originX) * width / insetWidth, y + (city.insetCenter[1] - originY) * height / insetHeight];
                }
                return mapped;
            });
            if (!places.length || !data.viewBox.every(Number.isFinite) || data.viewBox[2] <= 0 || data.viewBox[3] <= 0) throw new Error('Invalid map');
            placeById = new Map(places.map(city => [city.id, city]));
            heartPlaceIds = new Set((data.heartPlaces || []).map(String));
            provinces = (Array.isArray(data.provinces) ? data.provinces : []).filter(province => province && typeof province.name === 'string' && Array.isArray(province.center) && province.center.length === 2 && province.center.every(Number.isFinite));
            initialBox = [...data.viewBox];
            view = [...initialBox];
            if (stats) paths.forEach((cityPaths, id) => cityPaths.forEach(path => {
                path.classList.toggle('is-recorded', mapRecorded(id));
                path.dataset.photoCount = String(mapPhotoCount(id));
                path.style.setProperty('--travel-photo-weight', photoWeight(id));
                const title = path.querySelector('title');
                const city = placeById.get(id);
                if (title && city) title.textContent = mapDescription(city);
            }));
            // 与有效相册统计同步纹理；零照片的纯文字记录保持中性底色。
            canvas.querySelectorAll('.travel-map-hatching').forEach(group => {
                const textured = [...group.parentElement.querySelectorAll('path[data-city-id]')]
                    .filter(path => path.ownerSVGElement === group.ownerSVGElement && photoCount(path.dataset.cityId) > 0);
                group.replaceChildren(...textured.map(hatchShape));
            });
            markers = canvas.querySelector('.travel-map-markers');
            if (!markers) throw new Error('Missing map markers');
            provinceLabels = canvas.querySelector('.travel-map-province-labels');
            if (!provinceLabels) {
                provinceLabels = svgNode('g', {'class': 'travel-map-province-labels', 'pointer-events': 'none'});
                canvas.insertBefore(provinceLabels, markers);
            }
            mapReady = true;
            mapStatus.hidden = true;
            onReady(places);
            applyView();
        } catch (error) {
            setMapStatus('地图交互暂时不可用，仍可查看已记录城市的相册。');
            if (retry) retry.hidden = false;
            onError(error);
            applyView();
        }
    }

    retry?.addEventListener('click', initializeMap);
    new ResizeObserver(() => { hideProvinceFocus(); renderMarkers(); }).observe(svg);
    svg.tabIndex = 0;
    return {
        initialize: initializeMap,
        get ready() { return mapReady; },
        get places() { return places; },
        get initialView() { return [...initialBox]; },
        getPlace(id) { return placeById.get(id); },
        select(id, {animate = false} = {}) {
            const place = placeById.get(id);
            if (!place) return;
            const enteringAlbum = mode !== 'album';
            selectedId = id;
            mode = 'album';
            hideProvinceFocus();
            tooltip.hidden = true;
            cancelViewAnimation();
            if (enteringAlbum) view = [...initialBox];
            paths.forEach((placePaths, placeId) => placePaths.forEach(path => path.classList.toggle('is-selected', placeId === id)));
            focusCityMap(place, {animate});
        },
        showAtlas(atlasView) {
            selectedId = '';
            mode = 'atlas';
            hideProvinceFocus();
            cancelViewAnimation();
            tooltip.hidden = true;
            paths.forEach(placePaths => placePaths.forEach(path => path.classList.remove('is-selected')));
            if (Array.isArray(atlasView) && atlasView.length === 4 && atlasView.every(Number.isFinite)) view = [...atlasView];
            else view = [...initialBox];
            applyView();
        },
        focus() { svg.focus({preventScroll: true}); }
    };
}

