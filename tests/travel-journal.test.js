'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { parse: parseFrontMatter } = require('hexo-front-matter');
const { countries, countryFor } = require('../tools/travel-countries');
const { compileJournal, mapPlaces } = require('../tools/travel-journal');
const { normalizePhotoUrl, parseTravelMarkdown, resolveCity, serializeJournal } = require('../tools/travel-markdown');
const { addTravelImageMetadata } = require('../tools/travel-image-metadata');

const japan = countryFor({ travel_country: 'japan' });
const sampleMap = {
  provinces: [{ id: 'JP-26', name: '京都府' }, { id: 'JP-28', name: '兵库县' }],
  headingPlaces: [
    { id: 'JP-26100', name: '京都市', province: '京都府', aliases: ['jingdu', 'Kyoto'] },
    { id: 'JP-26204', name: '宇治市', province: '京都府', aliases: ['yuzhi'] },
    { id: 'JP-28100', name: '神户市', province: '兵库县', aliases: ['shenhu'] },
    { id: 'JP-00001', name: '京都', province: '兵库县' }
  ]
};

test('country registration defaults only an unspecified country and rejects unknown countries', () => {
  assert.equal(countryFor().code, 'china');
  assert.equal(countryFor({}).code, 'china');
  assert.equal(countryFor({ travel_country: '' }).code, 'china');
  assert.equal(countryFor({ travel_country: 'japan' }).mapLevel, 'province');
  assert.throws(() => countryFor({ travel_country: 'japna' }), /未配置旅行国家/);
  assert.equal(new Set(countries.map(country => country.code)).size, countries.length);
  assert.equal(new Set(countries.map(country => country.route)).size, countries.length);
});

test('prefecture headings take priority over cities and legacy city albums retain entry order', () => {
  const markdown = '# 京都\n## 清水寺\n![first](../images/travel/japan/first.jpg)\n# yuzhi\n## 平等院\n![second](/images/travel/japan/second.jpg)\n# 兵库\n## 六甲山\n![third](/images/travel/japan/third.jpg)';
  const warnings = [];
  const result = compileJournal(markdown, { data: sampleMap, country: japan, onWarning: warning => warnings.push(warning) });
  assert.deepEqual(warnings, []);
  assert.deepEqual(Object.keys(result.albums), ['JP-26', 'JP-28']);
  assert.deepEqual(result.albums['JP-26'].entries.map(entry => entry.title), ['清水寺', '平等院']);
  assert.deepEqual(result.albums['JP-26'].entries.flatMap(entry => entry.photos.map(photo => photo.caption)), ['first', 'second']);
  assert.deepEqual(Object.keys(result.stats), ['byPlace']);
  assert.equal(result.stats.byPlace['JP-26'].photos, 2);
  assert.equal(result.stats.byPlace['JP-26'].weight, '80.00%');
  assert.equal(result.stats.byPlace['JP-28'].weight, '22.00%');
  assert.equal(result.defaultPlace, japan.defaultPlace);
  assert.equal(result.legacyPlaces['JP-28100'], 'JP-28');
  assert.equal(Object.keys(result.legacyPlaces).length, sampleMap.headingPlaces.length);
});

test('notes-only entries count as recorded and zero-photo colors remain neutral', () => {
  const result = compileJournal('# 京都府\n## 手记\n下雨了。', { data: sampleMap, country: japan });
  assert.deepEqual(result.stats.byPlace['JP-26'], { recorded: true, photos: 0, weight: '0.00%' });
  assert.deepEqual(result.stats.byPlace['JP-28'], { recorded: false, photos: 0, weight: '0.00%' });
});

