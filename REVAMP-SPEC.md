# REVAMP SPEC — Pescar Fugar Team

**Audience:** This document is the complete instruction set for the implementing model (Sonnet 5). Follow it top to bottom. Do not invent sections, features, or content beyond what is specified here. Where content is unknown, use the placeholder conventions in §9 and leave clearly-marked `<!-- TODO(content) -->` comments.

---

## 0. Before touching anything

1. **Invoke the `frontend-design` skill** (mandatory per CLAUDE.md, every session).
2. Commit the current working tree first (`index.html` has an uncommitted removal of the sponsors bar). Commit message: `Remove sponsors bar`.
3. Start the dev server in the background: `node serve.mjs` → http://localhost:3000. Never screenshot `file:///`.
4. Read `brand_assets/` and reuse real assets (logo.png etc.). No placeholder where a real asset exists.

## 1. Project context (do not re-derive)

- Static site, plain HTML/CSS/JS, **no framework, no build step, no Tailwind**. Keep it that way.
- Hosted on Apache. `.htaccess` serves clean URLs: `/contact` → `contact.html`. All internal links must use the **extensionless** form (`href="concursuri"`, not `concursuri.html`).
- Existing pages: `index.html` (single-page: hero, despre, competiții, echipă, contact-teaser, join, footer, member modal + lightbox), `contact.html`, `privacy-policy.html`.
- All site copy is **Romanian**. Diacritics required (ă â î ș ț).
- Identity: dark base `#0a0c10`, royal blue `#1a56db` (from logo), teal accent `#00D1A3`, fonts Plus Jakarta Sans (display) + DM Sans (body).
- Team name: **Pescar Fugar Team** — Romanian method-feeder fishing competition team. They also **organize their own fishing contests** (this revamp exists to showcase those).

## 2. Scope of the revamp

Three workstreams, in this order:

1. **Shared foundation** — extract shared CSS, unify nav/footer across all pages (§3–§4).
2. **New feature A: „Concursuri"** — a hub page listing every edition of the contests the team organizes, plus one blog-style detail page per edition (§5).
3. **New feature B: „Palmares"** — a page listing all competition results of all members, newest first, grouped by year (§6).

Plus: homepage integration (§7) and the registration CTA flow (§8).

Out of scope: SEO work (later pass), CMS/backend, comments, user accounts.

## 3. File structure & routing

```
/
├── index.html
├── contact.html
├── privacy-policy.html
├── concursuri.html                  → /concursuri        (editions hub)
├── concursuri/
│   ├── editia-1.html                → /concursuri/editia-1
│   └── editia-N.html                (one file per edition, added by hand over time)
├── palmares.html                    → /palmares
├── assets/
│   ├── css/site.css                 (shared design system — see §4)
│   └── img/concursuri/editia-1/…    (photos per edition)
└── .htaccess
```

**.htaccess change** — append this rule *above* the existing single-segment rule:

```apache
# /concursuri/editia-1 → concursuri/editia-1.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^concursuri/([^/]+)/?$ concursuri/$1.html [L]
```

**serve.mjs**: verify it serves nested paths and extensionless URLs; if it only maps flat `/name` → `name.html`, extend it minimally so local dev matches production routing (`/concursuri/editia-1` must work on localhost).

## 4. Shared foundation

### 4.1 Extract `assets/css/site.css`

Move the **design tokens and shared components** out of `index.html` into `assets/css/site.css`: CSS custom properties, resets, typography scale, navbar, mobile menu, buttons, footer, section-label/heading patterns, ticker. Page-specific styles stay in a `<style>` block per page. All four+ pages link the shared stylesheet. Do not visually change anything during extraction — screenshot before/after and diff.

### 4.2 Design tokens (single source of truth, in `:root`)

```css
--dark: #0a0c10;          /* page base (dark sections) */
--surface: #10141b;       /* elevated cards on dark */
--blue: #1a56db;          /* primary — logo royal blue */
--blue-deep: #123a99;     /* hover/active derivations */
--teal: #00D1A3;          /* accent, CTAs, highlights */
--gold: #E8B84B;          /* NEW — podium/winners accents only (1st place, trophies) */
--silver: #B9C2CE;        /* 2nd place */
--bronze: #C98F5A;        /* 3rd place */
--paper: #ffffff;         /* light sections */
--ink: #10141b;           /* text on light */
--border: rgba(255,255,255,0.09);
```

