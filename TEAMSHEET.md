# Teamsheet — Project Kickoff

A daily football guessing game: you're shown a famous match and a formation with 11 blank shirts, and you name as many of the starting XI as you can. It's built website-first, with room for more game modes and sports later.

Prototype (single HTML page, all logic client-side): https://claude.ai/artifact/YSUPZdTv3aBthJHreNVHvy

---

## 1. Why this works

- **The Twitter trend:** People already post lineups and ask others to guess the names. This turns that into a repeatable daily format.
- **Daily cadence:** One puzzle a day, the same for everyone, creates a shared moment and gives people a reason to come back.
- **Shareable result:** An emoji grid laid out like the formation can be posted to Twitter without spoilers. That grid is the main growth channel.
- **Gap in the market:** Arabic name support and MENA-focused content are rare among competitors.

---

## 2. MVP scope (v1)

**In**
- One daily puzzle per date, the same for every player.
- A pitch view with 11 shirts showing kit colour and number, plus match info (competition, date, venue, score, which team to guess).
- Free-text guessing that accepts surnames, full names and aliases, ignores accents, tolerates small typos, and supports Arabic names.
- 5 missed guesses allowed.
- 3 hints per game. A hint shows the first letter and length of the selected shirt's name, e.g. `M _ _ _ _`.
- A "Give up" button that reveals the full XI.
- An end screen with the score, a verdict, and a copyable share grid:
  - 🟩 found
  - 🟨 found with a hint
  - ⬜ missed
- An archive of past puzzles.
- Local progress per puzzle, stored in localStorage for now.

**Out (later)**
- Accounts, leaderboards, streaks synced across devices
- Head-to-head mode
- Other game modes and sports
- An admin UI (use seed scripts or JSON first)

---

## 3. Game rules (as prototyped)

| Rule | Value |
|---|---|
| Missed guesses allowed | 5 |
| Hints per game | 3 (one per shirt) |
| Hint content | First letter + name length pattern |
| Win | All 11 found |
| Repeat wrong guess | No penalty, shown as "already tried" |
| Typo tolerance | Levenshtein ≤1 for names of 5–7 chars, ≤2 for 8+ chars, exact for shorter |

**Verdicts by score:**

| Score | Verdict |
|---|---|
| 11 | Full house |
| 9–10 | Proper fan |
| 6–8 | Decent shift |
| 3–5 | Bench warmer |
| 0–2 | Back to the archive |

**Share text format:**
```
Teamsheet #12 · Barcelona 2009
9/11 · 1 hint · 3 misses

🟩⬜🟩
🟩🟨🟩
🟩🟩🟩⬜
🟩
```
The grid rows run from attack (top) down to the goalkeeper (bottom).

---

## 4. Proposed architecture

```
[ Web client ]  ──HTTP──>  [ ASP.NET Core API ]  ──>  [ PostgreSQL / SQL Server ]
 React + Vite (or Flutter Web)    .NET 8 Minimal API          puzzles, players, aliases
```

**Backend: ASP.NET Core (.NET 8)**
- Do the name matching on the server, so answers never ship to the client and nobody can read the XI from the page source.
- The client only receives:
  - match info
  - formation
  - slot positions
  - shirt numbers and kit colours
- The client sends each guess to the API, which returns which slot matched, if any.
- Cache today's puzzle in memory, since every user gets the same one.

**Frontend**
- Pick one:
  - **React + Vite + TypeScript:** Fastest for the web.
  - **Flutter Web:** Lets you reuse the code for mobile apps later, but has a heavier initial load, which hurts users arriving from Twitter links.
- Recommendation: React for the web and the Twitter traffic. Revisit Flutter for native apps.
- The pitch is CSS/SVG. The prototype's pitch and shirt SVG can be ported directly.

**Hosting (cheap start)**
- API: Azure App Service, Fly.io, or a small VPS with IIS or Kestrel.
- Frontend: Cloudflare Pages or Vercel.
- DB: managed Postgres (Neon or Supabase free tier) or SQL Server, whichever you prefer.

---

## 5. Data model (first pass)

```sql
Sport            (Id, Name)                                  -- football, basketball...
GameType         (Id, Key, Name)                             -- 'starting-xi', 'career-path'...
Team             (Id, Name, ShortName, KitPrimary, KitSecondary, KitStripes, KitNumberColor)
Player           (Id, FullName, DisplayName, Nationality)
PlayerAlias      (Id, PlayerId, Alias, NormalizedAlias)      -- 'zizou', 'زيدان', 'eto'...
Match            (Id, Competition, Date, Venue, HomeTeamId, AwayTeamId, Score, Note)
Lineup           (Id, MatchId, TeamId, Formation)
LineupSlot       (Id, LineupId, PlayerId, ShirtNumber, RowIndex, ColIndex, IsGoalkeeper)
Puzzle           (Id, GameTypeId, LineupId, PublishDate NULL, Difficulty, Status)
```

- `Puzzle.PublishDate` makes a puzzle the daily one for that date. A NULL date means it lives in the archive or the pool.
- `GameType` and `Sport` are there from day one, so new modes don't need schema changes. A future mode may need its own payload table (for example, career path → `CareerStep`).
- Slot x/y positions are computed from `RowIndex` and `ColIndex` on the client, the same way the prototype does it.

