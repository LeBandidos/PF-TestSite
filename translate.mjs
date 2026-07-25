#!/usr/bin/env node
// translate.mjs — build-time i18n for the Pescar Fugar site.
//
// Reads each Romanian source page, translates it with DeepL (HTML-aware, so tags
// and <script>/<style> survive), protects brand terms via the glossary, rewrites
// internal links into the language folder, and injects a language switcher +
// hreflang tags. Romanian stays the source of truth; en/ de/ fr/ are regenerated.
//
// Usage:
//   node translate.mjs            # translate every page into every target language
//   node translate.mjs en         # only English
//   node translate.mjs --ro-only  # just (re)inject switcher + hreflang into the RO pages
//
// Requires (in .env): DEEPL_API_KEY, SITE_URL (e.g. https://pescarfugar.ro)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCE_LANG = 'RO';
const TARGETS = { en: 'EN-US', de: 'DE', fr: 'FR' }; // folder -> DeepL target code
const LABEL = { ro: 'RO', en: 'EN', de: 'DE', fr: 'FR' };
// Languages the switcher / auto-detect may use. Set at runtime to Romanian plus
// any target language whose folder exists (or is being built this run), so the
// site never links to a language that hasn't been generated yet.
let AVAILABLE = ['ro'];

// route (clean URL) -> source html file, relative to repo root
const PAGES = [
  { route: '/',                          file: 'index.html' },
  { route: '/concursuri',                file: 'concursuri.html' },
  { route: '/realizari',                 file: 'realizari.html' },
  { route: '/contact',                   file: 'contact.html' },
  { route: '/privacy-policy',            file: 'privacy-policy.html' },
  { route: '/concursuri-editii/editia-1', file: 'concursuri-editii/editia-1.html' },
];
const ROUTES = new Set(PAGES.map(p => p.route));

// ─── Env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  const out = {};
  const p = path.join(ROOT, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...out, ...process.env };
}
const ENV = loadEnv();
const KEY = ENV.DEEPL_API_KEY;
const SITE_URL = (ENV.SITE_URL || 'https://example.com').replace(/\/$/, '');
const DEEPL_HOST = KEY && KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

// ─── Glossary (placeholder protection) ───────────────────────────────────────
// Each term's RO form is swapped for a Unicode private-use sentinel before the
// text reaches DeepL (which passes it through untouched), then restored to the
// target-language form afterwards. Guarantees brand names survive intact.
const GLOSSARY = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/glossary.json'), 'utf8')).terms
  .slice()
  .sort((a, b) => b.ro.length - a.ro.length); // longest first so phrases win over words
const token = i => String.fromCharCode(0xE000 + i);

function protect(text) {
  let out = text;
  GLOSSARY.forEach((t, i) => { out = out.split(t.ro).join(token(i)); });
  return out;
}
function restore(text, lang) {
  let out = text;
  GLOSSARY.forEach((t, i) => { out = out.split(token(i)).join(t[lang] ?? t.ro); });
  return out;
}

// ─── DeepL ───────────────────────────────────────────────────────────────────
async function deepl(texts, target, html) {
  const body = new URLSearchParams();
  for (const t of texts) body.append('text', t);
  body.append('source_lang', SOURCE_LANG);
  body.append('target_lang', target);
  if (html) { body.append('tag_handling', 'html'); }
  const res = await fetch(`${DEEPL_HOST}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).translations.map(t => t.text);
}

// ─── Transforms ──────────────────────────────────────────────────────────────
function stripInjected(html) {
  return html
    .replace(/<!--i18n:autolang-->[\s\S]*?<!--\/i18n:autolang-->\s*/g, '')
    .replace(/<!--i18n:hreflang-->[\s\S]*?<!--\/i18n:hreflang-->\s*/g, '')
    .replace(/<!--i18n:switcher-->[\s\S]*?<!--\/i18n:switcher-->\s*/g, '');
}

function langHref(lang, route) {
  if (lang === 'ro') return route;
  return route === '/' ? `/${lang}/` : `/${lang}${route}`;
}

// Prefix internal page links with the language folder. Assets (/assets, /brand_assets)
// and external/anchor links are left alone.
function rewriteLinks(html, lang) {
  return html.replace(/(href=")(\/[^"#?]*)([^"]*)(")/g, (m, a, p, rest, z) => {
    const clean = p.replace(/\/$/, '') || '/';
    if (!ROUTES.has(clean)) return m;            // not an internal page route
    return a + langHref(lang, clean) + rest + z;
  });
}

function switcherHTML(route) {
  if (AVAILABLE.length < 2) return ''; // nothing to switch to yet — stay dormant
  const items = AVAILABLE.map(l =>
    `    <a href="${langHref(l, route)}" hreflang="${l}"` +
    (l === CURRENT ? ` class="active" aria-current="true"` : ``) +
    `>${LABEL[l]}</a>`
  ).join('\n');
  return `<!--i18n:switcher-->\n<nav class="lang-switch" aria-label="Selectează limba">\n${items}\n</nav>\n<!--/i18n:switcher-->`;
}

// Client-side language auto-detection. Runs on every page but only acts when it
// is safe to: it redirects from the Romanian (canonical) pages to a visitor's
// browser language, honours an explicit switcher choice saved in localStorage,
// skips search-engine crawlers, and can never loop (it only moves when the target
// differs from the current path). Identical on every page — never translated.
function autolangHTML() {
  const av = JSON.stringify(AVAILABLE.filter(l => l !== 'ro'));
  return String.raw`<!--i18n:autolang-->
<script>
(function(){
  var AV=${av};
  var path=location.pathname;
  var seg=path.split('/')[1];
  var cur=AV.indexOf(seg)>-1?seg:'ro';
  function base(){var p=path.split('/');if(AV.indexOf(p[1])>-1)p.splice(1,1);return p.join('/')||'/';}
  function href(l,r){return l==='ro'?r:(r==='/'?'/'+l+'/':'/'+l+r);}
  function go(l){var d=href(l,base());if(d.replace(/\/+$/,'')!==path.replace(/\/+$/,''))location.replace(d+location.search+location.hash);}
  var bot=/bot|crawl|spider|slurp|bing|google|yandex|duckduck|baidu|facebookexternalhit/i.test(navigator.userAgent||'');
  var pref;try{pref=localStorage.getItem('pf_lang');}catch(e){}
  if(pref){if(pref!==cur)go(pref);}
  else if(cur==='ro'&&!bot){
    var ls=navigator.languages||[navigator.language||''];
    var t='ro';
    for(var i=0;i<ls.length;i++){var c=(ls[i]||'').slice(0,2).toLowerCase();if(c==='ro'){t='ro';break;}if(AV.indexOf(c)>-1){t=c;break;}}
    if(t!=='ro')go(t);
  }
  document.addEventListener('DOMContentLoaded',function(){
    var links=document.querySelectorAll('.lang-switch a');
    for(var i=0;i<links.length;i++){(function(a){
      a.addEventListener('click',function(){try{localStorage.setItem('pf_lang',a.getAttribute('hreflang'));}catch(e){}});
    })(links[i]);}
  });
})();
</script>
<!--/i18n:autolang-->`;
}

function hreflangHTML(route) {
  const links = AVAILABLE.map(l =>
    `  <link rel="alternate" hreflang="${l}" href="${SITE_URL}${langHref(l, route)}">`
  );
  links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${route}">`);
  return `<!--i18n:hreflang-->\n${links.join('\n')}\n<!--/i18n:hreflang-->`;
}

