const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// A Journal entry revision also covers its modules, whose imports inherit it.
const revisions = new Map();
const journalModules = () => [
  ...readdirSync(join(hexo.theme_dir, 'source/js/travel'))
    .filter(name => name.endsWith('.mjs')).sort().map(name => `js/travel/${name}`),
  'js/image-loading.mjs'
];
hexo.extend.filter.register('before_generate', () => revisions.clear());
function journalAsset(asset) {
  if (!revisions.has(asset)) {
    const files = [asset];
    if (asset === 'js/travel-journal.js') files.push(...journalModules());
    const digest = createHash('sha256');
    for (const file of files) {
      digest.update(file).update('\0').update(readFileSync(join(hexo.theme_dir, 'source', file))).update('\0');
    }
    revisions.set(asset, digest.digest('hex').slice(0, 12));
  }
  return `${this.url_for(asset)}?v=${revisions.get(asset)}`;
}
hexo.extend.helper.register('journal_asset', journalAsset);
// 入口在长篇 HTML 之后才被发现，动态导入又要再等一轮；提前并行预取整条模块链。
hexo.extend.helper.register('journal_module_preloads', function () {
  const entry = journalAsset.call(this, 'js/travel-journal.js');
  const revision = entry.slice(entry.indexOf('?'));
  return [entry, ...journalModules().map(file => `${this.url_for(file)}${revision}`)];
});
