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

- `src/data/matches.json`: the lineups. `npm test` checks every XI (11 players, formation matches the rows, unique numbers, Arabic names, every alias resolves to its own player). **Verify each XI against two sources before launch.**
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
