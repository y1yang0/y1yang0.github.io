'use strict';

const { parseTravelMarkdown, resolveCity } = require('./travel-markdown');

function mapPlaces(data, country) {
  if (country.mapLevel !== 'province') return data.cities;
  return data.provinces.map(province => ({
    ...province,
    province: province.name,
    aliases: [...new Set([...(province.aliases || []), province.name.replace(/(?:都|府|县)$/u, '')])]
  }));
}

function journalStats(places, albums) {
  const byPlace = Object.fromEntries(places.map(place => {
    const entries = albums[place.id]?.entries || [];
    const photos = entries.reduce((sum, entry) => sum + (entry.photos || []).filter(photo => photo && typeof photo.src === 'string').length, 0);
    return [place.id, { recorded: entries.length > 0, photos }];
  }));
  const maximum = Math.max(1, ...Object.values(byPlace).map(place => place.photos));
  for (const place of Object.values(byPlace)) {
    const weight = place.photos ? 22 + (maximum > 1 ? 58 * Math.log(place.photos) / Math.log(maximum) : 0) : 0;
    place.weight = `${weight.toFixed(2)}%`;
  }
  return { byPlace };
}

function compileJournal(markdown, { data, country, onWarning = () => {} }) {
  const places = mapPlaces(data, country);
  const provinceLevel = country.mapLevel === 'province';
  const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
  const provinceNames = new Set(places.flatMap(place => [place.id, place.name, ...(place.aliases || [])]).map(normalize));
  const headingPlaces = data.headingPlaces || [];
  const parsed = parseTravelMarkdown(markdown, {
    cities: places,
    defaultCity: country.defaultPlace,
    ...(provinceLevel ? { resolveHeading: value => resolveCity(provinceNames.has(normalize(value)) ? places : headingPlaces, value) } : {}),
    onWarning
  });
  let albums = parsed.cities;
  const legacyPlaces = {};
  if (provinceLevel) {
    const placeByName = new Map(places.map(place => [place.name, place]));
    const sourceById = new Map([...headingPlaces, ...places].map(place => [place.id, place]));
    for (const heading of headingPlaces) {
      const place = placeByName.get(heading.province);
      if (!place) throw new Error(`地点“${heading.name}”所属地区“${heading.province}”不在地图中。`);
      legacyPlaces[heading.id] = place.id;
    }
    albums = {};
    for (const [id, album] of Object.entries(parsed.cities)) {
      const source = sourceById.get(id);
      const place = placeByName.get(source?.province || source?.name);
      if (!place) throw new Error(`相册“${album.name}”未匹配到地区。`);
      if (!albums[place.id]) albums[place.id] = { name: place.name, entries: [] };
      albums[place.id].entries.push(...album.entries);
    }
  }
  return { defaultPlace: country.defaultPlace, albums, stats: journalStats(places, albums), legacyPlaces };
}

module.exports = { compileJournal, journalStats, mapPlaces };
