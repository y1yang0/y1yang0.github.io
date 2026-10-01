'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { escapeHTML } = require('hexo-util');
const { parseTravelMarkdown, serializeJournal } = require(path.join(hexo.base_dir, 'tools/travel-markdown'));
const { addTravelImageMetadata, applyTravelImageMetadata } = require(path.join(hexo.base_dir, 'tools/travel-image-metadata'));

let mapData;
let journals = new WeakMap();
let imageMetadata = new Map();
const heartCityIds = ['330100', '510600'];
hexo.extend.filter.register('before_generate', async () => {
  mapData = undefined;
  journals = new WeakMap();
  imageMetadata = new Map();
  const pages = [...hexo.locals.get('pages').toArray(), ...hexo.locals.get('posts').toArray()];
  for (const page of pages.filter(page => page.travel_journal)) {
    await addTravelImageMetadata(readJournal(page), {
      sourceDir: hexo.source_dir, pageSource: page.source, metadata: imageMetadata
    });
  }
});

function readMap() {
  if (!mapData) mapData = JSON.parse(fs.readFileSync(path.join(hexo.source_dir, 'travel/china-cities.json'), 'utf8'));
  return mapData;
}

function readJournal(page) {
  if (page && journals.has(page)) return journals.get(page);
  // _content is the unrendered body when Hexo still exposes it; raw survives
  // rendering and contains the original Markdown with its front matter.
  let markdown = typeof page?._content === 'string' && page._content.trim() ? page._content : page?.raw;
  if ((typeof markdown !== 'string' || !markdown.trim()) && typeof page?.source === 'string') {
    const source = path.resolve(hexo.source_dir, page.source);
    if (source.startsWith(`${path.resolve(hexo.source_dir)}${path.sep}`)) markdown = fs.readFileSync(source, 'utf8');
  }
  const journal = parseTravelMarkdown(markdown, {
    cities: readMap().cities,
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
  return serializeJournal({ ...readJournal(page), totalCities: readMap().cities.length });
});

hexo.extend.helper.register('travel_journal_stats', function (page = this.page) {
  const visited = Object.values(readJournal(page).cities).filter(city => city.entries.length).length;
  const total = readMap().cities.length;
  const coverage = total ? `${(visited / total * 100).toLocaleString('en', { maximumFractionDigits: 1 })}%` : '—';
  return { visited, total, coverage };
});

hexo.extend.helper.register('travel_map_viewbox', () => readMap().viewBox.join(' '));

hexo.extend.helper.register('travel_map_payload', () => {
  const data = readMap();
  const cities = data.cities.map(city => ({
    id: String(city.id),
    name: city.name,
    province: city.province,
    ...(city.pinyin ? { pinyin: city.pinyin } : {}),
    ...(city.aliases ? { aliases: city.aliases } : {}),
    center: city.center,
    ...(city.insetCenter ? { insetCenter: city.insetCenter } : {})
  }));
  return serializeJournal({
    viewBox: data.viewBox,
    cities,
    provinces: data.provinces.map(({ id, name, center, bounds }) => ({ id: String(id), name, center, bounds })),
    heartCities: heartCityIds,
    ...(data.inset ? { inset: { viewBox: data.inset.viewBox, placement: data.inset.placement } } : {}),
    metadata: data.metadata
  });
});

hexo.extend.helper.register('travel_map_markup', function () {
  const data = readMap();
  const journal = readJournal(this.page);
  const photoCount = id => (journal.cities[id]?.entries || []).reduce((sum, entry) =>
    sum + (entry.photos || []).filter(photo => photo && typeof photo.src === 'string').length, 0);
  const maxPhotoCount = Math.max(1, ...Object.keys(journal.cities).map(photoCount));
  // Match the client map's logarithmic scale; equal photo counts share a color.
  const photoWeight = id => {
    const count = photoCount(id);
    const weight = count ? 22 + (maxPhotoCount > 1 ? 58 * Math.log(count) / Math.log(maxPhotoCount) : 0) : 0;
    return `${weight.toFixed(2)}%`;
  };
  const cityClass = city => `travel-map-city${journal.cities[city.id]?.entries?.length ? ' is-recorded' : ''}`;
  const cityAttributes = city => ({
    'data-city-id': city.id,
    'data-photo-count': photoCount(city.id),
    class: cityClass(city),
    style: `--travel-photo-weight:${photoWeight(city.id)}`
  });
  const cityTitle = city => element('title', {}, escapeHTML(`${city.name}${journal.cities[city.id]?.entries?.length ? ` · ${photoCount(city.id)} 张照片` : ''}`));
  const border = (d, className) => element('path', { d, class: className, 'pointer-events': 'none' });
  let markup = element('g', { class: 'travel-map-cities' }, data.cities.map(city =>
    element('path', { d: city.path, ...cityAttributes(city) }, cityTitle(city))
  ).join(''));
  for (const province of data.provinces || []) {
    if (province.path) markup += border(province.path, 'travel-map-province-border');
  }
  if (typeof data.provinceBorders === 'string') markup += border(data.provinceBorders, 'travel-map-province-border');
  if (data.outlinePath) markup += border(data.outlinePath, 'travel-map-outline');
  if (data.inset?.path && Array.isArray(data.inset.placement)) {
    const inset = data.inset;
    const [x, y, width, height] = inset.placement;
    let contents = element('rect', {
      x: 0, y: 0, width: inset.viewBox[2], height: inset.viewBox[3],
      class: 'travel-map-inset-frame', fill: 'none', 'pointer-events': 'none'
    });
    contents += border(inset.path, 'travel-map-outline');
    for (const city of data.cities.filter(city => city.insetPath)) {
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
  const pins = heartCityIds.map(id => {
    const city = data.cities.find(city => String(city.id) === id);
    if (!city?.center) return '';
    return element('g', { 'data-city-id': id, class: 'travel-map-pin' }, element('use', {
      href: '#travelMapHeart',
      transform: `translate(${city.center.join(' ')})`,
      class: 'travel-map-heart'
    }));
  }).join('');
  return heart + markup
    + element('g', { class: 'travel-map-province-labels', 'pointer-events': 'none' })
    + element('g', { class: 'travel-map-markers' }, pins);
});