test('ambiguous cities require an ID and invalid headings never attach photos to the preceding album', () => {
  const cities = [{ id: 'one', name: '同名市' }, { id: 'two', name: '同名市' }];
  assert.throws(() => resolveCity(cities, '同名'), /one.*two/);
  assert.equal(resolveCity(cities, 'two').id, 'two');
  const warnings = [];
  const result = parseTravelMarkdown('# one\n![ok](/images/travel/ok.jpg)\n# 同名\n![skip](/images/travel/skip.jpg)', { cities, onWarning: warning => warnings.push(warning) });
  assert.equal(result.cities.one.entries[0].photos.length, 1);
  assert.equal(warnings.length, 2);
});

test('Markdown photo references work while code and HTML never become album content', () => {
  const markdown = '---\nlayout: journal\n---\n# 杭州\n## 西湖\n![one][photo]\n\n[photo]: ../images/travel/hangzhou.jpg\n\n```markdown\n# 上海\n![fake](/images/travel/fake.jpg)\n```\n\n<img src="/images/travel/fake.jpg">';
  const result = parseTravelMarkdown(markdown, { cities: [{ id: '330100', name: '杭州市' }] });
  assert.deepEqual(Object.keys(result.cities), ['330100']);
  assert.deepEqual(result.cities['330100'].entries[0].photos, [{ src: '/images/travel/hangzhou.jpg', alt: 'one', caption: 'one' }]);
  assert.equal(normalizePhotoUrl('../images/travel/../../../secret.jpg'), '');
  assert.equal(normalizePhotoUrl('javascript:alert(1)'), '');
  assert.equal(normalizePhotoUrl('/images/travel/%2e%2e/secret.jpg'), '');
  assert.equal(normalizePhotoUrl('https://example.test/photo.jpg'), 'https://example.test/photo.jpg');
  assert.equal(serializeJournal({ caption: '</script>\u2028' }).includes('<'), false);
});

test('checked-in maps and current albums have consistent IDs and complete legacy lookup', () => {
  const warnings = [];
  const readPages = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return readPages(filename);
    if (!entry.isFile() || !/\.md$/iu.test(entry.name)) return [];
    const markdown = fs.readFileSync(filename, 'utf8');
    const page = parseFrontMatter(markdown);
    return page.travel_journal ? [{ markdown, country: countryFor(page) }] : [];
  });
  const pages = readPages(path.join(__dirname, '../source/journal'));
  for (const country of countries) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, `../tools/data/${country.code}-map.json`), 'utf8'));
    const places = mapPlaces(data, country);
    const ids = new Set(places.map(place => place.id));
    assert.equal(ids.size, places.length);
    assert.ok(ids.has(country.defaultPlace));
    assert.ok(country.heartPlaces.every(id => ids.has(id)));
    assert.equal(data.viewBox.length, 4);
    assert.ok(data.viewBox.every(Number.isFinite));
    for (const place of places) {
      assert.ok(place.path.length > 0, place.id);
      assert.ok(place.center.length === 2 && place.center.every(Number.isFinite), place.id);
    }
    if (country.code === 'japan') {
      assert.equal(data.provinces.length, 47);
      assert.equal(data.headingPlaces.length, 1725);
      assert.equal(resolveCity(data.headingPlaces, 'qingjingze').id, 'JP-20321');
    }
    for (const page of pages.filter(page => page.country.code === country.code)) {
      const journal = compileJournal(page.markdown, { data, country, onWarning: warning => warnings.push(warning) });
      assert.ok(Object.keys(journal.albums).every(id => ids.has(id)));
      const photos = Object.values(journal.albums).flatMap(album => album.entries.flatMap(entry => entry.photos || []));
      assert.ok(photos.every(photo => photo.src.startsWith('/images/travel/')));
      if (country.mapLevel === 'province') {
        const lookup = data.headingPlaces || [];
        assert.equal(Object.keys(journal.legacyPlaces).length, lookup.length);
        assert.ok(Object.values(journal.legacyPlaces).every(id => ids.has(id)));
        assert.ok(lookup.every(place => !('path' in place) && !('center' in place)));
      }
      if (country.code === 'japan') assert.equal(journal.legacyPlaces['JP-20321'], 'JP-20');
    }
  }
  assert.deepEqual(warnings, []);
});

