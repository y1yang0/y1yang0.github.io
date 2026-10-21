'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nunjucks = require('nunjucks');

const rootDir = path.resolve(__dirname, '../themes/shiro');
const head = fs.readFileSync(path.join(rootDir, 'layout/_partial/common/head.njk'), 'utf8');
const header = fs.readFileSync(path.join(rootDir, 'layout/_partial/common/header.njk'), 'utf8');
const layout = fs.readFileSync(path.join(rootDir, 'layout/_layout.njk'), 'utf8');
const main = fs.readFileSync(path.join(rootDir, 'source/js/main.js'), 'utf8');
const firstPaint = head.match(/<script>([\s\S]*?)<\/script>/)[1];

function element(dataset = {}) {
  return {
    dataset, attributes: {}, events: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.events[name] = listener; },
    focus() {}
  };
}

function loadTheme(saved = {}, blocked = false) {
  const storage = new Map(Object.entries(saved));
  const classes = new Set();
  const root = { dataset: { theme: 'warm' }, classList: {
    toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
  } };
  const options = ['white', 'warm', 'dark'].map(themeChoice => element({ themeChoice }));
  const toggle = element();
  const meta = element();
  const windowEvents = {};
  const sandbox = vm.createContext({
    document: {
      documentElement: root,
      addEventListener() {},
      getElementById: id => id === 'themeToggle' ? toggle : null,
      querySelectorAll: () => options,
      querySelector: () => meta
    },
    window: { addEventListener: (name, listener) => { windowEvents[name] = listener; } },
    localStorage: {
      getItem(key) { if (blocked) throw new Error('存储不可用'); return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    getComputedStyle: () => ({ getPropertyValue: () => ({ white: '#ffffff', warm: '#f5f1e8', dark: '#1c201e' })[root.dataset.theme] })
  });
  vm.runInContext(firstPaint, sandbox);
  const initial = root.dataset.theme;
  vm.runInContext(main, sandbox);
  vm.runInContext('initializeTheme()', sandbox);
  return { root, initial, options, toggle, meta, windowEvents, storage, classes, sandbox };
}

test('首次访问和存储不可用时默认暖色，菜单与浏览器主题色保持一致', () => {
  for (const blocked of [false, true]) {
    const page = loadTheme({}, blocked);
    assert.equal(page.initial, 'warm');
    assert.equal(page.root.dataset.theme, 'warm');
    assert.equal(page.classes.has('dark'), false);
    assert.equal(page.toggle.attributes['aria-label'], '切换主题 · 暖');
    assert.equal(page.meta.attributes.content, '#f5f1e8');
    assert.deepEqual(page.options.map(option => option.attributes['aria-checked']), ['false', 'true', 'false']);
    assert.equal(page.storage.size, 0);
  }
});

test('已保存的三个主题优先于默认值，旧深色设置仍兼容', () => {
  for (const theme of ['white', 'warm', 'dark']) {
    const page = loadTheme({ 'shiro-theme': theme, 'shiro-dark-mode': '1' });
    assert.equal(page.initial, theme);
    assert.equal(page.root.dataset.theme, theme);
    assert.equal(page.classes.has('dark'), theme === 'dark');
    assert.equal(page.storage.get('shiro-theme'), theme);
    assert.equal(page.options.find(option => option.dataset.themeChoice === theme).attributes['aria-checked'], 'true');
  }
  assert.equal(loadTheme({ 'shiro-dark-mode': '1' }).initial, 'dark');
  assert.equal(loadTheme({ 'shiro-theme': 'invalid' }).initial, 'warm');
});

test('脚本回退和跨页清除设置恢复暖色，手动选择仍能保存', () => {
  const page = loadTheme({ 'shiro-theme': 'white' });
  page.root.dataset.theme = 'invalid';
  vm.runInContext('initializeTheme()', page.sandbox);
  assert.equal(page.root.dataset.theme, 'warm');
  page.options[2].events.click();
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(page.storage.get('shiro-theme'), 'dark');
  page.windowEvents.storage({ key: 'shiro-theme', newValue: null });
  assert.equal(page.root.dataset.theme, 'warm');
  page.windowEvents.storage({ key: 'shiro-theme', newValue: 'white' });
  assert.equal(page.root.dataset.theme, 'white');
  page.windowEvents.storage({ key: null, newValue: null });
  assert.equal(page.root.dataset.theme, 'warm');
});

test('静态页面与菜单也默认暖色，无 JavaScript 时不会回到白色', () => {
  assert.match(layout, /<html[^>]*data-theme="warm"/);
  assert.match(head, /<meta name="theme-color" content="#f5f1e8"/);
  const rendered = nunjucks.renderString(header, {
    theme: { menu: [], site: { rss: { enabled: false } } }, is_post: () => false
  });
  assert.match(rendered, /aria-label="切换主题 · 暖"/);
  assert.match(rendered, /aria-checked="true" data-theme-choice="warm"/);
  assert.match(rendered, /aria-checked="false" data-theme-choice="white"/);
});
