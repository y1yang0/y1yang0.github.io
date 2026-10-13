# Yi Yang's notebook

A Hexo blog using a customized Shiro theme: warm paper, forest-green ink, vermilion accents, serif headlines, and a locally rendered SVG postcard.

## Local preview

```sh
npm ci
npm run server -- --port 4000
```

Run `npm test`, then build the static site with `npm run build`. Hexo writes the generated files to `public/`. The GitHub Pages workflow tests and builds pull requests; deployment runs only when changes are pushed to `main`.

## Project files

- `_config.yml`: site identity, URLs, and Hexo settings.
- `_config.shiro.yml`: navigation, homepage motto, and theme options.
- `themes/shiro/layout/`: page templates and the inline SVG banner in `_partial/components/banner-line-art.njk`.
- `themes/shiro/source/css/journal.css`: colors, typography, layouts, and mobile/print styles.
- `themes/shiro/source/css/travel-journal.css`: the travel map and albums.
- `themes/shiro/source/js/travel-journal.js`: Journal initialization; `js/travel/` contains the map, album loader, photo viewer, and navigation modules.
- `tools/travel-countries.js`: country names, routes, map levels, terrain, and attribution.
- `tools/travel-journal.js`: Markdown compilation, region grouping, and shared photo statistics.
- `tools/data/`: build-only map boundaries, legacy place names, and source metadata.
- `source/_posts/`: Markdown articles.
- `source/about/index.md`: personal background.

The warm, dark, and white themes remember the reader's choice. Fonts are local or system fonts. Article pages support image zoom, code/article copying, contents, and reading progress. There is no separate CSS build step.

## Travel albums

Put photos in `source/images/travel/`, then edit `source/journal/index.md`. Journal is a standalone page at `/journal/`, separate from blog posts, archives, categories, and tags. Each city heading starts an album; image alt text becomes its caption:

```markdown
# 杭州

## 西湖

![自划船](/images/travel/hangzhou-xihu1.jpg)
```

Keep `layout: journal` and `travel_journal: true` in the page's front matter. First-level headings select cities; second-level headings group photos by place within that city. The theme reads the albums directly from Markdown; city boundaries are in `tools/data/china-map.json`. Hexo embeds the map SVG and place index in the page, so the map does not need a separate data request or an external map service. The previous dated URL redirects to `/journal/` and preserves city selections.

The title's **China / Japan** country links open `/journal/` and `/journal/japan/`. Each country loads only its own map and album data; both maps use flat boundaries and photo-count fills without requesting a terrain texture. Location/photo links and browser Back/Forward continue to work independently on both routes. Journal has no search control; select a location directly on the map or from the recorded-album buttons.

For Japan, edit **`source/journal/Japan.md`** and put original photos in **`source/images/travel/japan/`**. Keep its `travel_country: japan` and `permalink: journal/japan/index.html` front matter. Use Chinese prefecture and place names; image basenames can use any pinyin convention. Existing city headings also work and are automatically grouped into their prefecture. Files are assigned to the heading, not guessed from their names:

```markdown
# 京都府

## 清水寺

![下山途中一处迷你神社](../images/travel/japan/jingdu-qss1.jpg)
```

Existing city headings accept Chinese names and aliases such as `京都` / `jingdu` / `Kyoto`, `大阪` / `daban` / `Osaka`, and `东京` / `dongjing` / `Tokyo`. Original Japanese names and source map IDs also work. Prefecture headings accept both full names and short names, such as `兵库县` / `兵库`; prefecture names take priority when a city has the same name. Ambiguous names require the ID printed in the build warning. China colors and counts individual cities. Japan shows only its 47 prefectures: shapes, album buttons and photo collections all use that single level, without municipal borders or floating city maps. Each prefecture combines all its photos and place entries; color intensity uses its total photo count. Legacy city/photo links redirect within the page to the corresponding `region` selection and retain the selected photo. Future countries can use the same `mapLevel: 'province'` configuration.

Japan's locally hosted map uses [MLIT administrative boundaries simplified by SmartNews Media Research](https://github.com/smartnews-smri/japan-topography), dated 2021. MLIT source and processing credit remain in the SVG description and source metadata; the map has no visible technical caption. Source URLs, pinned checksums and processing notes are in `tools/data/japan-map.json`, whose compact municipality lookup supports existing Markdown headings without keeping municipal geometry. Browsers receive only prefecture geometry and entries, without a terrain texture. Simplified Han-character names use [OpenCC](https://github.com/BYVoid/OpenCC) dictionaries (Apache-2.0), with common Chinese name overrides. Regenerate Japan's map data with `python tools/build-japan-map.py`, using Python's standard library; normal Hexo builds use the checked-in assets and make no map-data requests.

The China map uses flat city fills in both the main map and province hover layers. On desktop, hovering a Chinese province lifts and enlarges it, labels its cities, and lets the reader select a city directly. Touch devices keep direct city selection. Province hover layers create terrain clipping paths only when a terrain texture is enabled. The South China Sea inset remains schematic. On phones, selected albums show a full-width map with a return button.

City albums and the full-screen viewer both use the original image files directly. Album images load lazily as they approach the viewport, and the viewer provides a magnifier for inspecting details. Keep adding photos and Markdown links as before; no image conversion or preview generation is needed.

Travel albums and their full-screen viewer show each photo's file size in small caption text. While a photo downloads, the caption also shows its actual byte progress; the percentage disappears once the image is ready. Local file sizes are included at build time, so they appear before loading starts. Album photos load lazily with at most two inline downloads at once and share requests with the full-screen viewer. When an external image does not expose a reliable total, its caption shows a loading label instead of an estimated percentage.

During a build, Journal checks that every local photo exists and that each path's spelling and capitalization match the file exactly, including on Windows. A missing or mismatched path stops the build and identifies the Markdown source and link to fix. The build reads original image headers to provide layout dimensions, accounting for EXIF rotation, so each photograph has the right amount of space before it loads. No converted images or metadata cache files are generated.

Country links are rendered from the registry in `tools/travel-countries.js`. A new country needs a registry entry, map data in `tools/data/<code>-map.json`, and a Journal Markdown page. Foreign countries use `mapLevel: 'province'` and no terrain by default convention; a custom country mark is optional because unknown marks use a generic compass. An explicitly unknown `travel_country` stops the build instead of silently loading China.

The browser consumes one normalized album model and the build's photo counts and color weights. Navigation owns location/photo URLs and history restoration; map, album, and viewer modules communicate through callbacks. Journal has its own layout styles, separate from article prose. Its asset revision covers all modules, so editing a child module also refreshes cached imports. `npm test` uses Node's built-in test runner to check parsing, region grouping, image metadata and paths, legacy navigation, and module cache invalidation.
