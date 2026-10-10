#!/usr/bin/env python3
"""Generate Japan prefecture geometry and legacy heading lookup with Python's stdlib.

Ordinary Hexo builds use the checked-in data without downloading map sources.
Boundary sources are MLIT's 2021 areas, simplified by SmartNews Media Research.
Municipal names and IDs remain available for existing Markdown and photo links.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(tempfile.gettempdir()) / 'codex-japan-map'
BASE = 'https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0001/'
SOURCES = {
    'municipalities.json': ('N03-21_210101_designated_city.json', '7b195eb4b566dc778e140a0ce2946ee74f787c9ccbf4ced323d88cddf6b6a1ff'),
    'prefectures.json': ('prefectures.json', '7e42c97adc115eb73e0521e8fa6bd21d0ac544f4ebd0a80fef121a71cb540887'),
}
OPENCC = 'https://raw.githubusercontent.com/BYVoid/OpenCC/3ac34aa439a9908dd49fa92b5174b46314787ac2/data/dictionary/'
VIEW = [0, 0, 1000, 900]
# Familiar Chinese names for kana city names; Japanese spellings remain aliases.
NAMES = {
    '11100': '埼玉市', '01395': '二世古町', '02208': '陆奥市', '02209': '津轻市',
    '05214': '仁贺保市', '07204': '磐城市', '08220': '筑波市', '08221': '常陆那珂市',
    '08230': '霞浦市', '08235': '筑波未来市', '09214': '樱市', '10212': '绿市',
    '11245': '富士见野市', '12238': '夷隅市', '13228': '秋留野市', '17209': '河北市',
    '18208': '芦原市', '19208': '南阿尔卑斯市', '22225': '伊豆之国市', '23236': '三好市',
    '23237': '海部市', '24214': '员弁市', '28224': '南淡路市', '28229': '龙野市',
    '30208': '纪之川市', '37206': '赞岐市', '37207': '东香川市', '40225': '浮羽市',
    '40229': '三山市', '45209': '虾野市', '46220': '南萨摩市', '46219': '市来串木野市',
    '47213': '宇流麻市',
}
# Pinyin is optional for headings; image basenames are never interpreted.
ALIASES = {
    '26100': ['jingdu', 'kyoto'], '27100': ['daban', 'osaka'], '29201': ['nailiang', 'nara'],
    '01100': ['zhahuang', 'sapporo'], '14100': ['hengbin', 'yokohama'],
    '23100': ['mingguwu', 'nagoya'], '28100': ['shenhu', 'kobe'],
    '40130': ['fugang', 'fukuoka'], '34100': ['guangdao', 'hiroshima'],
    '04100': ['xiantai', 'sendai'], '47201': ['naba', 'naha'],
    '17201': ['jinze', 'kanazawa'], '21203': ['gaoshan', 'takayama'],
    '26204': ['yuzhi', 'uji'], '14204': ['liancang', 'kamakura'],
    '14382': ['xianggen', 'hakone'], '22205': ['rehai', 'atami'],
    '01202': ['hanguan', 'hakodate'], '01203': ['xiaozun', 'otaru'],
    '01204': ['xuchuan', 'asahikawa'], '01229': ['fuliangye', 'furano'],
    '01395': ['niseko', 'ershigu'],
    '20201': ['changye', 'nagano'], '20202': ['songben', 'matsumoto'],
    '20321': ['qingjingze', 'karuizawa'], '09206': ['riguang', 'nikko'],
    '28201': ['jilu', 'himeji'], '42201': ['changqi', 'nagasaki'],
    '43100': ['xiongben', 'kumamoto'], '46201': ['luerdao', 'kagoshima'],
    '44202': ['biefu', 'beppu'], '47207': ['shiyuan', 'ishigaki'],
}


def cached(name, url, checksum=None):
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / name
    if not dest.exists():
        with urlopen(Request(url, headers={'User-Agent': 'Journal-map-generator/1.0'}), timeout=60) as response:
            dest.write_bytes(response.read())
    content = dest.read_bytes()
    if checksum and hashlib.sha256(content).hexdigest() != checksum:
        raise ValueError(f'Source changed: {name}; review before updating the checksum')
    return content


def dictionary(name):
    result = {}
    for line in cached(name, OPENCC + name).decode().splitlines():
        if not line or line.startswith('#') or '\t' not in line:
            continue
        key, values = line.split('\t', 1)
        result[key] = values.split()[0]
    return result


def decode(topology):
    transform = topology.get('transform')
    arcs = []
    for arc in topology['arcs']:
        x = y = 0
        points = []
        for a, b in arc:
            if transform:
                x, y = x + a, y + b
                points.append([x * transform['scale'][0] + transform['translate'][0],
                               y * transform['scale'][1] + transform['translate'][1]])
            else:
                points.append([a, b])
        arcs.append(points)

    def ring(indices):
        points = []
        for index in indices:
            segment = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
            points.extend(segment if not points else segment[1:])
        return points

    result = []
    for geometry in next(iter(topology['objects'].values()))['geometries']:
        if not geometry.get('arcs'):
            result.append((geometry['properties'], []))
            continue
        polygons = geometry['arcs'] if geometry['type'] == 'MultiPolygon' else [geometry['arcs']]
        result.append((geometry['properties'], [[ring(indices) for indices in polygon] for polygon in polygons]))
    return result


def raw_project(point):
    lon, lat = point
    return [math.radians(lon), -math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))]


def main():
    sources = {name: json.loads(cached(name, BASE + filename, checksum))
            for name, (filename, checksum) in SOURCES.items()}
    prefectures = decode(sources['prefectures.json'])
    municipalities = next(iter(sources['municipalities.json']['objects'].values()))['geometries']
    japanese, simplified = dictionary('JPShinjitaiCharacters.txt'), dictionary('TSCharacters.txt')
    overrides = {'戸': '户', '黒': '黑', '姫': '姬', '呉': '吴', '渋': '涩', '郷': '乡', '舎': '舍', '眞': '真', '竝': '并'}

    def chinese(name):
        return ''.join(overrides.get(c, simplified.get(japanese.get(c, c), japanese.get(c, c))) for c in name)

    points = [raw_project(point) for _, polygons in prefectures for polygon in polygons for ring in polygon for point in ring]
    low = [min(p[i] for p in points) for i in range(2)]
    high = [max(p[i] for p in points) for i in range(2)]
    scale = min((VIEW[2] - 44) / (high[0] - low[0]), (VIEW[3] - 44) / (high[1] - low[1]))
    offset = [(VIEW[i + 2] - (high[i] - low[i]) * scale) / 2 - low[i] * scale for i in range(2)]

    def project(point):
        p = raw_project(point)
        return [round(p[i] * scale + offset[i], 1) for i in range(2)]

    def shape(polygons):
        projected = [[list(map(project, ring)) for ring in polygon] for polygon in polygons]
        points = [p for poly in projected for ring in poly for p in ring]
        bounds = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
        def area(ring):
            return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])))
        ring = max((poly[0] for poly in projected), key=area)
        twice_area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:]))
        center = [round(sum((a[i] + b[i]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / (3 * twice_area), 1) for i in range(2)] if twice_area else [round((bounds[i] + bounds[i + 2]) / 2, 1) for i in range(2)]
        def svg_ring(ring):
            def n(value):
                return f'{value:.1f}'.rstrip('0').rstrip('.') or '0'
            return 'M' + ' '.join(n(v) for v in ring[0]) + 'l' + ' '.join(n(b[i] - a[i]) for a, b in zip(ring, ring[1:]) for i in range(2)) + 'z'
        return {'path': ''.join(svg_ring(ring) for poly in projected for ring in poly if len(ring) >= 3), 'center': center, 'bounds': bounds}

    provinces = [{'id': f'JP-{i:02}', 'name': chinese(props['N03_001']), **shape(polygons)}
                 for i, (props, polygons) in enumerate(prefectures, 1)]
    heading_places = []
    for municipality in municipalities:
        props = municipality['properties']
        code = props['N03_007']
        if not code:
            continue
        if '13101' <= code <= '13123':
            continue
        original = props['N03_004'] or props['N03_003']
        name = NAMES.get(code, chinese(original))
        aliases = list(dict.fromkeys([original, re.sub(r'[市町村]$', '', original), re.sub(r'[市町村]$', '', name), *ALIASES.get(code, [])]))
        heading_places.append({'id': 'JP-' + code, 'name': name, 'province': chinese(props['N03_001']), 'aliases': aliases})
    heading_places.append({'id': 'JP-13100', 'name': '东京', 'province': '东京都',
                           'aliases': ['東京', '东京市', '东京23区', '東京23区', 'dongjing', 'tokyo']})
    heading_places.sort(key=lambda place: place['id'])
    metadata = {
        'source': 'Japan MLIT National Land Numerical Information, Administrative Areas 2021; simplified by SmartNews Media Research',
        'sourceUrl': 'https://github.com/smartnews-smri/japan-topography',
        'attribution': '国土交通省 国土数値情報（行政区域・2021年）を加工して作成',
        'licenseUrl': 'https://nlftp.mlit.go.jp/ksj/other/agreement.html',
        'sources': {name: {'url': BASE + f, 'sha256': h} for name, (f, h) in SOURCES.items()},
        'names': 'Common Chinese aliases plus simplified Han characters. Original names remain valid headings. OpenCC dictionaries (Apache-2.0): https://github.com/BYVoid/OpenCC',
        'projection': {'name': 'Spherical Mercator', 'scale': scale, 'offset': offset},
        'units': 'Prefectures. Municipal names and IDs are a build-time legacy lookup; Tokyo special wards map to one heading destination.',
    }
    output = {'viewBox': VIEW, 'headingPlaces': heading_places, 'provinces': provinces,
              'outlinePath': ''.join(p['path'] for p in provinces), 'metadata': metadata}
    target = ROOT / 'tools/data/japan-map.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'headingPlaces': len(heading_places), 'prefectures': len(provinces), 'mapBytes': target.stat().st_size}))


if __name__ == '__main__':
    main()
