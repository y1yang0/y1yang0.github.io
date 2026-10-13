'use strict';

const countries = [
  {
    code: 'china', name: '中国', label: 'China', route: '/journal/',
    defaultPlace: '330100', heartPlaces: ['330100', '510600'], mapLevel: 'city',
    terrain: null, credit: '', mark: 'china'
  },
  {
    code: 'japan', name: '日本', label: 'Japan', route: '/journal/japan/',
    defaultPlace: 'JP-26', heartPlaces: [], mapLevel: 'province', terrain: null,
    credit: '出典：国土交通省国土数値情報（行政区域・2021年）https://nlftp.mlit.go.jp/ksj/ を加工して作成。',
    mark: 'japan'
  }
];

function countryFor(page) {
  const code = page?.travel_country;
  if (code === undefined || code === null || code === '') return countries[0];
  const country = countries.find(item => item.code === code);
  if (!country) throw new Error(`未配置旅行国家“${code}”，请检查 travel_country。`);
  return country;
}

module.exports = { countries, countryFor };
