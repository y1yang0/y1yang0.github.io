# Yi Yang's notebook

A Hexo blog using a customized Shiro theme: warm paper, forest-green ink, vermilion accents, serif headlines, and a locally rendered SVG postcard.

## Local preview

```sh
npm ci
npm run server -- --port 4000
```

Build the static site with `npm run build`. Hexo writes the generated files to `public/`. The existing GitHub Pages workflow deploys when changes are pushed to `main`.

## Project files

- `_config.yml`: site identity, URLs, and Hexo settings.
- `_config.shiro.yml`: navigation, homepage motto, and theme options.
- `themes/shiro/layout/`: page templates and the inline SVG banner in `_partial/components/banner-line-art.njk`.
- `themes/shiro/source/css/journal.css`: colors, typography, layouts, and mobile/print styles.
- `themes/shiro/source/css/travel-journal.css`: the travel map and albums.
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

Keep `layout: journal` and `travel_journal: true` in the page's front matter. First-level headings select cities; second-level headings group photos by place within that city. The theme reads the albums directly from Markdown; city boundaries are in `source/travel/china-cities.json`. Hexo embeds the map SVG and city index in the page, so the map does not need a separate data request or an external map service. The previous dated URL redirects to `/journal/` and preserves city selections.

The title's **China / Japan** country links open `/journal/` and `/journal/japan/`. Each country loads only its own map, terrain and album data. City/photo links and browser Back/Forward continue to work independently on both routes.

For Japan, edit **`source/journal/Japan.md`** and put original photos in **`source/images/travel/japan/`**. Keep its `travel_country: japan` and `permalink: journal/japan/index.html` front matter. Use Chinese city and place names; image basenames can use any pinyin convention. Files are assigned to the city heading, not guessed from their names:

```markdown
# 京都

## 清水寺

![下山途中一处迷你神社](../images/travel/japan/jingdu-qss1.jpg)
```

Common destinations accept Chinese names and aliases such as `京都` / `jingdu` / `Kyoto`, `大阪` / `daban` / `Osaka`, and `东京` / `dongjing` / `Tokyo`. Original Japanese names and map IDs also work. Ambiguous names require the ID printed in the build warning. Tokyo's 23 special wards form one travel destination; other cities, towns and villages remain selectable. China colors and counts individual cities. Japan colors entire prefectures, with color intensity based on the total photos across their cities; its coverage denominator is the 47 prefectures. City headings, photo counts, search and albums remain separate within each prefecture. In dense prefectures, hover labels prioritize cities and every destination with photos.

Japan's locally hosted map uses [MLIT administrative boundaries simplified by SmartNews Media Research](https://github.com/smartnews-smri/japan-topography), dated 2021, with small islands restored from the more detailed source. The map displays MLIT attribution; source URLs, pinned checksums and processing notes are in `source/travel/japan-cities.json`. Simplified Han-character names use [OpenCC](https://github.com/BYVoid/OpenCC) dictionaries (Apache-2.0), with common Chinese name overrides; Japanese spellings remain searchable. Its terrain uses the same public-domain Natural Earth source as China. Regenerate Japan's geometry and terrain with `python tools/build-japan-map.py` (NumPy and Pillow); normal Hexo builds use the checked-in assets and make no map-data requests.

The map adds a locally hosted shaded-relief texture, `source/travel/china-relief.png` (about 199 KiB), derived from [Natural Earth's public-domain shaded relief](https://www.naturalearthdata.com/downloads/50m-raster-data/50m-shaded-relief/). It is projected to the same coordinates as the city boundaries and shared by the main map and province hover layers. On desktop, hovering a province lifts and enlarges it, labels its cities, and lets the reader select a city directly. Touch devices keep direct city selection. City selection initializes independently of the image, so a slow or failed terrain request does not block the map. This is a static terrain texture; the South China Sea inset remains schematic.

Normal site builds use the checked-in terrain asset without processing or downloading GIS data. To regenerate it, run `python tools/build-china-relief.py` with NumPy and Pillow installed. The generator caches its source archive in the OS temporary directory and records source URLs, licensing, hashes, and projection accuracy in `source/travel/china-relief.metadata.json`.

City albums and the full-screen viewer both use the original image files directly. Album images load lazily as they approach the viewport, and the viewer provides a magnifier for inspecting details. Keep adding photos and Markdown links as before; no image conversion or preview generation is needed.

During a build, Journal checks that every local photo exists and that each path's spelling and capitalization match the file exactly, including on Windows. A missing or mismatched path stops the build and identifies the Markdown source and link to fix. The build reads original image headers to provide layout dimensions, accounting for EXIF rotation, so each photograph has the right amount of space before it loads. No converted images or metadata cache files are generated.
