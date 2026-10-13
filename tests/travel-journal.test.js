'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parse: parseFrontMatter } = require('hexo-front-matter');
const { countries, countryFor } = require('../tools/travel-countries');
const { compileJournal, mapPlaces } = require('../tools/travel-journal');
const { normalizePhotoUrl, parseTravelMarkdown, resolveCity, serializeJournal } = require('../tools/travel-markdown');
const { addTravelImageMetadata } = require('../tools/travel-image-metadata');

const japan = countryFor({ travel_country: 'japan' });
const sampleMap = {
  provinces: [{ id: 'JP-26', name: '京都府' }, { id: 'JP-28', name: '兵库县' }],
  headingPlaces: [
    { id: 'JP-26100', name: '京都市', province: '京都府', aliases: ['jingdu', 'Kyoto'] },
    { id: 'JP-26204', name: '宇治市', province: '京都府', aliases: ['yuzhi'] },
    { id: 'JP-28100', name: '神户市', province: '兵库县', aliases: ['shenhu'] },
    { id: 'JP-00001', name: '京都', province: '兵库县' }
  ]
};

test('country registration defaults only an unspecified country and rejects unknown countries', () => {
  assert.equal(countryFor().code, 'china');
  assert.equal(countryFor({}).code, 'china');
  assert.equal(countryFor({ travel_country: '' }).code, 'china');
  assert.equal(countryFor({ travel_country: 'japan' }).mapLevel, 'province');
  assert.throws(() => countryFor({ travel_country: 'japna' }), /未配置旅行国家/);
  assert.equal(new Set(countries.map(country => country.code)).size, countries.length);
  assert.equal(new Set(countries.map(country => country.route)).size, countries.length);
});

test('prefecture headings take priority over cities and legacy city albums retain entry order', () => {
  const markdown = '# 京都\n## 清水寺\n![first](../images/travel/japan/first.jpg)\n# yuzhi\n## 平等院\n![second](/images/travel/japan/second.jpg)\n# 兵库\n## 六甲山\n![third](/images/travel/japan/third.jpg)';
  const warnings = [];
  const result = compileJournal(markdown, { data: sampleMap, country: japan, onWarning: warning => warnings.push(warning) });
  assert.deepEqual(warnings, []);
  assert.deepEqual(Object.keys(result.albums), ['JP-26', 'JP-28']);
  assert.deepEqual(result.albums['JP-26'].entries.map(entry => entry.title), ['清水寺', '平等院']);
  assert.deepEqual(result.albums['JP-26'].entries.flatMap(entry => entry.photos.map(photo => photo.caption)), ['first', 'second']);
  assert.deepEqual(Object.keys(result.stats), ['byPlace']);
  assert.equal(result.stats.byPlace['JP-26'].photos, 2);
  assert.equal(result.stats.byPlace['JP-26'].weight, '80.00%');
  assert.equal(result.stats.byPlace['JP-28'].weight, '22.00%');
  assert.equal(result.defaultPlace, japan.defaultPlace);
  assert.equal(result.legacyPlaces['JP-28100'], 'JP-28');
  assert.equal(Object.keys(result.legacyPlaces).length, sampleMap.headingPlaces.length);
});

test('notes-only entries count as recorded and zero-photo colors remain neutral', () => {
  const result = compileJournal('# 京都府\n## 手记\n下雨了。', { data: sampleMap, country: japan });
  assert.deepEqual(result.stats.byPlace['JP-26'], { recorded: true, photos: 0, weight: '0.00%' });
  assert.deepEqual(result.stats.byPlace['JP-28'], { recorded: false, photos: 0, weight: '0.00%' });
});

test('ambiguous cities require an ID and invalid headings never attach photos to the preceding album', () => {
  const cities = [{ id: 'one', name: '同名市' }, { id: 'two', name: '同名市' }];
  assert.throws(() => resolveCity(cities, '同名'), /one.*two/);
  assert.equal(resolveCity(cities, 'two').id, 'two');
  const warnings = [];
  const result = parseTravelMarkdown('# one\n![ok](/images/travel/ok.jpg)\n# 同名\n![skip](/images/travel/skip.jpg)', { cities, onWarning: warning => warnings.push(warning) });
  assert.equal(result.cities.one.entries[0].photos.length, 1);
  assert.equal(warnings.length, 2);
});

test('Markdown photo references work while code and HTML never become album content', () => {
  const markdown = '---\nlayout: journal\n---\n# 杭州\n## 西湖\n![one][photo]\n\n[photo]: ../images/travel/hangzhou.jpg\n\n```markdown\n# 上海\n![fake](/images/travel/fake.jpg)\n```\n\n<img src="/images/travel/fake.jpg">';
  const result = parseTravelMarkdown(markdown, { cities: [{ id: '330100', name: '杭州市' }] });
  assert.deepEqual(Object.keys(result.cities), ['330100']);
  assert.deepEqual(result.cities['330100'].entries[0].photos, [{ src: '/images/travel/hangzhou.jpg', alt: 'one', caption: 'one' }]);
  assert.equal(normalizePhotoUrl('../images/travel/../../../secret.jpg'), '');
  assert.equal(normalizePhotoUrl('javascript:alert(1)'), '');
  assert.equal(normalizePhotoUrl('/images/travel/%2e%2e/secret.jpg'), '');
  assert.equal(normalizePhotoUrl('https://example.test/photo.jpg'), 'https://example.test/photo.jpg');
  assert.equal(serializeJournal({ caption: '</script>\u2028' }).includes('<'), false);
});

