'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { escapeHTML } = require('hexo-util');
const { serializeJournal } = require(path.join(hexo.base_dir, 'tools/travel-markdown'));
const { countries, countryFor } = require(path.join(hexo.base_dir, 'tools/travel-countries'));
const { compileJournal, mapPlaces } = require(path.join(hexo.base_dir, 'tools/travel-journal'));
const { addTravelImageMetadata, applyTravelImageMetadata } = require(path.join(hexo.base_dir, 'tools/travel-image-metadata'));

let mapData = new Map();
let journals = new WeakMap();
let imageMetadata = new Map();
hexo.extend.helper.register('travel_country', function (page = this.page) { return countryFor(page); });
hexo.extend.helper.register('travel_countries', () => countries);
hexo.extend.filter.register('before_generate', async () => {
  mapData = new Map();
  journals = new WeakMap();
  imageMetadata = new Map();
  const pages = [...hexo.locals.get('pages').toArray(), ...hexo.locals.get('posts').toArray()];
  for (const page of pages.filter(page => page.travel_journal)) {
    await addTravelImageMetadata(readJournal(page), {
      sourceDir: hexo.source_dir, pageSource: page.source, metadata: imageMetadata
    });
  }
});

function readMap(page) {
  const { code } = countryFor(page);
  if (!mapData.has(code)) mapData.set(code, JSON.parse(fs.readFileSync(path.join(hexo.base_dir, `tools/data/${code}-map.json`), 'utf8')));
  return mapData.get(code);
}

function readJournal(page) {
  if (page && journals.has(page)) return journals.get(page);
  let markdown = typeof page?._content === 'string' && page._content.trim() ? page._content : page?.raw;
  if ((typeof markdown !== 'string' || !markdown.trim()) && typeof page?.source === 'string') {
    const source = path.resolve(hexo.source_dir, page.source);
    if (source.startsWith(`${path.resolve(hexo.source_dir)}${path.sep}`)) markdown = fs.readFileSync(source, 'utf8');
  }
  const journal = compileJournal(markdown, {
    data: readMap(page), country: countryFor(page),
    onWarning: message => hexo.log.warn(`[旅行相册] ${page?.source || 'travel-journal'}：${message}`)
  });
  applyTravelImageMetadata(journal, imageMetadata);
  if (page && typeof page === 'object') journals.set(page, journal);
  return journal;
}

function element(tag, attributes, content = '') {
  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeHTML(String(value))}"`).join('');
  return `<${tag}${attrs}>${content}</${tag}>`;
}

hexo.extend.helper.register('travel_journal_payload', function (page = this.page) {
  return serializeJournal(readJournal(page));
});

hexo.extend.helper.register('travel_journal_stats', function (page = this.page) {
  const { visited, total } = readJournal(page).stats.coverage;
  const coverage = total ? `${(visited / total * 100).toLocaleString('en', { maximumFractionDigits: 1 })}%` : '—';
  return { visited, total, coverage };
});

hexo.extend.helper.register('travel_map_viewbox', function () { return readMap(this.page).viewBox.join(' '); });

hexo.extend.helper.register('travel_map_payload', function () {
  const data = readMap(this.page);
  const places = mapPlaces(data, countryFor(this.page)).map(place => ({
    id: String(place.id),
    name: place.name,
    province: place.province,
    center: place.center,
    ...(place.insetCenter ? { insetCenter: place.insetCenter } : {})
  }));
  return serializeJournal({
    viewBox: data.viewBox,
    places,
    provinces: data.provinces.map(({ id, name, center, bounds }) => ({ id: String(id), name, center, bounds })),
    heartPlaces: countryFor(this.page).heartPlaces,
    ...(data.inset ? { inset: { viewBox: data.inset.viewBox, placement: data.inset.placement } } : {}),
    metadata: data.metadata
  });
});

