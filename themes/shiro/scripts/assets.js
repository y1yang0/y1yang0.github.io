const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Update style/font URLs with their contents so cached themes cannot mask a change.
const revisions = new Map();
hexo.extend.filter.register('before_generate', () => revisions.clear());
hexo.extend.helper.register('journal_asset', function (asset) {
  if (!revisions.has(asset)) {
    const contents = readFileSync(join(hexo.theme_dir, 'source', asset));
    revisions.set(asset, createHash('sha256').update(contents).digest('hex').slice(0, 12));
  }
  return `${this.url_for(asset)}?v=${revisions.get(asset)}`;
});