test('checked-in maps and current albums have consistent IDs and complete legacy lookup', () => {
  const warnings = [];
  const readPages = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return readPages(filename);
    if (!entry.isFile() || !/\.md$/iu.test(entry.name)) return [];
    const markdown = fs.readFileSync(filename, 'utf8');
    const page = parseFrontMatter(markdown);
    return page.travel_journal ? [{ markdown, country: countryFor(page) }] : [];
  });
  const pages = readPages(path.join(__dirname, '../source/journal'));
  for (const country of countries) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, `../tools/data/${country.code}-map.json`), 'utf8'));
    const places = mapPlaces(data, country);
    const ids = new Set(places.map(place => place.id));
    assert.equal(ids.size, places.length);
    assert.ok(ids.has(country.defaultPlace));
    assert.ok(country.heartPlaces.every(id => ids.has(id)));
    assert.equal(data.viewBox.length, 4);
    assert.ok(data.viewBox.every(Number.isFinite));
    for (const place of places) {
      assert.ok(place.path.length > 0, place.id);
      assert.ok(place.center.length === 2 && place.center.every(Number.isFinite), place.id);
    }
    if (country.code === 'japan') {
      assert.equal(data.provinces.length, 47);
      assert.equal(data.headingPlaces.length, 1725);
      assert.equal(resolveCity(data.headingPlaces, 'qingjingze').id, 'JP-20321');
    }
    for (const page of pages.filter(page => page.country.code === country.code)) {
      const journal = compileJournal(page.markdown, { data, country, onWarning: warning => warnings.push(warning) });
      assert.ok(Object.keys(journal.albums).every(id => ids.has(id)));
      const photos = Object.values(journal.albums).flatMap(album => album.entries.flatMap(entry => entry.photos || []));
      assert.ok(photos.every(photo => photo.src.startsWith('/images/travel/')));
      if (country.mapLevel === 'province') {
        const lookup = data.headingPlaces || [];
        assert.equal(Object.keys(journal.legacyPlaces).length, lookup.length);
        assert.ok(Object.values(journal.legacyPlaces).every(id => ids.has(id)));
        assert.ok(lookup.every(place => !('path' in place) && !('center' in place)));
      }
      if (country.code === 'japan') assert.equal(journal.legacyPlaces['JP-20321'], 'JP-20');
    }
  }
  assert.deepEqual(warnings, []);
});

function jpegWithLargePreview() {
  const tiff = Buffer.alloc(26);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(274, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const appHeader = Buffer.from([0xff, 0xe1, 0, exif.length + 2]);
  const preview = Buffer.alloc(65537);
  preview.set([0xff, 0xe2, 0xff, 0xff]);
  const frame = Buffer.from([0xff, 0xc0, 0, 11, 8, 1, 44, 1, 144, 1, 1, 0x11, 0, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), appHeader, exif, ...Array(9).fill(preview), frame]);
}

test('image metadata validates Linux casing and reads EXIF rotation beyond a large JPEG preview', async () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-metadata-test-'));
  try {
    const folder = path.join(sourceDir, 'images/travel');
    fs.mkdirSync(folder, { recursive: true });
    const original = jpegWithLargePreview();
    const filename = path.join(folder, 'Rotated.jpg');
    fs.writeFileSync(filename, original);
    const photo = { src: '/images/travel/Rotated.jpg' };
    const journal = { albums: { one: { entries: [{ photos: [photo] }] } } };
    await addTravelImageMetadata(journal, { sourceDir });
    assert.deepEqual(photo, { src: '/images/travel/Rotated.jpg', width: 300, height: 400, sizeBytes: original.length });
    assert.deepEqual(fs.readFileSync(filename), original);
    const wrongCase = { albums: { one: { entries: [{ photos: [{ src: '/images/travel/rotated.jpg' }] }] } } };
    await assert.rejects(addTravelImageMetadata(wrongCase, { sourceDir }), /大小写不一致/);
    const missing = { albums: { one: { entries: [{ photos: [{ src: '/images/travel/missing.jpg' }] }] } } };
    await assert.rejects(addTravelImageMetadata(missing, { sourceDir, pageSource: 'journal/Japan.md' }), /journal\/Japan.md.*\n.*missing.jpg/s);
  } finally {
    assert.equal(path.dirname(path.resolve(sourceDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sourceDir).startsWith('journal-metadata-test-'));
    fs.rmSync(sourceDir, { recursive: true, force: true });
  }
});
