# Translations (EN / DE / FR)

Romanian is the source of truth. English, German, and French pages are generated
into `/en/`, `/de/`, `/fr/` by `translate.mjs` using DeepL.

## One-time setup

1. Get a **free** DeepL API key: https://www.deepl.com/pro-api (free tier = 500k
   chars/month; the whole site is a small fraction of that). A free key ends in `:fx`.
2. Put it in `.env` (gitignored):
   ```
   DEEPL_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
   SITE_URL=https://your-real-domain
   ```
   `SITE_URL` is used for the `hreflang` tags — set it to the live domain.

## Regenerate translations

```bash
node translate.mjs            # all pages, all languages
node translate.mjs en         # only English
node translate.mjs --ro-only  # just refresh the switcher/hreflang on the RO pages (no key needed)
```

Run this whenever you change the Romanian content. It re-reads the RO pages and
rewrites `/en/`, `/de/`, `/fr/`. It is idempotent — safe to run repeatedly.

## Keeping terms accurate

`i18n/glossary.json` forces exact wording for brand names and jargon (e.g.
"Pescar Fugar" stays "Pescar Fugar" everywhere). When you spot a mistranslation
of a recurring term, add an entry there and re-run — it applies to all languages.

## Automatic language detection

A small inline script (injected into every page's `<head>`) sends first-time
visitors to their browser language. Its rules:

- Only redirects **from the Romanian pages** — a shared `/en/…` or `/de/…` link
  is never bounced.
- An explicit switcher click is remembered (`localStorage` key `pf_lang`) and
  always wins over detection, on every later visit.
- **Search-engine crawlers are skipped**, so your canonical Romanian URLs stay
  indexed normally.
- It can never loop — it only moves when the destination differs from the
  current URL.

To reset your own saved choice while testing, run in the browser console:
`localStorage.removeItem('pf_lang')`.

## Deploy

Generated pages are committed (so `deploy.sh` picks them up via git). After
regenerating: commit, then `./deploy.sh`.

## What gets translated

- Page body text and `<title>` (DeepL HTML mode preserves all tags and skips
  `<script>`/`<style>`).
- The `<meta name="description">` (translated separately, since it's an attribute).
- `alt` text is intentionally left as-is (mostly proper nouns / brand).