let CURRENT = 'ro'; // set per output so the switcher marks the active language

function decorate(html, lang, route) {
  CURRENT = lang;
  let out = html.replace(/(<html[^>]*\blang=")[^"]*(")/i, `$1${lang}$2`);
  out = out.replace(/(<head[^>]*>)/i, `$1\n${autolangHTML()}`);
  out = out.replace(/<\/head>/i, `${hreflangHTML(route)}\n</head>`);
  const sw = switcherHTML(route);
  out = out.replace(/<\/body>/i, `${sw ? sw + '\n' : ''}</body>`);
  return out;
}

// ─── Per-page pipeline ───────────────────────────────────────────────────────
async function translatePage(page, lang, target) {
  const raw = stripInjected(fs.readFileSync(path.join(ROOT, page.file), 'utf8'));

  // 1. Body + <title> via HTML-aware translation (attributes are left untouched).
  const [bodyOut] = await deepl([protect(raw)], target, true);
  let doc = restore(bodyOut, lang);

  // 2. meta description lives in an attribute, so translate it as plain text.
  const descRe = /(<meta\s+name="description"\s+content=")([^"]*)(")/i;
  const descMatch = raw.match(descRe);
  if (descMatch && descMatch[2].trim()) {
    const [descOut] = await deepl([protect(descMatch[2])], target, false);
    doc = doc.replace(descRe, `$1${restore(descOut, lang).replace(/\$/g, '$$$$')}$3`);
  }

  // 3. Language-folder link rewriting + switcher/hreflang.
  doc = decorate(rewriteLinks(doc, lang), lang, page.route);

  const outPath = path.join(ROOT, lang, page.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, doc, 'utf8');
  return outPath;
}

function decorateRomanian(page) {
  const raw = stripInjected(fs.readFileSync(path.join(ROOT, page.file), 'utf8'));
  const out = decorate(raw, 'ro', page.route);
  fs.writeFileSync(path.join(ROOT, page.file), out, 'utf8');
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const roOnly = args.includes('--ro-only');
  const only = args.filter(a => !a.startsWith('--'));
  const langs = only.length ? only.filter(l => l in TARGETS) : Object.keys(TARGETS);

  if (!roOnly && !KEY) {
    console.error('✗ DEEPL_API_KEY missing in .env. Get a free key at https://www.deepl.com/pro-api and add:\n  DEEPL_API_KEY=xxxxxxxx:fx\n  SITE_URL=https://your-domain');
    process.exit(1);
  }

  // Languages that will exist after this run = already-built folders + those we're
  // about to generate. Drives the switcher/hreflang/auto-detect so nothing links
  // to a language that isn't there yet.
  const willBuild = roOnly ? [] : langs;
  AVAILABLE = ['ro', ...Object.keys(TARGETS).filter(
    l => willBuild.includes(l) || fs.existsSync(path.join(ROOT, l))
  )];

  // Always (re)inject the switcher + hreflang into the Romanian originals.
  for (const page of PAGES) {
    decorateRomanian(page);
    console.log(`  ro  ${page.file}`);
  }
  if (roOnly) { console.log('✓ Romanian pages updated (switcher + hreflang).'); return; }

  for (const lang of langs) {
    const target = TARGETS[lang];
    console.log(`\n→ ${lang.toUpperCase()} (${target})`);
    for (const page of PAGES) {
      try {
        const out = await translatePage(page, lang, target);
        console.log(`  ✓ ${path.relative(ROOT, out)}`);
      } catch (err) {
        console.error(`  ✗ ${page.file}: ${err.message}`);
      }
    }
  }
  console.log('\n✓ Done. Review the output, then deploy with ./deploy.sh');
}

main().catch(e => { console.error(e); process.exit(1); });
