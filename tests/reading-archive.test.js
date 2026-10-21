'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Hexo = require('hexo');

const root = path.resolve(__dirname, '..');
const context = { date: value => String(value.getUTCFullYear()) };

function loadTimeline() {
  const helpers = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'themes/shiro/scripts/timeline.js'), 'utf8'), {
    hexo: { extend: { helper: { register: (name, fn) => { helpers[name] = fn; } } } }
  });
  assert.equal(typeof helpers.journal_timeline, 'function');
  return helpers.journal_timeline.bind(context);
}

test('时间线保留空白年份、分类匹配和 AI era 起始标记', () => {
  const timeline = loadTimeline();
  const cat = (name, slug = name) => ({ name, path: `categories/${slug}/` });
  const post = (date, ...categories) => ({ date: new Date(date), title: date, categories });
  const result = timeline([
    post('2020-12-01', cat('JVM')),
    post('2026-02-27', cat('AI')),
    post('2018-03-02', cat('AI')),
    post('2027-01-01', cat('Compiler'), cat('Golang', 'Compiler/Golang')),
    post('2023-05-27', cat('Compiler'))
  ], 2026, 'categories/AI/');
  assert.deepEqual(Array.from(result.stretches, s => s.type === 'year' ? s.year : `${s.from}-${s.to}`),
    [2027, 2026, '2024-2025', 2023, '2021-2022', 2020, '2019-2019', 2018]);
  assert.deepEqual(Array.from(result.stretches.filter(s => s.eraStart), s => s.year), [2026]);
  assert.equal(result.first, 2018);
  assert.equal(result.last, 2027);
  assert.equal(result.total, 5);
  assert.equal(result.matched, 2);
  const entries = Array.from(result.stretches.flatMap(s => s.entries || []));
  assert.deepEqual(entries.map(e => e.side), ['left', 'right', 'left', 'right', 'left']);
  assert.deepEqual(Array.from(entries[0].topics), ['categories/Compiler/', 'categories/Compiler/Golang/']);
  assert.deepEqual(entries.map(e => e.match), [false, true, false, false, true]);
});

test('时间线支持空列表与 Hexo 集合，未配置 AI era 时不添加标记', () => {
  const timeline = loadTimeline();
  const empty = timeline([]);
  assert.equal(empty.stretches.length, 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.matched, 0);
  assert.equal(empty.first, null);
  assert.equal(empty.last, null);
  const result = timeline({ toArray: () => [{ date: new Date('2020-12-01'), categories: { toArray: () => [] } }] });
  assert.equal(result.total, 1);
  assert.equal(result.matched, 1);
  assert.equal(result.stretches[0].year, 2020);
  assert.equal(result.stretches[0].era, false);
  assert.equal(result.stretches[0].eraStart, false);
});

test('全新 Hexo 实例会自动加载并注册归档所需的 journal_timeline', async t => {
  const hexo = new Hexo(root, { silent: true });
  t.after(() => hexo.exit());
  await hexo.init();
  assert.equal(hexo.config.theme, 'shiro');
  const timeline = hexo.extend.helper.get('journal_timeline');
  assert.equal(typeof timeline, 'function');
  assert.equal(timeline.call(context, [{ date: new Date('2020-12-01') }], 2026).stretches[0].year, 2020);
});

test('目录已读状态仅用灰色淡化，不带圆点或删除线，当前章节保留强调色游标', () => {
  const css = fs.readFileSync(path.join(root, 'themes/shiro/source/css/journal.css'), 'utf8');
  const rule = selector => {
    const start = css.indexOf(`\n${selector} {`);
    assert.notEqual(start, -1, `缺少目录样式：${selector}`);
    return css.slice(start + 1, css.indexOf('}', start) + 1);
  };
  const read = rule('.toc a.toc-read:not(.toc-active)');
  assert.match(read, /opacity:\s*\.75\s*;/);
  assert.match(read, /text-decoration:\s*none\s*;/);
  assert.doesNotMatch(css.slice(css.indexOf('.toc {'), css.indexOf('.post-tags {')), /line-through/);
  assert.match(rule('.toc a'), /color:\s*var\(--muted\)/);
  assert.doesNotMatch(css, /\.toc a\.toc-read[^{}]*::(?:before|after)\s*\{/);
  assert.match(rule('.toc a:hover,.toc a.toc-active'), /color:\s*var\(--accent\)/);
  assert.match(rule('.toc a.toc-active'), /font-weight:\s*600/);
  assert.match(rule('.toc a.toc-active::before'), /background:\s*var\(--accent\)/);
  const focused = rule('.toc a.toc-read:hover,.toc a.toc-read:focus-visible');
  assert.match(focused, /opacity:\s*1\s*;/);
  assert.match(focused, /color:\s*var\(--accent\)/);
});

test('侧栏和弹窗目录同步已读状态，保留父级章节并支持向上回读', () => {
  const main = fs.readFileSync(path.join(root, 'themes/shiro/source/js/main.js'), 'utf8');
  const start = main.indexOf('    function updateReading() {');
  assert.notEqual(start, -1);
  const end = main.indexOf('    if (article) {', start);
  assert.notEqual(end, -1);
  const window = { scrollY: 260 };
  const headings = [
    { id: 'intro', tagName: 'H2', top: 0 },
    { id: 'first', tagName: 'H3', top: 120 },
    { id: 'second', tagName: 'H3', top: 240 },
    { id: 'end', tagName: 'H2', top: 480 }
  ].map(heading => ({ ...heading, getBoundingClientRect: () => ({ top: heading.top - window.scrollY }) }));
  const tocLinks = Array.from({ length: 2 }, () => headings.map(heading => {
    const classes = new Set();
    return {
      target: heading.id, classes, attributes: {},
      classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; }
    };
  })).flat();
  const sandbox = vm.createContext({
    window, innerHeight: 800, header: null, progress: null, tocIndex: null,
    article: { getBoundingClientRect: () => ({ top: -window.scrollY, bottom: 2000 - window.scrollY }) },
    headings, headingIndex: new Map(headings.map((heading, index) => [heading.id, index])),
    tocLinks, tocTargets: new Map(tocLinks.map(link => [link, link.target])),
    previousHeading: '', previousIndexHeight: -1
  });
  vm.runInContext(main.slice(start, end), sandbox);
  const check = (scrollY, active, read) => {
    window.scrollY = scrollY;
    vm.runInContext('updateReading()', sandbox);
    for (const link of tocLinks) {
      assert.equal(link.classes.has('toc-read'), read.includes(link.target), `${link.target} 已读状态`);
      assert.equal(link.classes.has('toc-active'), link.target === active, `${link.target} 当前状态`);
      assert.equal(link.attributes['aria-current'], link.target === active ? 'location' : undefined);
    }
  };
  check(260, 'second', ['first']);
  check(500, 'end', ['intro', 'first', 'second']);
  check(0, 'intro', []);
});