---

## 6. API sketch

```
GET  /api/puzzles/today                 -> puzzle without answers (match, formation, slots w/ numbers, kit)
GET  /api/puzzles/{id}                  -> same, for archive
GET  /api/puzzles?before=2026-10-25     -> archive list
POST /api/puzzles/{id}/guess   {text, foundSlots[]}  -> { slotId | null, displayName? }
POST /api/puzzles/{id}/hint    {slotId}              -> { pattern: "M____" }
POST /api/puzzles/{id}/reveal                        -> full XI (after game over / give up)
```

- The client keeps game state in localStorage for now. Later, move it server-side per user or anonymous ID to support streaks and stats.
- Rate-limit `/guess` so nobody can brute-force answers.

---

## 7. Name matching (port from prototype)

**Normalization**
1. Unicode NFD, then strip combining marks (`é → e`, `Č → C`).
2. Lowercase.
3. Arabic:
   - strip tashkeel and tatweel
   - `إ أ آ → ا`, `ة → ه`, `ى → ي`
4. Remove everything except `a-z` and the Arabic letters.
5. Precompute `NormalizedAlias` in the DB for the full name, the display name, and every alias.

**Matching order**
1. Exact match on any normalized key of a not-yet-found slot.
2. Fuzzy match (Levenshtein, thresholds above). Pick the closest.
3. Otherwise count it as a miss.

**Edge cases to handle**
- Two players with the same surname in one XI (for example, the Neville brothers): the first guess fills the first open one, or require a first name. Decide which.
- Single names like Xavi, Pedro or Sylvinho: add the full name as an alias.
- Hyphens and apostrophes: Eto'o → `etoo`, Guivarc'h → `guivarch`.

In C#, `string.Normalize(NormalizationForm.FormD)` plus filtering out `UnicodeCategory.NonSpacingMark` does step 1.

---

## 8. Content pipeline

The biggest risk is wrong data. One wrong name destroys credibility with football fans.

- Start with ~60–100 iconic matches, hand-curated:
  - finals
  - title deciders
  - El Clásicos
  - famous derbies
  - big Arab-region matches (AFC, Arab Cup, Saudi Pro League)
- Cross-check each XI against two sources: Wikipedia match pages plus a stats site.
- Store a `SourceUrl` per lineup for later audits.
- Seed from a JSON file in the repo. The prototype's `MATCHES` array is the starting format.
- Schedule puzzles at least 2 weeks ahead.
- Mix difficulty: easy on Monday, hard at the weekend.

**Prototype lineups (verify before launch!)**

| Team | Match |
|---|---|
| Barcelona | UCL Final 2009 vs Man United |
| Liverpool | UCL Final 2005 vs Milan |
| Spain | World Cup Final 2010 vs Netherlands |
| Man United | UCL Final 1999 vs Bayern |
| France | World Cup Final 1998 vs Brazil |
| Chelsea | UCL Final 2012 vs Bayern |
| Argentina | World Cup Final 2022 vs France |

**Licensing:** Player names and match facts are fine to use. Don't use club crests, official kit designs or player photos. Stick to generic shirts with team colours.

---

## 9. Roadmap

**Phase 1: MVP**
- Repo setup: API, web client, seed data
- Port the prototype UI to React components:
  - Pitch
  - Slot
  - Scoreboard
  - GuessBar
  - ResultCard
  - Archive
- Name matching service plus unit tests (lots of alias and typo cases)
- Daily puzzle endpoint plus 30 days of scheduled content
- Share grid, copy to clipboard
- Deploy and share on Twitter

**Phase 2: Retention**
- Anonymous user ID, streaks, stats (distribution of scores)
- Club mode (play only your club's lineups)
- Full Arabic UI (RTL) in addition to Arabic name matching
- Per-puzzle OG image for nicer link previews

**Phase 3: New modes and sports**
- Career path: guess the player from their sequence of clubs
- Reverse mode: you see the XI, guess the match
- Head-to-head: same lineup, race a friend, via SignalR
- Basketball "starting five" using the same engine with a court layout

---

## 10. Open decisions

- [ ] React vs Flutter Web for the client
- [ ] Postgres vs SQL Server
- [ ] Domain name
- [ ] Should the shirt number be shown by default, or only as a hint? It's currently always shown.
- [ ] Timer mode in addition to the miss limit?
- [ ] How far back the archive goes (all puzzles, or the last 30 days)
- [ ] Monetization later (ads vs none vs premium archive)

---

## 11. First session checklist

1. `dotnet new webapi -n Teamsheet.Api` and `npm create vite@latest teamsheet-web -- --template react-ts`
2. Create the DB schema (section 5) with EF Core migrations
3. Write the `NameMatcher` class + tests first. It's the core of the game.
4. Convert the prototype's `MATCHES` data into a `seed.json`, and verify every XI
5. Build `GET /api/puzzles/today` and `POST /guess`
6. Port the pitch UI from the prototype HTML
