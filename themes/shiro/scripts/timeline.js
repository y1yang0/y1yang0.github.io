'use strict';

// 按年份排列文章，并将连续无文章的年份合并成空白段。
hexo.extend.helper.register('journal_timeline', function (posts, eraStart, selected = '') {
    const notes = (posts.toArray ? posts.toArray() : [...posts]).sort((a, b) => b.date - a.date);
    const era = Number(eraStart) || Infinity;
    const years = new Map();
    let matched = 0;
    notes.forEach((post, index) => {
        const year = Number(this.date(post.date, 'YYYY'));
        const categories = post.categories ? (post.categories.toArray ? post.categories.toArray() : [...post.categories]) : [];
        const topics = categories.map(cat => cat.path);
        const match = !selected || topics.includes(selected);
        if (match) matched++;
        if (!years.has(year)) years.set(year, []);
        years.get(year).push({ post, match, topics, names: categories.map(cat => cat.name), side: index % 2 ? 'right' : 'left' });
    });
    const stretches = [];
    if (!notes.length) return { stretches, total: 0, matched: 0, first: null, last: null };
    const first = Math.min(...years.keys()), last = Math.max(...years.keys());
    for (let year = last; year >= first; year--) {
        const entries = years.get(year) || [];
        if (entries.length) {
            stretches.push({ type: 'year', year, entries, era: year >= era, eraStart: false });
        } else if (stretches.at(-1)?.type === 'gap') {
            stretches.at(-1).from = year;
        } else {
            stretches.push({ type: 'gap', from: year, to: year });
        }
    }
    const eraYears = stretches.filter(stretch => stretch.type === 'year' && stretch.era);
    if (eraYears.length) eraYears.at(-1).eraStart = true;
    return { stretches, total: notes.length, matched, first, last };
});
