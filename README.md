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

Put photos in `source/images/travel/`, then edit `source/_posts/travel-journal.md`. Each city heading starts an album; image alt text becomes its caption:

```markdown
# 杭州

## 西湖

![自划船](/images/travel/hangzhou-xihu1.jpg)
```

Keep `travel_journal: true` in the post's front matter. First-level headings select cities; second-level headings group photos by place within that city. The theme reads the albums directly from Markdown; city boundaries are in `source/travel/china-cities.json`. Hexo embeds the map SVG and city index in the article, so the map does not need a separate data request or an external map service.

Every build automatically creates WebP previews for local JPEG, PNG, WebP, and AVIF photos in `source/images/travel/`, including subfolders. Previews fit within 960 × 960 pixels, preserve orientation, and never enlarge smaller photos. City albums load these lightweight previews; opening a photo loads its original full-resolution file. Keep adding photos and Markdown links as before—there is no separate thumbnail step.

Generated previews use content-hashed URLs under `/images/travel-thumbnails/` and are cached locally in `.cache/travel-thumbnails/` (ignored by Git). Unchanged photos reuse the cache; changed photos get new URLs. The first build takes longer while it creates previews. Invalid or unreadable image files stop the build with their filename so they can be fixed before deployment. External image URLs are unchanged and do not receive local previews.
