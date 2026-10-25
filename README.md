# XI Guess

Name the starting XI of famous football matches. Play solo, pass the phone around (Same XI, or Team vs team), or send a friend a challenge link. English and Arabic (RTL), light and dark mode.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (matching, game rules, data integrity, challenge links)
npm run e2e        # Playwright: builds, serves, runs every flow on a phone and a desktop viewport
npm run build      # static site in dist/ (deploy to Cloudflare Pages, Vercel, etc.)
```

First e2e run: `npx playwright install chromium`.

## Where things live

- `src/data/matches.json`: the lineups (51 matches, 102 XIs, imported from Wikipedia and then reviewed). `npm test` checks every XI (11 players, formation matches the rows, unique numbers, Arabic names, every alias resolves to its own player), and `npm run e2e` renders every lineup on a 360px phone to check that the name tags fit.
- `scripts/import-wikipedia.mjs`: adds matches. `node scripts/import-wikipedia.mjs "2010 UEFA Champions League final" "2022 FIFA World Cup knockout stage @ Morocco vs Portugal"` prints entries: starting XIs, shirt numbers, positions → formation, kit colours, venue, date, penalties/extra time, and Arabic names from Arabic Wikipedia. Then review them by hand: give each a short id and a competition, check the short names (two-word mononyms like "Roberto Carlos", players who share a surname), add striped kits and nicknames as aliases, and run the tests.
- `src/game/`: name matching, game rules, challenge-link codec. Pure TypeScript, no React.
- `src/i18n.tsx`: all English and Arabic copy.
- `src/brand.ts`: the product name, for renaming.

## Ads

`src/components/AdSlot.tsx` renders Google AdSense on the home and result screens only, never during play. It renders nothing until you set these in `.env`:

```
VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
VITE_ADSENSE_SLOT_HOME=1234567890
VITE_ADSENSE_SLOT_RESULT=1234567890
```

Turn on AdSense "Privacy & messaging" (Google's consent banner) for EU/UK visitors.

## SEO and deploying

- URLs are real paths: `/match/bar-mun-2009`, with Arabic at `/ar/match/bar-mun-2009`. The URL decides the language, and `hreflang` links the two versions.
- `npm run build` runs `scripts/prerender.ts` after Vite. It writes a static HTML file for every page in both languages (`dist/match/<id>.html`, `dist/ar/...`), each with its own title, description, canonical, Open Graph/Twitter tags, JSON-LD and readable content, plus `sitemap.xml` and `robots.txt`. Link previews (WhatsApp, X, iMessage) and crawlers see this without running JavaScript. Player names are never in it; an e2e test checks every page for leaks.
- Share images live in `public/og/`. Rerun `node scripts/og-images.ts` after adding matches.
- Before going live, set `SITE_URL` in `src/brand.ts` to the real domain.
- Host on anything that serves `match/x.html` at `/match/x` and falls back to `index.html` for other paths. Cloudflare Pages and Netlify do both by default; on Vercel, set `"cleanUrls": true` plus a rewrite to `/index.html`.
- After launch, submit `https://<domain>/sitemap.xml` in Google Search Console.