Gold/silver/bronze exist **only** for placement badges and podium modules on the new pages. Do not use them decoratively elsewhere.

### 4.3 Navbar & footer (all pages)

New nav order (desktop + mobile menu, identical on every page):

`Despre noi · Echipa · Concursuri · Palmares · Alătură-te · [Contactează-ne]`

- „Despre noi", „Echipa", „Alătură-te" remain `index` anchors (`index#about` etc. from subpages).
- „Concursuri" → `/concursuri`, „Palmares" → `/palmares`. Mark the active page (underline or color state).
- Footer: add „Concursuri" and „Palmares" to the links column on **every** page.

### 4.4 Anti-generic guardrails (from CLAUDE.md — enforce)

Layered color-tinted shadows; display+body font pairing already set; `-0.03em` tracking on large headings; `line-height:1.7` body; only `transform`/`opacity` animated, never `transition-all`; every clickable element gets hover, focus-visible, active states; images on dark get gradient overlay + blend treatment consistent with the existing hero/team cards.

## 5. Feature A — „Concursuri" (contest editions)

### 5.1 Hub page `concursuri.html`

Structure top → bottom:

1. **Page hero** (dark, compact — ~55vh, not the full homepage hero): section label „CONCURSURILE NOASTRE", H1 „Concursurile Pescar Fugar", one-line subhead: „Competițiile de method feeder pe care le organizăm — ediții, rezultate și povești de pe malul apei." Primary CTA button „Înscrie-te la concurs" (§8).
2. **Next edition banner** (conditional module, present but marked TODO until a real date exists): teal-bordered strip with „Ediția următoare", date, location, and the same CTA. If no upcoming edition, module shows „Următoarea ediție va fi anunțată în curând" with the CTA.
3. **Editions grid** — one card per edition, newest first. Card contents: cover photo (16:9, gradient overlay), badge „Ediția #N", date („14–15 iunie 2026" format), location (lake/venue), 1-sentence teaser, mini-podium strip (🥇 name • 🥈 name • 🥉 name using the gold/silver/bronze tokens as small medal chips), link „Vezi ediția →". Whole card clickable; hover: slight lift (`transform`), image zoom.
4. **CTA section** reusing the existing „join" section style: „Vrei să participi la următorul concurs?" + button „Înscrie-te acum" → §8.

### 5.2 Edition detail template `concursuri/editia-N.html`

Blog-style article page. Build `editia-1.html` fully as the canonical template; every future edition is a copy of it. Structure:

1. **Article header** (dark): breadcrumb „Concursuri / Ediția #1", H1 with edition name, meta row: 📅 date · 📍 location · 🎣 nr. participanți. Full-width cover image below with overlay.
2. **Story body** (light section, max-width ~720px, comfortable reading typography): 3–6 paragraphs telling the edition's story (placeholder copy marked TODO). Support pull-quote styling and inline photos (full-bleed to ~900px).
3. **Podium module** — the visual centerpiece. Three columns (2nd–1st–3rd, 1st tallest, classic podium silhouette), each with photo, name, catch weight, prize. Gold/silver/bronze accents. On mobile: stacked 1→2→3.
4. **Full results table** (optional per edition): rank, name, weight — collapsible „Vezi clasamentul complet".
5. **Galerie** — responsive photo grid (reuse the existing lightbox pattern from index.html; extract that JS into `assets/js/lightbox.js` and share it). Videos: click-to-load facade — thumbnail + play button, iframe (YouTube/TikTok embed) injected only on click. Never autoload third-party iframes.
6. **Prev/next edition** pager + „← Toate concursurile".
7. **CTA strip** „Înscrie-te la ediția următoare" → §8.

## 6. Feature B — „Palmares" (`palmares.html`)

All members' competition results, one page, **newest first, grouped by year**.