hexo.extend.helper.register('travel_map_markup', function () {
  const data = readMap(this.page);
  const country = countryFor(this.page);
  const terrainEnabled = !!country.terrain;
  const places = mapPlaces(data, country);
  const journal = readJournal(this.page);
  const stats = place => journal.stats.byPlace[place.id];
  const photoCount = place => stats(place).photos;
  const recorded = place => stats(place).recorded;
  const photoWeight = place => stats(place).weight;
  const cityClass = city => `travel-map-city${recorded(city) ? ' is-recorded' : ''}`;
  const cityAttributes = city => ({
    'data-city-id': city.id,
    'data-photo-count': photoCount(city),
    class: cityClass(city),
    style: `--travel-photo-weight:${photoWeight(city)}`
  });
  const cityTitle = city => element('title', {}, escapeHTML(`${country.mapLevel === 'province' ? city.province : city.name}${recorded(city) ? ` · ${photoCount(city)} 张照片` : ''}`));
  const border = (d, className, attributes = {}) => element('path', { d, class: className, 'pointer-events': 'none', ...attributes });
  let markup = element('g', { class: 'travel-map-cities' }, places.map(city =>
    element('path', { d: city.path, ...cityAttributes(city) }, cityTitle(city))
  ).join(''));
  const outlineDefs = data.outlinePath ? element('defs', { class: 'travel-map-outline-defs' },
    element('path', { id: 'travelTerrainOutline', d: data.outlinePath, 'vector-effect': 'non-scaling-stroke' })
    + (terrainEnabled ? element('clipPath', { id: 'travelTerrainClip', clipPathUnits: 'userSpaceOnUse' },
      element('use', { href: '#travelTerrainOutline' })) : '')) : '';
  if (terrainEnabled && outlineDefs) markup += element('image', {
    href: this.url_for(country.terrain),
    x: data.viewBox[0], y: data.viewBox[1], width: data.viewBox[2], height: data.viewBox[3],
    preserveAspectRatio: 'none', class: 'travel-map-terrain',
    'clip-path': 'url(#travelTerrainClip)', 'pointer-events': 'none'
  });
  for (const province of data.provinces || []) {
    if (province.path) markup += border(province.path, 'travel-map-province-border', { 'data-province-name': province.name });
  }
  if (typeof data.provinceBorders === 'string') markup += border(data.provinceBorders, 'travel-map-province-border');
  if (data.outlinePath) markup += element('use', {
    href: '#travelTerrainOutline', class: 'travel-map-outline', 'pointer-events': 'none'
  });
  if (data.inset?.path && Array.isArray(data.inset.placement)) {
    const inset = data.inset;
    const [x, y, width, height] = inset.placement;
    let contents = element('rect', {
      x: 0, y: 0, width: inset.viewBox[2], height: inset.viewBox[3],
      class: 'travel-map-inset-frame', fill: 'none', 'pointer-events': 'none'
    });
    contents += border(inset.path, 'travel-map-outline');
    for (const city of places.filter(city => city.insetPath)) {
      contents += element('path', { d: city.insetPath, ...cityAttributes(city) }, cityTitle(city));
    }
    if (inset.dashedPath) contents += border(inset.dashedPath, 'travel-map-island-dashes');
    contents += element('text', {
      x: 8, y: inset.viewBox[3] - 5, class: 'travel-map-inset-label', 'pointer-events': 'none'
    }, escapeHTML(inset.label || '南海诸岛'));
    markup += element('svg', { x, y, width, height, viewBox: inset.viewBox.join(' '), class: 'travel-map-inset' }, contents);
  }
  const heart = element('defs', {}, element('path', {
    id: 'travelMapHeart',
    d: 'M0 3.2C-1 2.3-3.6 .7-3.6-1.3C-3.6-3.5-1.3-4.1 0-2.5C1.3-4.1 3.6-3.5 3.6-1.3C3.6 .7 1 2.3 0 3.2Z'
  }));
  const pins = country.heartPlaces.map(id => {
    const city = places.find(city => String(city.id) === id);
    if (!city?.center) return '';
    return element('g', { 'data-city-id': id, class: 'travel-map-pin' }, element('use', {
      href: '#travelMapHeart',
      transform: `translate(${city.center.join(' ')})`,
      class: 'travel-map-heart'
    }));
  }).join('');
  return heart + outlineDefs + markup
    + element('g', { class: 'travel-map-province-labels', 'pointer-events': 'none' })
    + element('g', { class: 'travel-map-markers' }, pins);
});
