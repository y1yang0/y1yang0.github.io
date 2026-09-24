const { Parser } = require('htmlparser2');
const { escapeHTML } = require('hexo-util');

// Keep previews focused on the author's prose, without headings, code or quotes.
hexo.extend.helper.register('journal_excerpt', (post, length = 200) => {
    const blocks = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'blockquote', 'section', 'article']);
    const omitted = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'table', 'figure', 'svg', 'script', 'style']);
    if (!post.excerpt) omitted.add('blockquote');
    const parts = [];
    let hiddenDepth = 0;
    const parser = new Parser({
        onopentag(name) {
            if (hiddenDepth || omitted.has(name)) hiddenDepth++;
            else if (blocks.has(name)) parts.push(' ');
        },
        ontext(text) {
            if (!hiddenDepth) parts.push(text);
        },
        onclosetag(name) {
            if (hiddenDepth) hiddenDepth--;
            else if (blocks.has(name)) parts.push(' ');
        }
    }, { decodeEntities: true });
    parser.end(post.excerpt || post.content || '');
    const text = parts.join('').replace(/\s+/g, ' ').trim();
    const limit = Math.max(1, Number(length) || 200);
    const chars = Array.from(text);
    if (chars.length <= limit) return escapeHTML(text);
    let preview = chars.slice(0, limit - 1).join('');
    const lastSpace = preview.lastIndexOf(' ');
    if (lastSpace > preview.length * 0.75) preview = preview.slice(0, lastSpace);
    preview = preview.trimEnd();
    return escapeHTML(/[.!?。！？]$/.test(preview) ? preview : preview + '…');
});
