'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { imageSize } = require('image-size');

async function readImageDimensions(filename) {
  const handle = await fs.promises.open(filename, 'r');
  try {
    const { size } = await handle.stat();
    let input = Buffer.alloc(0);
    while (input.length < size) {
      // Phone JPEGs may place a large embedded preview before the dimensions.
      // Grow only the header prefix as needed; do not decode image pixels.
      const nextSize = Math.min(size, Math.max(512 * 1024, input.length * 2));
      const next = Buffer.alloc(nextSize);
      input.copy(next);
      let offset = input.length;
      while (offset < nextSize) {
        const { bytesRead } = await handle.read(next, offset, nextSize - offset, offset);
        if (!bytesRead) throw new Error('图片读取未完成');
        offset += bytesRead;
      }
      input = next;
      try { return { ...imageSize(input), sizeBytes: size }; } catch (error) {
        if (input.length === size) throw error;
      }
    }
    throw new Error('图片文件为空');
  } finally {
    await handle.close();
  }
}

function localPhotoPath(src) {
  if (typeof src !== 'string' || /^https?:\/\//i.test(src)) return null;
  const pathname = decodeURIComponent(new URL(src, 'https://travel.invalid').pathname);
  if (!pathname.startsWith('/images/travel/') || pathname.includes('\\')) {
    throw new Error(`照片路径无效：${src}`);
  }
  return pathname;
}

function closestName(name, entries) {
  // A small spelling hint is useful for a missing file, while exact casing is
  // checked separately so Windows preview catches Linux deployment failures.
  const distance = (left, right) => {
    let row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      const next = [i];
      for (let j = 1; j <= right.length; j++) {
        next[j] = Math.min(next[j - 1] + 1, row[j] + 1,
          row[j - 1] + Number(left[i - 1] !== right[j - 1]));
      }
      row = next;
    }
    return row[right.length];
  };
  const candidates = entries.map(entry => ({
    name: entry.name, distance: distance(name.toLowerCase(), entry.name.toLowerCase())
  })).sort((left, right) => left.distance - right.distance);
  return candidates[0]?.distance <= Math.max(2, Math.floor(name.length / 4)) ? candidates[0].name : null;
}

function resolveExactPhoto(sourceDir, pathname, directories) {
  const segments = pathname.slice(1).split('/');
  let current = path.resolve(sourceDir);
  const actualSegments = [];
  let caseMismatch = false;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment || segment === '.' || segment === '..') throw new Error(`照片路径无效：${pathname}`);
    let entries = directories.get(current);
    if (!entries) {
      entries = fs.readdirSync(current, { withFileTypes: true });
      directories.set(current, entries);
    }
    const entry = entries.find(entry => entry.name === segment)
      || entries.find(entry => entry.name.toLowerCase() === segment.toLowerCase());
    if (!entry) {
      const suggestedName = closestName(segment, entries);
      const suggestion = suggestedName
        ? `；相近文件：/${[...actualSegments, suggestedName, ...segments.slice(index + 1)].join('/')}` : '';
      throw new Error(`找不到本地图片：${pathname}（预期文件 source${pathname}）${suggestion}`);
    }
    actualSegments.push(entry.name);
    caseMismatch ||= entry.name !== segment;
    if (entry.isSymbolicLink() || (index < segments.length - 1 ? !entry.isDirectory() : !entry.isFile())) {
      throw new Error(`图片路径必须指向 source 内的普通文件：${pathname}`);
    }
    current = path.join(current, entry.name);
  }
  if (caseMismatch) {
    throw new Error(`图片路径大小写不一致：${pathname}；实际文件：/${actualSegments.join('/')}，请修改 Markdown 链接`);
  }
  return current;
}

function eachPhoto(journal) {
  return Object.values(journal.cities || {}).flatMap(city =>
    (city.entries || []).flatMap(entry => entry.photos || []));
}

function applyTravelImageMetadata(journal, metadata) {
  for (const photo of eachPhoto(journal)) {
    const pathname = localPhotoPath(photo.src);
    const dimensions = pathname && metadata.get(pathname);
    if (dimensions) Object.assign(photo, dimensions);
  }
  return journal;
}

async function addTravelImageMetadata(journal, { sourceDir, pageSource = 'journal/index.md', metadata = new Map() }) {
  const directories = new Map();
  const errors = new Set();
  for (const photo of eachPhoto(journal)) {
    try {
      const pathname = localPhotoPath(photo.src);
      if (!pathname || metadata.has(pathname)) continue;
      const filename = resolveExactPhoto(sourceDir, pathname, directories);
      // Read just enough of the header without resizing, converting, or
      // writing the original photograph.
      const dimensions = await readImageDimensions(filename);
      const rotate = [5, 6, 7, 8].includes(dimensions.orientation);
      const width = rotate ? dimensions.height : dimensions.width;
      const height = rotate ? dimensions.width : dimensions.height;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('未能读取有效图片尺寸');
      }
      metadata.set(pathname, { width, height, sizeBytes: dimensions.sizeBytes });
    } catch (error) {
      errors.add(`链接 ${photo.src}：${error.message}`);
    }
  }
  if (errors.size) throw new Error(`[旅行相册] source/${pageSource}：\n${[...errors].join('\n')}`);
  return applyTravelImageMetadata(journal, metadata);
}

module.exports = { addTravelImageMetadata, applyTravelImageMetadata };
