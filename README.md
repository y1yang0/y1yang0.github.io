# Yi Yang's notebook

A Hexo blog using a customized Shiro theme: warm paper, forest-green ink, vermilion accents, serif headlines, and a locally rendered SVG postcard.

## Local preview

```sh
npm ci
npm run server -- --port 4000
```

Build the static site with `npm run build`. Hexo writes the generated files to `public/`. The existing GitHub Pages workflow deploys when changes are pushed to `main`.

## Customize the design

- `_config.shiro.yml`: navigation, stamp, footer quotation, and the homepage `journal` copy.
- `themes/shiro/source/css/journal.css`: colors, typography, layouts, dark mode, and mobile/print styles. Color tokens are at the top.
- `themes/shiro/source/images/field-notes.svg`: the homepage illustration.
- `themes/shiro/layout/`: homepage, articles, archives, topics, and shared templates.
- `source/_posts/`: original Markdown articles.
- `source/about/index.md`: personal background and professional identity; keep these details here rather than duplicating them in homepage copy or site descriptions.

The journal uses system fonts with locally bundled serif fallbacks. No remote font request is needed. Its stylesheet replaces the old Tailwind stylesheet in the page head; changing the journal does not require a separate Tailwind build.

The default appearance is warm paper. The Day/Night control remembers the reader's choice. Article pages retain image zoom, code/article copying, the Ask AI shortcut, table of contents, and reading progress. The banner's text is configuration-driven; its image stays local.