function renderSketchMap(code, dataOverride) {
  const root = path.resolve(__dirname, '..');
  const data = dataOverride || JSON.parse(fs.readFileSync(path.join(root, `tools/data/${code}-map.json`), 'utf8'));
  const country = countryFor({ travel_country: code });
  const places = mapPlaces(data, country);
  const photoPlace = places.find(place => place.id === country.defaultPlace);
  const notePlace = places.find(place => place.id !== photoPlace.id);
  const page = { travel_country: code, _content: `# ${photoPlace.id}\n![一](/images/travel/one.jpg)\n![二](/images/travel/two.jpg)\n# ${notePlace.id}\n只有文字。` };
  const helpers = {};
  const sandbox = {
    require(name) {
      if (name !== 'node:fs') return require(name);
      return { ...fs, readFileSync(filename, ...args) {
        return filename === path.join(root, `tools/data/${code}-map.json`) ? JSON.stringify(data) : fs.readFileSync(filename, ...args);
      } };
    },
    hexo: { base_dir: root, source_dir: path.join(root, 'source'), log: { warn: message => assert.fail(message) }, extend: {
      helper: { register(name, fn) { helpers[name] = fn; } }, filter: { register() {} }
    } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'themes/shiro/scripts/travel-journal.js'), 'utf8'), sandbox);
  const context = { page, url_for: value => value };
  return {
    data, photoPlace, notePlace,
    markup: helpers.travel_map_markup.call(context),
    payload: JSON.parse(helpers.travel_map_payload.call(context)),
    stats: JSON.parse(helpers.travel_journal_payload.call(context)).stats.byPlace
  };
}

