# Journal typography

The blog uses its original font stacks:

- Headings and quotations: Georgia for English; Songti SC / STSong for Chinese.
- Homepage name and Chinese motto: a local Yuji Syuku calligraphy subset
  (`Hero Calligraphy`), with the original serif stacks as fallbacks.
- Body text, excerpts and interface labels: the system sans-serif stack,
  including PingFang SC and Microsoft YaHei for Chinese.
- Code: the system monospace stack.

Two original local Noto Serif SC files provide the `Journal Serif` fallback
when the system has no Chinese serif font. Their `@font-face` declarations live
in `themes/shiro/source/css/journal.css` and use `font-display: swap`.
No font generator or external font service is needed for a normal build.
The license is retained next to the font files.

## Homepage calligraphy

`hero-yuji-syuku.woff2` contains only `楊 易致广大，尽精微。` and is
used only by the homepage name and motto. It is preloaded on the homepage.
If those strings change, regenerate this subset for the new characters;
other characters fall back to the existing serif fonts.

Source: https://github.com/Kinutafontfactory/Yuji (SIL OFL 1.1).
The license is stored as `themes/shiro/source/fonts/LICENSE-Yuji.txt`.
The subset was downloaded from the Google Fonts CSS API with
`family=Yuji Syuku&text=楊 易致广大，尽精微。`, then converted to WOFF2
with fontTools. No external font requests or build dependencies are required
when serving or building the blog.