1. **Page hero** (dark, compact): label „ISTORIC COMPETIȚII", H1 „Palmares", subhead „Toate competițiile la care au participat membrii echipei, an de an."
2. **Stats strip**: total competiții, podiumuri, locuri 1, ani de activitate — computed from the actual data, not invented.
3. **Year navigation**: horizontal sticky pill bar („2026 · 2025 · 2024 …") that anchor-scrolls to each year block. Optional member filter: pill buttons per member that hide/show rows via a few lines of vanilla JS (`data-member` attribute). No libraries.
4. **Year blocks**: big year numeral as section header (display font, oversized, low-opacity — consistent with the numbered rows aesthetic already on the homepage). Inside, a result list — on desktop a table-like grid, on mobile stacked cards:
   - Columns: **Data · Competiția · Locația · Membru(i) · Rezultat**.
   - Rezultat rendered as a placement badge: gold/silver/bronze chip for 1st/2nd/3rd („Locul 1"), neutral chip otherwise („Locul 7", „Participare").
   - Rows for contests organized by the team link to their edition page.
5. **Data source**: keep all results as one inline JS array (or JSON in a `<script type="application/json">` block) at the top of the page, rendered by a small vanilla renderer — this makes adding a result a one-line edit and keeps stats accurate. Progressive enhancement note: also acceptable to render static HTML and use JS only for filtering; choose static HTML + JS filter (better for the later SEO pass).
6. **CTA**: „Urmărește-ne la următoarea competiție" → social links + „Contactează-ne".

Seed with placeholder data: 2024–2026, the four known members, 4–6 events per year, clearly marked TODO for real data.

## 7. Homepage integration (`index.html`)

Minimal, additive — do not restructure existing sections:

1. Nav/footer updates per §4.3.
2. **New section „Concursuri"** between the existing „Competiții/What we do" rows and „Echipa": section label „ORGANIZĂM CONCURSURI", heading, 1 short paragraph, cards for the latest 2 editions (same card component as §5.1), and buttons „Toate concursurile →" (`/concursuri`) + „Înscrie-te la concurs" (§8).
3. Existing „Competiții" numbered rows: retitle if needed so the distinction is clear — that section = competitions the team *participates in*; new section = contests the team *organizes*. Add a small link „Vezi palmaresul complet →" (`/palmares`) at the end of that section.

## 8. Registration CTA flow („Înscrie-te la concurs")

No backend yet, so route through the contact page:

- Every „Înscrie-te" button links to `/contact?subiect=inscriere#formular`.
- In `contact.html`: add `id="formular"` on the form, add a **Subiect** `<select>` with options „Înscriere concurs", „Sponsorizare", „Colaborare", „Altele". A few lines of JS read `?subiect=` and preselect „Înscriere concurs" + optionally show a hint line „Menționează ediția la care vrei să participi și localitatea ta."
- Keep the mailto/form mechanism the contact page already uses — do not change how the form submits.

## 9. Content placeholders & conventions

- Photos not yet provided: `https://placehold.co/WIDTHxHEIGHT/10141b/667` with meaningful alt text in Romanian.
- Unknown names/dates/weights: realistic Romanian placeholders (e.g. „Lacul Sărulești", „14–15 iunie 2026", „23,450 kg") each preceded by `<!-- TODO(content): confirm -->`.
- Every image gets `alt`, `loading="lazy"` (except above-the-fold hero), and explicit `width`/`height` or `aspect-ratio` to prevent layout shift.
- Dates in Romanian format, month names lowercase („14 iunie 2026").

## 10. Implementation order & verification

1. Commit current tree (§0) → then one commit per step below.
2. Extract `site.css` + shared nav/footer; screenshot every page before/after; zero visual diffs allowed.
3. Build `palmares.html` (simplest new page — validates the shared foundation).
4. Build `concursuri.html` hub.
5. Build `concursuri/editia-1.html` template.
6. Homepage integration + contact form subject flow + `.htaccess`/`serve.mjs` routing.
7. **Audit**: run the `web-design-guidelines` skill against all new/changed pages; fix findings.
8. **Screenshot loop** (per CLAUDE.md): `node screenshot.mjs http://localhost:3000/<page>` for every page at desktop AND mobile width, read the PNGs, fix mismatches, re-screenshot. Minimum 2 rounds per page. Check both breakpoints for: nav active states, podium stacking, year bar stickiness, table→card collapse, CTA visibility.
9. Verify all internal links use extensionless URLs and none 404 on localhost.

## 11. Hard rules recap

- Romanian copy with diacritics, everywhere.
- No frameworks, no Tailwind, no external UI libraries, no `transition-all`, no default-palette colors.
- Gold/silver/bronze only for placements.
- Nothing beyond this spec's sections. If a decision is ambiguous, prefer the pattern already used in `index.html`.
