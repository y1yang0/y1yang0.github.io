'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

const settings = {
  autoOrient: true,
  width: 960,
  height: 960,
  fit: 'inside',
  withoutEnlargement: true,
  format: 'webp',
  quality: 72,
  effort: 4
};
const recipe = JSON.stringify(settings);
const rasterExtension = /\.(?:jpe?g|png|webp|avif)$/i;

async function buildTravelThumbnails({ sourceDir, cacheDir }) {
  const travelDir = path.join(sourceDir, 'images', 'travel');
  const photos = new Map();
  const thumbnails = new Map();
  try {
    const directory = await fs.lstat(travelDir);
    if (!directory.isDirectory() || directory.isSymbolicLink()) return { photos, routes: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { photos, routes: [] };
    throw error;
  }

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    // Keep generation order stable, and process one image at a time to avoid
    // retaining several full-resolution photographs in memory.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.isFile() && rasterExtension.test(entry.name)) {
        try {
          const original = await fs.readFile(file);
          const hash = createHash('sha256').update(recipe).update(original).digest('hex');
          let thumbnail = thumbnails.get(hash);
          if (!thumbnail) {
            const route = `images/travel-thumbnails/${hash}.webp`;
            const cachedFile = path.join(cacheDir, `${hash}.webp`);
            let data;
            let width;
            let height;
            try {
              data = await fs.readFile(cachedFile);
              ({ width, height } = await sharp(data).metadata());
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              const output = await sharp(original)
                .rotate()
                .resize(settings.width, settings.height, {
                  fit: settings.fit,
                  withoutEnlargement: settings.withoutEnlargement
                })
                .webp({ quality: settings.quality, effort: settings.effort })
                .toBuffer({ resolveWithObject: true });
              data = output.data;
              ({ width, height } = output.info);
              await fs.mkdir(cacheDir, { recursive: true });
              await fs.writeFile(cachedFile, data);
            }
            thumbnail = { path: route, data, width, height };
            thumbnails.set(hash, thumbnail);
          }
          const relative = path.relative(travelDir, file).split(path.sep).join('/');
          photos.set(`/images/travel/${relative}`, {
            thumbnail: `/${thumbnail.path}`,
            width: thumbnail.width,
            height: thumbnail.height
          });
        } catch (error) {
          throw new Error(`Cannot build travel thumbnail for ${file}: ${error.message}`, { cause: error });
        }
      }
      // Dirent.isFile/isDirectory deliberately leave symlinks untouched.
    }
  }

  await visit(travelDir);
  return {
    photos,
    routes: Array.from(thumbnails.values(), ({ path, data }) => ({ path, data }))
  };
}

module.exports = { buildTravelThumbnails };