test('中日地图双轮廓和淡排线不改变地理路径、照片权重或零照片底色', () => {
  for (const code of ['china', 'japan']) {
    const map = renderSketchMap(code);
    const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${map.markup}</svg>`);
    try {
      const svg = dom.window.document.querySelector('svg');
      const source = svg.querySelector('#travelTerrainOutline');
      assert.equal(source.getAttribute('d'), map.data.outlinePath);
      const outlines = [...svg.querySelectorAll('use[href="#travelTerrainOutline"]')];
      assert.equal(outlines.length, 2);
      assert.ok(outlines[0].classList.contains('travel-map-outline--echo'));
      assert.equal(outlines[1].hasAttribute('transform'), false);
      assert.ok(svg.querySelector('#travelMapHatching'));
      assert.ok(svg.querySelector('#travelMapInkDot'));
      assert.ok(svg.querySelector('#travelMapSelectionRing'));
      assert.ok(svg.querySelector('#travelMapHeart'));
      const ids = [...svg.querySelectorAll('[id]')].map(node => node.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const place of mapPlaces(map.data, countryFor({ travel_country: code }))) {
        const base = svg.querySelector(`.travel-map-cities>path[data-city-id="${place.id}"]`);
        assert.equal(base.getAttribute('d'), place.path, place.id);
        assert.equal(base.getAttribute('style'), `--travel-photo-weight:${map.stats[place.id].weight}`);
        const hatch = svg.querySelector(`.travel-map-hatching>path[data-hatch-city-id="${place.id}"]`);
        assert.equal(!!hatch, map.stats[place.id].photos > 0, place.id);
        if (hatch) {
          assert.equal(hatch.getAttribute('d'), place.path);
          assert.equal(hatch.hasAttribute('data-city-id'), false);
          assert.equal(hatch.parentElement.getAttribute('pointer-events'), 'none');
        }
      }
      assert.equal(map.stats[map.photoPlace.id].weight, '80.00%');
      assert.equal(map.stats[map.notePlace.id].weight, '0.00%');
      if (map.data.inset) assert.equal(svg.querySelectorAll('.travel-map-inset .travel-map-outline').length, 2);
      assert.equal(svg.querySelectorAll('filter,feTurbulence,feDisplacementMap').length, 0);
      assert.equal(map.markup, renderSketchMap(code).markup);
    } finally { dom.window.close(); }
  }
});

test('手绘样式共用主题令牌，保留小地名可读性，胶带只作用于相册预览', () => {
  const css = fs.readFileSync(path.join(__dirname, '../themes/shiro/source/css/travel-journal.css'), 'utf8');
  const rule = selector => {
    const start = css.indexOf(`\n${selector} {`);
    assert.notEqual(start, -1, selector);
    return css.slice(start + 1, css.indexOf('}', start));
  };
  assert.match(rule('.travel-map-province-border'), /stroke-dasharray:3 4/);
  assert.match(rule('.travel-map-outline'), /stroke:var\(--pen\)/);
  assert.match(rule('.travel-map-outline--echo'), /opacity:\.26/);
  assert.match(rule('.travel-map-hatch'), /fill:url\(#travelMapHatching\)/);
  assert.match(rule('.travel-map-city.is-recorded'), /var\(--travel-photo-weight,22%\)/);
  assert.match(rule('.travel-province-shadow'), /fill:var\(--pen-soft\).*pointer-events:none/);
  assert.doesNotMatch(css, /\.travel-province-surface\s*\{[^}]*filter:/);
  for (const selector of ['.travel-province-city-label.is-recorded', '.travel-map-province-label.is-recorded', '.travel-map-label.is-recorded']) {
    assert.match(rule(selector), /font-family:var\(--hand\)/);
  }
  assert.match(rule('.travel-province-city-label'), /font:12px var\(--sans\)/);
  assert.match(rule('.travel-map-province-label'), /font:11px var\(--sans\)/);
  assert.match(rule('.travel-map-marker'), /fill:var\(--pen\)/);
  assert.match(rule('.travel-map-selection-ring'), /fill:none;stroke:var\(--accent\)/);
  assert.match(rule('.travel-map-heart'), /fill:var\(--accent\)/);
  const countryWave = rule('.travel-country-tabs a[aria-current=page]>span::after');
  assert.match(countryWave, /mask:var\(--squiggle\)/);
  assert.doesNotMatch(countryWave, /text-decoration:underline/);
  assert.match(rule('.travel-photo-open::before,.travel-photo-open::after'), /opacity:\.7.*pointer-events:none/);
  assert.match(rule('.travel-photo figcaption'), /font:13px\/1\.7 var\(--hand\)/);
  assert.match(rule('.travel-photo-open'), /transform:rotate\(var\(--travel-photo-tilt\)\)/);
  assert.match(rule('.travel-photo-viewer img'), /border-radius:3px/);
  assert.match(css, /@media print[^]*\.travel-photo-open \{transform:none;\}/);
});

async function sketchMapFixture(code) {
  const previous = Object.fromEntries(['window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, global[key]]));
  const cities = [
    { id: '330100', name: '杭州市', province: '浙江省', center: [40, 50], path: 'M25 35L55 35L55 65L25 65Z' },
    { id: '330200', name: '宁波市', province: '浙江省', center: [80, 50], path: 'M65 35L95 35L95 65L65 65Z' },
    { id: '320100', name: '南京市', province: '江苏省', center: [140, 120], path: 'M125 105L155 105L155 135L125 135Z' }
  ];
  const provinces = code === 'japan' ? cities.map((city, index) => ({ ...city,
    id: ['JP-26', 'JP-28', 'JP-13'][index], name: ['京都府', '兵库县', '东京都'][index] })) : [
    { id: '33', name: '浙江省', center: [60, 50], path: 'M25 35L95 35L95 65L25 65Z' },
    { id: '32', name: '江苏省', center: [140, 120], path: cities[2].path }
  ];
  const map = renderSketchMap(code, { viewBox: [0, 0, 200, 160], cities, provinces,
    outlinePath: 'M10 10L190 10L190 150L10 150Z' });
  const dom = new JSDOM(`<div id="root" data-country="${code}" data-map-level="${code === 'japan' ? 'province' : 'city'}">
    <svg id="travelMap" viewBox="0 0 200 160"><g id="travelMapCanvas">${map.markup}</g></svg>
    <div id="travelMapStatus" hidden></div><button id="travelRetry"></button><div id="travelMapTooltip" hidden></div>
    <button data-travel-zoom="in"></button><button data-travel-zoom="out"></button><button data-travel-zoom="reset"></button>
    <script id="travelMapData" type="application/json">${JSON.stringify(map.payload)}</script></div>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global.ResizeObserver = class { observe() {} };
  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};
  dom.window.matchMedia = query => ({ matches: true, addEventListener() {} });
  const svg = dom.window.document.querySelector('svg');
  Object.defineProperty(svg, 'viewBox', { get() {
    const [x, y, width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
    return { baseVal: { x, y, width, height } };
  } });
  const prototype = dom.window.SVGElement.prototype;
  prototype.getScreenCTM = function () {
    const focus = this.closest('#travelProvinceFocus');
    const focusScale = Number(focus?.getAttribute('transform')?.match(/scale\(([^)]+)\)/)?.[1]) || 1;
    const scale = 200 / svg.viewBox.baseVal.width * focusScale;
    return { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 };
  };
  prototype.getBBox = function () {
    if (this.tagName === 'text') {
      const size = parseFloat(this.style.fontSize) || 12;
      return { x: 0, y: -size / 2, width: this.childNodes[0].textContent.length * size * .6, height: size };
    }
    const place = map.payload.places.find(place => place.id === this.dataset.cityId);
    const [x, y] = place?.center || [60, 50];
    return { x: x - 15, y: y - 15, width: 30, height: 30 };
  };
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(matrix) { return { x: this.x * matrix.a, y: this.y * matrix.d }; } });
  const { createMap } = await import('../themes/shiro/source/js/travel/map.mjs');
  const selections = [];
  const errors = [];
  dom.window.addEventListener('error', event => errors.push(event.error));
  const controller = createMap({ root: document.getElementById('root'), stats: map.stats,
    defaultPlace: map.photoPlace.id, onSelect: id => selections.push(id), onError: error => errors.push(error) });
  return { ...map, controller, svg, selections, errors, dom, dispose() {
    dom.window.close();
    Object.entries(previous).forEach(([key, value]) => { if (value === undefined) delete global[key]; else global[key] = value; });
  } };
}

