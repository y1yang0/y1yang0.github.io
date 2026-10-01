'use strict';

const path = require('node:path');
// Use the same Markdown lexer as Hexo, including reference images and escaped
// destinations. Parsing tokens keeps code samples out of the photo albums.
const { lexer } = require(require.resolve('marked', {
  paths: [path.dirname(require.resolve('hexo-renderer-marked'))]
}));
const { decodeHTML } = require(require.resolve('entities', {
  paths: [path.dirname(require.resolve('htmlparser2'))]
}));

function normalizedName(value) {
  return String(value).normalize('NFKC').trim().toLowerCase();
}

function resolveCity(cities, value) {
  const key = normalizedName(value);
  const byId = cities.find(city => normalizedName(city.id) === key);
  if (byId) return byId;
  const matches = cities.filter(city => [city.name,
    city.name.replace(/(?:特别行政区|市|地区|自治州|盟)$/u, ''), ...(city.aliases || [])]
    .some(name => normalizedName(name) === key));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`城市“${value}”有重名，请用城市 ID：${matches.map(city => `${city.name} (${city.id})`).join('、')}`);
  }
  throw new Error(`未找到城市“${value}”，请使用地图中的城市名或城市 ID。`);
}

function stripFrontMatter(markdown) {
  return String(markdown || '').replace(/^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
}

function normalizePhotoUrl(value) {
  const destination = decodeHTML(String(value || '')).trim();
  if (/^https?:\/\//i.test(destination)) {
    try { return new URL(destination).href; } catch (_) { return ''; }
  }
  // Travel image paths are resolved from the site root. A leading ./ or ../
  // is an authoring convenience, never a route to the page folder.
  const match = destination.match(/^(?:(?:\.{1,2}\/)+)?\/?images\/travel\/(.+)$/u);
  if (!match || match[1].includes('\\')) return '';
  try {
    const url = new URL(`/images/travel/${match[1]}`, 'https://travel.invalid');
    if (!url.pathname.startsWith('/images/travel/') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodeURIComponent(url.pathname))) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_) { return ''; }
}

function inlineParts(tokens) {
  const photos = [];
  let text = '';
  for (const token of tokens || []) {
    if (token.type === 'image') {
      photos.push({ href: token.href, alt: decodeHTML(token.text || '') });
    } else if (token.type === 'br') {
      text += '\n';
    } else if (token.tokens) {
      const nested = inlineParts(token.tokens);
      photos.push(...nested.photos);
      text += nested.text;
    } else if (token.type !== 'html') {
      text += decodeHTML(token.text || '');
    }
  }
  return { photos, text: text.trim() };
}

function parseTravelMarkdown(markdown, { cities = [], onWarning = () => {}, defaultCity = '330100' } = {}) {
  const records = new Map();
  let currentCity = null;
  let currentTitle = '';
  let currentEntry = null;

  function append(parts) {
    if (!currentCity) {
      if (parts.photos.length) onWarning('照片未归属城市，已跳过。请在照片前添加“# 杭州”一类城市标题。');
      return;
    }
    const photos = [];
    for (const image of parts.photos) {
      const src = normalizePhotoUrl(image.href);
      if (!src) {
        onWarning(`城市“${currentCity.name}”的照片路径无效：${image.href}。照片请放在 images/travel/。`);
        continue;
      }
      const caption = image.alt.trim();
      photos.push({ src, alt: caption, caption });
    }
    if (!photos.length && !parts.text) return;
    let album = records.get(currentCity.id);
    if (!album) {
      album = { city: currentCity, entries: [] };
      records.set(currentCity.id, album);
    }
    if (!currentEntry) {
      // Photos without a place heading retain the original single-entry
      // format, including when the same city appears again in the post.
      currentEntry = !currentTitle && album.entries.find(entry => !entry.title);
      if (!currentEntry) {
        currentEntry = { ...(currentTitle ? { title: currentTitle } : {}), photos: [], notes: [] };
        album.entries.push(currentEntry);
      }
    }
    currentEntry.photos.push(...photos);
    if (parts.text) currentEntry.notes.push(parts.text);
  }

  function visit(tokens) {
    for (const token of tokens) {
      if (token.type === 'heading' && token.depth <= 2) {
        const parts = inlineParts(token.tokens);
        // A photograph with an accidental leading # remains a photograph.
        if (!parts.text && parts.photos.length) {
          append(parts);
          continue;
        }
        currentEntry = null;
        if (token.depth === 1) {
          currentCity = null;
          currentTitle = '';
          try { currentCity = resolveCity(cities, parts.text); } catch (error) { onWarning(error.message); }
        } else {
          // Second-level headings are places within the selected city. Even
          // a place named after another city must not change the city context.
          currentTitle = parts.text;
        }
        if (currentCity && parts.photos.length) append({ photos: parts.photos, text: '' });
      } else if (['paragraph', 'heading', 'text'].includes(token.type)) {
        append(inlineParts(token.tokens || [{ type: 'text', text: token.text }]));
      } else if (token.type === 'blockquote') {
        visit(token.tokens);
      } else if (token.type === 'list') {
        token.items.forEach(item => visit(item.tokens));
      }
      // Code, HTML and definitions have no album content. Their Markdown-like
      // text must not create cities or photos.
    }
  }
  visit(lexer(stripFrontMatter(markdown)));

  const result = {};
  for (const [id, album] of records) {
    const entries = album.entries.filter(entry => entry.photos.length || entry.notes.length).map(entry => ({
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.photos.length ? { photos: entry.photos } : {}),
      ...(entry.notes.length ? { notes: entry.notes } : {})
    }));
    if (!entries.length) continue;
    result[id] = { name: album.city.name, entries };
  }
  return { defaultCity: String(defaultCity), cities: result };
}

function serializeJournal(journal) {
  return JSON.stringify(journal).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

module.exports = { normalizePhotoUrl, parseTravelMarkdown, resolveCity, serializeJournal, stripFrontMatter };
