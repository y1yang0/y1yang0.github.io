const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// A Journal entry revision also covers its modules, whose imports inherit it.
const revisions = new Map();
hexo.extend.filter.register('before_generate', () => revisions.clear());
hexo.extend.helper.register('journal_asset', function (asset) {
  if (!revisions.has(asset)) {
    const files = [asset];
    if (asset === 'js/travel-journal.js') {
      files.push(...readdirSync(join(hexo.theme_dir, 'source/js/travel'))
        .filter(name => name.endsWith('.mjs')).sort().map(name => `js/travel/${name}`));
    }
    const digest = createHash('sha256');
    for (const file of files) {
      digest.update(file).update('\0').update(readFileSync(join(hexo.theme_dir, 'source', file))).update('\0');
    }
    revisions.set(asset, digest.digest('hex').slice(0, 12));
  }
  return `${this.url_for(asset)}?v=${revisions.get(asset)}`;
});