test('地图初始化、缩放和回图保留手画圈、爱心与零照片纹理规则', async () => {
  for (const code of ['china', 'japan']) {
    const f = await sketchMapFixture(code);
    try {
      f.controller.initialize();
      assert.deepEqual(f.errors, []);
      assert.equal(f.controller.ready, true);
      assert.equal(f.svg.querySelectorAll('.travel-map-hatch').length, 1);
      const originalPathCount = f.svg.querySelectorAll('path[data-city-id]').length;
      f.controller.select(f.photoPlace.id);
      const ring = f.svg.querySelector('.travel-map-selection-ring');
      assert.ok(ring);
      const mainScale = 200 / f.svg.viewBox.baseVal.width;
      assert.match(ring.getAttribute('transform'), new RegExp(`scale\\(${1 / mainScale}\\)`));
      assert.equal(f.svg.querySelectorAll('.travel-map-hatch').length, 1);
      assert.equal(f.svg.querySelectorAll('path[data-city-id]').length, originalPathCount);
      if (code === 'china') {
        assert.ok(f.svg.querySelector('.travel-map-heart'));
        assert.ok(f.svg.querySelector('.travel-map-label.is-recorded'));
      } else assert.ok(f.svg.querySelector('.travel-map-province-label.is-recorded'));
      document.querySelector('[data-travel-zoom="in"]').click();
      const ringScale = Number(f.svg.querySelector('.travel-map-selection-ring').getAttribute('transform').match(/scale\(([^)]+)\)/)[1]);
      assert.ok(Math.abs(ringScale - f.svg.viewBox.baseVal.width / 200) < 1e-10);
      const third = f.payload.places.find(place => ![f.photoPlace.id, f.notePlace.id].includes(place.id));
      f.controller.select(third.id);
      assert.ok(f.svg.querySelector('.travel-map-marker[href="#travelMapInkDot"]'));
      assert.equal(f.svg.querySelectorAll('.travel-map-label.is-recorded').length, 0);
      f.controller.showAtlas();
      assert.equal(f.svg.querySelectorAll('.travel-map-selection-ring').length, 0);
      assert.equal(f.svg.querySelectorAll('.travel-map-hatch').length, 1);
      if (code === 'china') {
        const event = new f.dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 50 });
        Object.defineProperties(event, { pointerType: { value: 'mouse' }, pointerId: { value: 1 } });
        f.svg.querySelector(`path[data-city-id="${f.photoPlace.id}"]`).dispatchEvent(event);
        const focus = f.svg.querySelector('#travelProvinceFocus');
        assert.ok(focus);
        assert.ok(focus.querySelector('.travel-province-shadow'));
        assert.equal(focus.querySelector('.travel-province-shadow').querySelectorAll('[data-city-id]').length, 0);
        assert.equal(focus.querySelectorAll('.travel-map-hatch').length, 1);
        assert.equal(focus.querySelectorAll('.travel-province-city-label.is-recorded').length, 2);
        assert.equal(focus.querySelectorAll('.travel-province-city-label:not(.is-recorded)').length, 0);
        focus.querySelector('.travel-province-city-label').dispatchEvent(new f.dom.window.MouseEvent('click', { bubbles: true }));
        assert.equal(f.selections.length, 1);
      }
      f.stats[f.photoPlace.id] = { recorded: true, photos: 0, weight: '0.00%' };
      f.controller.initialize();
      assert.deepEqual(f.errors, []);
      assert.equal(f.svg.querySelectorAll('.travel-map-hatch').length, 0);
    } finally { f.dispose(); }
  }
});

