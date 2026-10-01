'use strict';

const { escapeHTML } = require('hexo-util');

hexo.extend.generator.register('legacy_travel_journal', () => {
  const target = `${hexo.config.root || '/'}journal/`;
  const canonical = new URL(target, hexo.config.url).href;
  const destination = JSON.stringify(target).replace(/</g, '\\u003c');
  return {
    path: '2026/09/30/travel-journal/index.html',
    data: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Journal</title><link rel="canonical" href="${escapeHTML(canonical)}"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=${escapeHTML(target)}"></head><body><a href="${escapeHTML(target)}">前往 Journal</a><script>location.replace(${destination} + location.search + location.hash);</script></body></html>`
  };
});
