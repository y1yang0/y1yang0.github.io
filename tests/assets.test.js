'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

test('Journal module edits invalidate the entry URL and remain stable between builds', t => {
  const themeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-assets-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(themeDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(themeDir).startsWith('journal-assets-'));
    fs.rmSync(themeDir, { recursive: true, force: true });
  });
  const sourceDir = path.join(themeDir, 'source');
  const modulesDir = path.join(sourceDir, 'js/travel');
  fs.mkdirSync(modulesDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'js/travel-journal.js'), '/* entry */');
  fs.writeFileSync(path.join(modulesDir, 'map.mjs'), 'export const version = 1;');
  fs.writeFileSync(path.join(modulesDir, 'viewer.mjs'), 'export const viewer = true;');
  const helpers = {}, filters = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../themes/shiro/scripts/assets.js'), 'utf8'), {
    require, hexo: {
      theme_dir: themeDir,
      extend: {
        helper: { register: (name, fn) => { helpers[name] = fn; } },
        filter: { register: (name, fn) => { filters[name] = fn; } }
      }
    }
  });
  const url = () => helpers.journal_asset.call({ url_for: asset => `/${asset}` }, 'js/travel-journal.js');
  const original = url();
  filters.before_generate();
  assert.equal(url(), original);
  fs.writeFileSync(path.join(modulesDir, 'map.mjs'), 'export const version = 2;');
  filters.before_generate();
  const changed = url();
  assert.notEqual(changed, original);
  fs.renameSync(path.join(modulesDir, 'viewer.mjs'), path.join(modulesDir, 'photo-viewer.mjs'));
  filters.before_generate();
  assert.notEqual(url(), changed);
});