function jpegWithLargePreview() {
  const tiff = Buffer.alloc(26);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(274, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const appHeader = Buffer.from([0xff, 0xe1, 0, exif.length + 2]);
  const preview = Buffer.alloc(65537);
  preview.set([0xff, 0xe2, 0xff, 0xff]);
  const frame = Buffer.from([0xff, 0xc0, 0, 11, 8, 1, 44, 1, 144, 1, 1, 0x11, 0, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), appHeader, exif, ...Array(9).fill(preview), frame]);
}

test('image metadata validates Linux casing and reads EXIF rotation beyond a large JPEG preview', async () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-metadata-test-'));
  try {
    const folder = path.join(sourceDir, 'images/travel');
    fs.mkdirSync(folder, { recursive: true });
    const original = jpegWithLargePreview();
    const filename = path.join(folder, 'Rotated.jpg');
    fs.writeFileSync(filename, original);
    const photo = { src: '/images/travel/Rotated.jpg' };
    const journal = { albums: { one: { entries: [{ photos: [photo] }] } } };
    await addTravelImageMetadata(journal, { sourceDir });
    assert.deepEqual(photo, { src: '/images/travel/Rotated.jpg', width: 300, height: 400, sizeBytes: original.length });
    assert.deepEqual(fs.readFileSync(filename), original);
    const wrongCase = { albums: { one: { entries: [{ photos: [{ src: '/images/travel/rotated.jpg' }] }] } } };
    await assert.rejects(addTravelImageMetadata(wrongCase, { sourceDir }), /大小写不一致/);
    const missing = { albums: { one: { entries: [{ photos: [{ src: '/images/travel/missing.jpg' }] }] } } };
    await assert.rejects(addTravelImageMetadata(missing, { sourceDir, pageSource: 'journal/Japan.md' }), /journal\/Japan.md.*\n.*missing.jpg/s);
  } finally {
    assert.equal(path.dirname(path.resolve(sourceDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sourceDir).startsWith('journal-metadata-test-'));
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
});
