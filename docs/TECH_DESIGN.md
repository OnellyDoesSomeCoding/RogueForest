# Rogue Forest: Technical Design (v0.7)

> **For Claude Code:** This is the source of truth for building Rogue Forest. Read it fully before writing code. Build milestone by milestone (see "Milestones"). Every number marked *tunable* lives in `shared/data/config.json`, not in code. If a rule here is unclear or seems wrong, ask instead of guessing. **Do not run `git commit` unless the user asks.**
>
> Art specs live in `ART_SPRITES.md`. Critter IDs match across both docs. The art bundle is in `docs/rogue-forest-art/` and its `assets/` folder is copied into `client/public/assets/`.

---

## 1. Game summary
- Browser-based, turn-based, grid-combat roguelike.
- Inspirations:
  - **Pokerogue:** critter collecting, branching biomes, point-budget starter team, 8-bit look.
  - **Slay the Spire (StS):** floor map with branching paths, room types, relics, shared mana per round.
  - **South Park: The Fractured But Whole (TFBW):** grid combat, move-then-act turns, speed timeline.
- Premise: you are a Druid whose power was stolen. Each boss holds a piece of it. The final boss is the thief.
- Win a run: earn a badge. No permanent stat buffs, ever.
- Story, difficulty tiers: later.

---

## 2. Web flow

```
Home (#/) ──► Login (#/login) ──► Starter Select (#/starter) ──► Game (#/game)
                  ▲                       │
                  └──── Logout ◄──────────┘
```

### 2.1 Home `#/`
- Layout follows a game-site landing page (structure inspired by the Hearthstone site, with our own art, text and branding). Top to bottom:
  1. Sticky nav bar: logo, section links, **Play** button.
  2. Full-height hero: art, logo, tagline *"Reclaim the forest. One critter at a time."*, a genre line, big **Play** button.
  3. Intro block: short pitch (2–3 sentences).
  4. Feature cards: **Collect** (critters), **Position** (grid tactics), **Survive** (50 floors, 5 bosses).
  5. Critter showcase row (the 3 starters + locked silhouettes).
  6. "How to play" list (5 bullets: map, placement, move-then-act, shared mana, enemy intents).
  7. Call-to-action band with a second **Play** button.
  8. Footer: version number, credits.
- Images are generated placeholders (`client/scripts/gen-placeholders.mjs`) until real art exists.
- **Play** button:
  - Logged in → `#/starter`.
  - Logged out → `#/login`.

### 2.2 Login `#/login`
- Two tabs: **Log in** / **Create account**.
- Fields: username, password (+ confirm password on Create).
- No email.
- Visible warning on Create: *"No email means no password reset. Keep your password safe."*
- Validation (client and server):
  - Username: 3–16 chars, `[A-Za-z0-9_]`, case-insensitive unique.
  - Password: 8–72 chars.
- Errors: show one generic message on failed login: *"Invalid username or password."*
- Success → `#/starter`.

### 2.3 Starter Select `#/starter`
- Header: username, badge count, Logout.
- If a saved run exists: modal *"Continue your run?"* → Continue (`#/game`) / Abandon (deletes save).
- Main grid: all 20 critter lines as cards (5 × 4).
  - **Unlocked:** stage-1 sprite, name, type icon(s), point cost.
  - **Locked:** black silhouette (generated in code), name "???", unlock hint on hover.
- New accounts: 3 unlocked (`emberkit`, `dewdle`, `sproutle`), 17 locked.
- Points bar: `used / budget` (budget *tunable*, default 10).
- Team panel: 3 Active slots + 5 Bench slots.
  - Click a card to add it (fills Active first, then Bench). Each line can be picked once. Clicking a picked card removes it.
  - Click a slot to remove.
  - Drag to reorder between Active and Bench.
- Start Run enabled when: at least 1 critter and points ≤ budget.
- Start Run → create run (new seed) → save → `#/game`.
- Dev only (`?dev=1`): seed input field.

### 2.4 Game `#/game`
- Phaser scenes: `MapScene`, `PlacementScene`, `CombatScene`, `RewardScene`, `ShopScene`, `EventScene`, `RestScene`, `TeamScene` (swap active/bench), `GameOverScene`, `VictoryScene`.
- Auto-save after every room.

---

## 3. Tech stack
| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | Shared types between client, server, engine |
| Client build | Vite | Fast dev server |
| Pages (Home, Login, Starter) | Plain HTML/CSS + TS, hash router | Simple forms and lists |
| Game screens | Phaser (latest stable) | Scenes, input, tweens, sprite sheets |
| Server | Node.js + Express | Simple REST API |
| Database | Turso (libSQL) via `@libsql/client` | Hosted SQLite that works on Vercel. Local dev uses a SQLite file (`file:` URL), same code |
| Password hashing | `@node-rs/argon2` (argon2id) | Current best practice, prebuilt binaries for Vercel |
| Hosting | Vercel | Static client + Express API as one serverless function (see §4.4) |
| Validation | `zod` | Same schemas on client and server |
| Tests | Vitest | Engine unit tests |
| RNG | Seeded (mulberry32 or `seedrandom`) | Reproducible runs and save/load |

### 3.1 Folder structure
```
RogueForest/            (git repo root)
  docs/                 TECH_DESIGN.md, ART_SPRITES.md
  shared/
    data/               JSON game data (see §12)
    engine/             Pure TS game logic, no DOM/Phaser
      combat/           grid, turn order, actions, damage, AI
      run/              map gen, rooms, shop, events, rewards
      rng.ts
    types.ts            Shared interfaces
    schemas.ts          zod schemas
  client/
    index.html
    src/
      pages/            home.ts, login.ts, starter.ts
      game/             Phaser scenes + rendering
      api.ts            fetch wrapper
      router.ts
    public/assets/      sprites, tiles, icons, audio
  server/
    src/
      index.ts          local dev entry (listens on a port)
      app.ts            Express app (no listen), shared by dev and Vercel
      routes/           auth.ts, me.ts, run.ts, unlocks.ts, badges.ts
      db.ts             schema + queries (async, libSQL)
      auth.ts           hashing, sessions, middleware
      rateLimit.ts      DB-backed rate limiter
  api/index.ts          Vercel function entry, re-exports the Express app
  vercel.json           build + rewrite config
  package.json          npm workspaces: shared, client, server
```

### 3.2 Engine rules
- `shared/engine` must be pure: input state + action → new state + list of events.
- No `Math.random()`. Always use the run's seeded RNG and store its state in the save.
- Rendering listens to engine events (`moved`, `damaged`, `fainted`, `statusApplied`, …) to play animations.
- Engine must be unit-testable without a browser.

---

## 4. Accounts and server

### 4.1 Security requirements
- Hash passwords with argon2id. Never store or log plaintext passwords.
- Sessions: random 32-byte token in an `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookie. Store only a SHA-256 hash of the token in the DB.
- Session lifetime *tunable* (default 30 days). Logout deletes the session row.
- Rate-limit `/api/auth/*`: 10 attempts / 15 min per IP + username, and 50 / 15 min per IP (*tunable*). Attempts are stored in the `auth_attempts` table, because in-memory counters do not work across serverless instances.
- Parameterized SQL only.
- Validate every request body with zod.
- Same generic error for "no such user" and "wrong password".
- Serve client and API from the same origin (Vite proxy in dev).
- Known limitation: run logic runs on the client, so a determined player can cheat unlocks. Accepted for now.

### 4.2 Database (SQLite)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE unlocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  critter_line TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, critter_line)
);
CREATE TABLE badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE run_saves (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  save_version INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE auth_attempts (
  key TEXT NOT NULL,          -- "ip:<ip>" or "ipuser:<ip>|<username lowercased>"
  attempted_at INTEGER NOT NULL
);
CREATE INDEX auth_attempts_key ON auth_attempts (key, attempted_at);
```
- The server creates missing tables on first use (`CREATE TABLE IF NOT EXISTS`). All queries are async.
- On account creation: insert unlocks for `emberkit`, `dewdle`, `sproutle`.

### 4.3 API
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/signup` | `{username, password}` | `{username}` + session cookie |
| POST | `/api/auth/login` | `{username, password}` | `{username}` + session cookie |
| POST | `/api/auth/logout` | — | `204` |
| GET | `/api/me` | — | `{username, unlocks[], badges[], hasSave}` |
| GET | `/api/run` | — | saved run or `404` |
| PUT | `/api/run` | `{saveVersion, state}` | `204` |
| DELETE | `/api/run` | — | `204` |
| POST | `/api/unlocks` | `{critterLine}` | `{unlocks[]}` |
| POST | `/api/badges` | `{badgeId}` | `{badges[]}` |

- All routes except signup/login require a valid session (`401` otherwise).
- `critterLine` and `badgeId` must exist in game data (validate against the JSON).

### 4.4 Deployment (Vercel + Turso)
- Client: `npm run build` builds `client/dist`, served by Vercel as static files.
- API: `api/index.ts` exports the Express app. `vercel.json` rewrites `/api/*` to it. Same origin as the client.
- Database: a Turso database. Set these environment variables in Vercel:
  - `TURSO_DATABASE_URL` (`libsql://…`)
  - `TURSO_AUTH_TOKEN`
- Local dev: no variables needed. The server falls back to `file:server/data/dev.db`.
- Vercel functions have no persistent disk and no shared memory. Never store state in files or in module-level variables.

---

## 5. Run structure
- **50 floors = 5 acts × 10 floors.** One biome per act.
- **5 bosses** on floors 10, 20, 30, 40, 50.
- Act 1: Sunlit Meadow (fixed). Acts 2–4: branching biome choice. Act 5: Withered Heartwood (fixed, automatic after floor 40). More final stages later.
- After the bosses on floors 10, 20, 30: pick 1 of 2–3 random biomes from the optional pool (no repeats in a run).
- Grid size grows with depth (see §7.1).

### 5.1 Map generation (per act, StS style)
- 10 rows (floors). Floors 1–8: 2–4 nodes each. Floor 9: Rest nodes only. Floor 10: single Boss node.
- Each node connects to 1–2 nodes on the next floor. Paths must not cross.
- Every node must be reachable from floor 1 and must reach the boss.
- Floor 1: Normal fights only.
- Node weights for floors 2–8 (*tunable*):

| Room | Weight | Rule |
|---|---|---|
| Normal | 45 | — |
| Event | 22 | — |
| Elite | 12 | Floor ≥ 4 |
| Shop | 12 | At least 1 per act |
| Rest | 9 | Floors 4–7 only (never floor 8, since floor 9 is all Rest), not on consecutive floors in one path |

### 5.2 Room types
| Room | What happens |
|---|---|
| Normal | Fight wild critters from the biome pool. Reward: Acorns, XP. |
| Elite | Fight a stronger critter at the highest stage its level allows (+ minions). Reward: Acorns, XP, **Captive offer**, relic chance. |
| Boss | Fight the act boss. Reward: Acorns, XP, **Captive offer**, **Druid power** (pick 1 of 3), relic. |
| Shop | Buy critters, critter packs, potions, relics. |
| Rest | Pick one: **Heal** (living critters +30% max HP) or **Train** (one critter +1 level). |
| Event | Text event with choices (see §10). |

### 5.3 End of every room
1. Apply room rewards.
2. **Fainted critters regain 1 HP** (any room type). There is no other revive.
3. Auto-save.
4. Return to map.

Note: Rest's Heal only affects critters with HP > 0. Fainted critters still get their +1 HP when the Rest room ends.

### 5.4 Losing and winning
- A fight is lost when all active critters on the grid have fainted. **Losing a fight ends the run.**
- Beat the floor 50 boss → `VictoryScene`, award badge `run_clear` (more badges later), delete save.
- Run over → `GameOverScene` with summary (floor reached, team, relics), delete save.

---

## 6. Critters

### 6.1 Team
- Up to 8 critters: **3 Active + 5 Bench.**
- Active/Bench swaps only happen **outside combat** (map screen → `TeamScene`, and the placement screen before a fight). No mid-fight swaps.
- Starting level: 5 (*tunable*).

### 6.2 Types
- 8 types: **Ember** (fire), **Dew** (water), **Clay** (earth), **Zephyr** (wind), **Gloom** (darkness), **Lume** (light), **Iron** (steel), **Flora** (plants).
- Critters have 1 or 2 types.

| Attacker | Strong against (×1.5) | Resisted by (×0.75) |
|---|---|---|
| Ember | Flora, Iron | Dew, Gloom |
| Dew | Ember, Clay | Flora, Lume |
| Clay | Iron, Zephyr | Dew, Flora |
| Zephyr | Flora, Gloom | Clay, Iron |
| Flora | Dew, Clay | Ember, Zephyr |
| Iron | Zephyr, Lume | Ember, Clay |
| Gloom | Lume, Ember | Zephyr |
| Lume | Gloom, Dew | Iron |

- "Resisted by X" means X's type is strong against the attacker.
- Exception: Gloom and Lume are strong against each other (×1.5 both ways). Neither resists the other.
- Dual-type defender: multiply both multipliers (range ×0.5625 to ×2.25).
- Same-type bonus: ×1.2 if the move's type matches one of the user's types (*tunable*).
- No grid effects tied to types. Moves define all effects.

### 6.3 Stats
| Stat | Meaning |
|---|---|
| HP | Health. 0 = fainted. HP carries over between rooms. |
| ATK | Damage dealt |
| DEF | Damage taken |
| SPD | Turn order |
| MOV | Tiles the critter can move per turn |

- Role templates for stage-1 base stats (placeholders, *tunable*):

| Role | HP | ATK | DEF | SPD | MOV |
|---|---|---|---|---|---|
| Tank | 60 | 8 | 12 | 4 | 2 |
| Striker | 40 | 13 | 7 | 7 | 3 |
| Support | 45 | 8 | 8 | 6 | 3 |
| Control | 45 | 10 | 8 | 6 | 3 |
| Skirmisher | 38 | 11 | 6 | 9 | 4 |

- Evolution multiplies HP/ATK/DEF base: stage 2 ×1.3, stage 3 ×1.6. SPD +1 per stage. MOV unchanged.
- Level scaling: `stat = round(base × (1 + 0.06 × (level − 1)))` for HP, ATK, DEF. SPD and MOV don't scale with level.

### 6.4 Leveling and evolution
- XP to next level: `20 × level` (*tunable*).
- Base XP per won fight: `sum of enemy levels × 4` (*tunable*).
- Every critter placed in the fight gains the full base XP, including critters that fainted. XP is not split.
- Bench critters gain `(floor × 2)%` of the base XP (floor 10 = 20%, floor 50 = 100%) (*tunable*).
- Evolution happens automatically at the level in the critter's data (Pokémon style), shown with a short animation after the fight.
- Moves stay the same on evolution (placeholder; move learning may come later).
- Branching evolutions: supported in data (`evolvesTo` can be an array, player picks). None in the placeholder roster yet.

### 6.5 Catching (Captive offers)
- Normal enemies can't be caught.
- After beating an Elite or Boss: a **Captive offer** for that critter (at its current stage and level).
- Paid in **Acorns**. Take it or leave it.
- Price (*tunable*): Elite 40, Boss 90. Clean win (no ally fainted) = 25% off.
- Bench full → must release one critter to take the offer.
- Buying a critter from a line you haven't unlocked **unlocks that line for Starter Select** (`POST /api/unlocks`). The same applies to shop and pack purchases. This is the main unlock path.

### 6.6 Starter point budget
- Budget 10 (*tunable*). Costs are in the roster table (§6.7).
- New account can take all three starters (3 + 3 + 3 = 9).

### 6.7 Placeholder roster (20 lines)
Visuals for every ID are in `ART_SPRITES.md`. Moves reference §8.3.

| # | Line ID | Stages (evolve level) | Types | Role | Optimal tile | Cost | Moves |
|---|---|---|---|---|---|---|---|
| 1 | emberkit | Emberkit → Cindervix (16) → Pyrovulp (32) | Ember | Striker | Front | 3 | E1 E2 E3 E4 |
| 2 | dewdle | Dewdle → Brookle (16) → Torrentail (32) | Dew | Support | Back | 3 | D1 D2 D3 D4 |
| 3 | sproutle | Sproutle → Thornhog (16) → Briarback (32) | Flora | Tank | Front | 3 | F1 F2 F4 N2 |
| 4 | pebbun | Pebbun → Boulderbun (20) | Clay | Tank | Front | 2 | C1 C2 C3 N2 |
| 5 | gustling | Gustling → Galefinch (16) → Tempestrel (32) | Zephyr | Skirmisher | Flank | 3 | Z1 Z2 Z3 Z4 |
| 6 | lumoth | Lumoth → Lanternmoth (22) | Zephyr / Lume | Support | Back | 3 | Z1 Z2 L2 L3 |
| 7 | shadewick | Shadewick → Duskowl (24) | Gloom | Control | Back | 3 | G1 G2 G3 G4 |
| 8 | glimmet | Glimmet → Radiantis (22) | Lume | Support | Back | 3 | L1 L2 L3 L4 |
| 9 | rivetle | Rivetle → Bastionbeetle (24) | Iron | Tank | Front | 3 | I1 I2 I3 I4 |
| 10 | claypaw | Claypaw → Mireotter (22) | Clay / Dew | Control | Flank | 4 | C1 C3 D2 D4 |
| 11 | sporeling | Sporeling → Mycelord (26) | Gloom / Flora | Control | Back | 4 | F1 F2 G2 G4 |
| 12 | ashmole | Ashmole → Magmole (24) | Ember / Clay | Striker | Front | 4 | E1 E3 C2 C4 |
| 13 | pollenbee | Pollenbee → Bloomqueen (24) | Flora / Zephyr | Support | Flank | 4 | F1 F4 Z1 Z2 |
| 14 | frostfawn | Frostfawn → Rimestag (26) | Dew / Iron | Tank | Front | 5 | D1 D2 I2 I3 |
| 15 | rustrat | Rustrat → Scrapking (22) | Iron / Gloom | Skirmisher | Flank | 4 | I1 I3 G1 G2 |
| 16 | wisplet | Wisplet (no evolution) | Lume / Ember | Control | Back | 6 | L1 L4 E2 E4 |
| 17 | cinderbat | Cinderbat → Blazewing (24) | Ember / Zephyr | Skirmisher | Flank | 4 | E1 E2 Z1 Z4 |
| 18 | shellcrag | Shellcrag → Fortortoise (28) | Clay / Iron | Tank | Front | 5 | I1 C2 I2 I4 |
| 19 | sunpetal | Sunpetal → Solbloom (24) | Lume / Flora | Support | Back | 5 | L2 L3 F1 F4 |
| 20 | murkling | Murkling → Bogmaw (24) | Dew / Gloom | Control | Flank | 4 | D1 D2 G1 G3 |

- Base stats = role template from §6.3.
- Locked-card unlock hints (placeholder): *"Buy one during a run to unlock."*

---

## 7. Combat

### 7.1 Grid
- Rectangular, columns × rows. Player starts on the left, enemies on the right.
- Size by depth (*tunable*):

| Floors | Normal | Elite | Boss |
|---|---|---|---|
| 1–10 | 5×3 | 6×4 | 7×5 |
| 11–20 | 6×4 | 7×5 | 7×5 |
| 21–30 | 7×4 | 7×5 | 8×6 |
| 31–40 | 7×5 | 8×6 | 9×7 |
| 41–50 | 8×6 | 9×7 | 9×7 |

- One unit per tile. Obstacles (rocks) block movement and line attacks.
- Normal fights have a 50% chance of one rock in the middle column (*placeholder*).
- Distance = Manhattan. Movement is 4-directional, can't pass through units or obstacles.

### 7.2 Placement (pre-fight)
- Enemies are placed and visible first.
- Player may swap Active/Bench here, then places the 3 active critters on **any empty tile** (*tunable*: `placementZone: "any" | "half"`, default `"any"`).
- **Optimal tiles** (bonus, never required). Checked at the start of each of the critter's turns:
  - Each side's half is `ceil(columns / 2)` columns. On odd widths the middle column belongs to both halves.
  - Front: the 2 columns of a side's half nearest the grid center.
  - Back: the 2 columns of a side's half at the far edge.
  - On small grids Front and Back can overlap. Each critter only checks its own optimal tile type.
  - Zones are the same for both sides. A player critter standing in the enemy's Front columns also gets the bonus.
  - Flank: top or bottom row.
  - Bonus: +10% damage dealt (*tunable*).
- Show the bonus zone as a soft tile tint while placing.

### 7.3 Round flow
1. **Round start:** refill mana to max. Tick down move cooldowns by 1.
2. **Enemy intents:** each enemy picks a destination tile + a move + target tiles. Show them:
   - Ghost outline on the destination tile.
   - Red highlight on attack tiles, with the move icon above the enemy.
3. **Turn order:** all units sorted by SPD (high first). Ties: player units first, then lower slot index. Shown as a timeline bar at the top.
4. **Each unit's turn:**
   - Start: apply status ticks (Burn, Regen), check Stun.
   - Player critter: **move up to MOV tiles, then use one move** (or skip either). Moving after attacking is not allowed.
     - One move action per turn (a single path of up to MOV tiles).
     - Using a move ends the turn automatically. **End Turn** skips the rest of the turn.
   - Enemy: moves to its ghost tile (nearest free tile if blocked), then attacks its declared tiles.
5. **Round end:** remove expired statuses.

### 7.4 Enemy intents rules
- Intents target **tiles**, not units. Step out of the red tiles to dodge.
- If an enemy is pushed, pulled, or rooted before its turn, it still attacks the declared tiles **only if** they're in range of its new position. Otherwise the attack fizzles.
- Stunned enemies lose their turn (intent cancelled). A Stun applied before the enemy acts cancels its intent right away. An enemy that is stunned when the round starts declares no intent.
- Enemies plan at round start, against where your critters stand then. Two enemies never plan to walk to the same tile.
- On its turn an enemy walks to its ghost tile. If that tile is blocked, it walks to the reachable tile nearest to it (or stays, if staying is as close). Rooted enemies stay put.
- **Attacks only ever hit tiles that were shown red.** After walking, the attack is re-aimed from where the enemy stands and keeps only the declared tiles it can still reach. None left = it fizzles ("out of range").
- Heals and buffs (green badge, no red tiles) re-aim the same way, but they are not limited to declared tiles. Self-centered ones follow the enemy.
- Enemies do not hurt each other (no friendly fire), and do not place rocks yet.
- UI: red tiles for attacks, a faded ghost of the enemy on its destination tile, a badge with the move's type icon in the corner of the enemy's tile, and the expected damage in the corner of each of your critters standing on red tiles.

### 7.5 Mana (StS style)
- Shared team pool. Max 3 per round (*tunable*), refilled each round. Unused mana is lost.
- Moves cost 0–3 mana.
- Relics and Druid powers can change max mana or give bonus mana.
- Enemies don't use mana. They use cooldowns only.

### 7.6 Damage
```
damage = max(1, round( power × ATK / (DEF × K) × typeMult × sameTypeBonus × optimalBonus × variance ))
K = 4 (tunable)
variance = seeded random 0.9–1.1
```
- Crits: none by default (relics may add: ×1.5).

### 7.7 Statuses
| Status | Effect | Default duration |
|---|---|---|
| Burn | Lose 8% max HP at turn start | 2 turns |
| Root | Can't move | 2 turns |
| Slow | MOV −1, SPD −2 | 2 turns |
| Stun | Skip next turn | 1 turn |
| Weak | Deal −25% damage | 2 turns |
| Guard | Take −40% damage | 1 turn |
| Regen | Heal 8% max HP at turn start | 3 turns |
| Evade | Next hostile move that hits it does nothing to it (no damage, no status, no push) | Until hit or 2 turns |
| Empower | Deal +25% damage | 2 turns |
| Haste | MOV +1, SPD +2 | 2 turns |

- Durations count the holder's own turns and tick down at the end of each of its turns. Guard for 1 turn therefore protects until the end of the holder's next turn.
- Round-based things stay in rounds: mana refill, cooldown ticks, intents, and placed obstacles (Earth Wall).
- Same status reapplied refreshes duration (doesn't stack).
- Status data (durations, numbers, icons) lives in `statuses.json`.
- Burn and Regen happen at the start of the holder's turn, before Stun is checked. Burn can make a critter faint.
- Weak, Empower and Guard multiply the final damage (×0.75, ×1.25, ×0.6). Spike Shot ignores Guard. Damage is still at least 1.
- Slow and Haste change MOV right away, and SPD (turn order) from the next round.
- Icons: the art bundle's burn, stun, weak, regen, haste and shield (used for Guard). Root, Slow, Evade and Empower are drawn in code until real files are added at `assets/icons/status_<name>.png` (names in `statuses.json`).

### 7.8 Fainting
- HP 0 → removed from the grid for the rest of the fight.
- Regains 1 HP at the end of the room (§5.3).

### 7.9 Enemy AI (simple, placeholder)
- For each usable move, for each reachable tile: score = expected damage on player critters in the target tiles (+ bonus for likely faints, + small bonus for staying on its optimal tile).
- Pick highest score, with small seeded randomness so it isn't perfectly predictable.
- Support enemies prefer heals/guards when an ally is below 50% HP.
- Scoring (placeholder): expected damage (+15 if it would faint the target), plus values for bad statuses on you (Stun 18, Weak 8, Burn 8, Root 6, Slow 5), push/pull 2, and heals or good statuses on allies (worth more below 50% HP, ×1.5 for support critters). +1 for its optimal tile, +0.3 per tile closer to your nearest critter, and up to 10% seeded noise.

---

## 8. Moves

### 8.1 Move fields
```ts
interface Move {
  id: string;            // "E1"
  name: string;
  type: TypeId | "Neutral";
  mana: number;          // 0–3
  cooldown: number;      // own turns before reuse; 0 = every turn, 1 = skip one own turn
  power: number;         // 0 for non-damage moves
  range: [min: number, max: number]; // Manhattan distance from user to target tile
  shape: "single" | "line" | "plus" | "square3" | "around" | "row" | "self";
  target: "enemy" | "ally" | "tile" | "self";
  effects: Effect[];     // push, pull, status, heal, obstacle, lifesteal
}
```
- Shapes:
  - `single`: one tile.
  - `line`: straight line from the user, length = range max, in one of 4 directions. Stops at obstacles. Also stops at the first unit it meets (ally or enemy), unless the move pierces.
  - `plus`: target tile + 4 neighbors.
  - `square3`: 3×3 around the target tile.
  - `around`: the 8 tiles around the user.
  - `row`: every tile in a row or column from the user, until an obstacle. Passes through units.
  - `self`: the user.
- No friendly fire: `enemy` moves only affect the other side, `ally` moves only affect the user's side (including the user).
- A player can only aim a move where it would affect at least one unit, so mana is never wasted on empty tiles.
- Effects in `moves.json`: `status`, `push`, `pull`, `pullToCenter`, `heal`, `lifesteal`, `obstacle`, `pierce`, `ignoreGuard`, `cleanse`, `includeSelf`.
- Push/pull: move the target N tiles away from/toward the user. Blocked by units, obstacles, and grid edge → stops, takes 5% max HP collision damage.
  - The direction is along the longer axis between the user and the target. Ties go horizontal.
  - A pull that ends against the user itself is not a collision.
  - Several targets: the farthest is pushed first (the nearest is pulled first), so a line of units does not block itself.
  - `pullToCenter` (Cyclone) moves each target 1 tile toward the aimed tile, nearest first. A target on the center does not move.
- Earth Wall (`obstacle`) needs an empty tile. The rock lasts the rest of this round and the next one, and crumbles at the start of the round after.

### 8.2 Design rule
- Every critter needs at least one move that costs ≤ 1 mana with cooldown 0.

### 8.3 Placeholder move list
| ID | Name | Type | Mana | CD | Power | Range | Shape | Effects |
|---|---|---|---|---|---|---|---|---|
| N2 | Guard Up | Neutral | 1 | 2 | 0 | 0 | self | Guard |
| E1 | Spark | Ember | 1 | 0 | 45 | 1–3 | single | — |
| E2 | Flame Line | Ember | 2 | 1 | 50 | 1–3 | line | Burn |
| E3 | Fireburst | Ember | 3 | 3 | 70 | 2–4 | square3 | — |
| E4 | Kindle | Ember | 1 | 2 | 0 | 0 | self | Empower |
| D1 | Splash | Dew | 1 | 0 | 40 | 1–3 | single | Slow |
| D2 | Tidal Push | Dew | 2 | 1 | 40 | 1–3 | line | Push 2 |
| D3 | Mending Rain | Dew | 2 | 3 | 0 | 0–3 | plus | Heal 30% (allies) |
| D4 | Bubble Shield | Dew | 1 | 2 | 0 | 0–2 | single | Guard (ally) |
| C1 | Pebble Toss | Clay | 1 | 0 | 40 | 2–4 | single | — |
| C2 | Quake Stomp | Clay | 2 | 2 | 50 | 0 | around | — |
| C3 | Earth Wall | Clay | 1 | 3 | 0 | 1–3 | single | Place rock on empty tile, 2 rounds |
| C4 | Landslide | Clay | 3 | 3 | 60 | 1–9 | row | — |
| Z1 | Gust | Zephyr | 1 | 0 | 35 | 1–3 | single | Push 1 |
| Z2 | Tailwind | Zephyr | 2 | 3 | 0 | 0 | around | Haste (allies) |
| Z3 | Cyclone | Zephyr | 2 | 2 | 40 | 2–3 | square3 | Pull 1 toward center |
| Z4 | Razor Wind | Zephyr | 2 | 1 | 55 | 1–4 | line | Pierces units |
| F1 | Vine Lash | Flora | 1 | 0 | 40 | 1–2 | single | Pull 1 |
| F2 | Entangle | Flora | 2 | 2 | 25 | 1–3 | single | Root |
| F3 | Sap Drain | Flora | 2 | 1 | 45 | 1–2 | single | Heal self 50% of damage |
| F4 | Bloom | Flora | 2 | 3 | 0 | 0–2 | plus | Heal 25% + Regen (allies) |
| I1 | Iron Claw | Iron | 1 | 0 | 50 | 1 | single | — |
| I2 | Bulwark | Iron | 1 | 2 | 0 | 0 | around | Guard on self + adjacent allies |
| I3 | Spike Shot | Iron | 2 | 1 | 45 | 2–4 | single | Ignores Guard |
| I4 | Anvil Drop | Iron | 3 | 3 | 80 | 1–3 | single | Stun |
| G1 | Shadow Bite | Gloom | 1 | 0 | 45 | 1 | single | — |
| G2 | Dread Gaze | Gloom | 1 | 2 | 0 | 1–3 | single | Weak |
| G3 | Night Veil | Gloom | 2 | 3 | 0 | 0–2 | single | Evade (ally) |
| G4 | Soul Drain | Gloom | 2 | 1 | 50 | 1–3 | single | Heal self 50% of damage |
| L1 | Glint | Lume | 1 | 0 | 35 | 1–4 | single | — |
| L2 | Flash | Lume | 2 | 2 | 20 | 1–3 | plus | Weak |
| L3 | Radiance | Lume | 2 | 2 | 0 | 0–4 | single | Heal 35% + remove bad statuses (ally) |
| L4 | Sunbeam | Lume | 3 | 3 | 65 | 1–9 | row | — |

- Note: `D4`, `G3`, `L3` and similar ally moves can target the user (range 0).
- `F3` (Sap Drain) isn't used by any placeholder critter yet. Keep it for future critters.

---

## 9. Shop, potions, relics, Druid powers

### 9.1 Currency
- **Acorns.** Earned (*tunable*): Normal 10–15, Elite 25–35, Boss 60. Events can give or take.

### 9.2 Shop stock (rerolled per shop)
| Slot | Count | Price (Acorns) | Notes |
|---|---|---|---|
| Critter | 2 | 50–80 | From current biome pool, level ≈ floor level |
| Critter Pack | 1 | 60 | Reveal 3 critters, pick 1 or skip |
| Mega Pack | 1 (30% chance) | 100 | Reveal 5 critters, pick up to 2 or skip |
| Potion | 3 | 20–35 | — |
| Relic | 2 | 80–150 | Price by rarity |

- Packs work like Balatro packs: open after buying, choose or skip. Skipping refunds nothing.
- Bench-full rule applies to every critter purchase.

### 9.3 Potions (placeholder)
- 3 potion slots. Use on a player critter's turn. Costs no mana and no action.

| ID | Name | Effect |
|---|---|---|
| healing_sap | Healing Sap | Heal one critter 40% max HP (not fainted) |
| mana_dew | Mana Dew | +2 mana this round |
| swiftseed | Swiftseed | One critter +2 MOV this turn |
| ironbark_tonic | Ironbark Tonic | Guard on one critter for 2 turns |
| smoke_pod | Smoke Pod | Cancel one enemy's intent this round |
| fury_berry | Fury Berry | One critter +50% damage this turn |

### 9.4 Relics (placeholder)
| ID | Name | Rarity | Effect |
|---|---|---|---|
| acorn_pouch | Acorn Pouch | Common | +20% Acorns |
| mossy_stone | Mossy Stone | Common | +1 mana on round 1 |
| hollow_log | Hollow Log | Common | Bench XP share +50 percentage points (max 100%) |
| healing_spring | Healing Spring | Common | Living critters heal 10% max HP at end of room |
| merchants_bell | Merchant's Bell | Uncommon | Shop prices −20% |
| thorn_bracelet | Thorn Bracelet | Uncommon | Melee attackers take 5% of their max HP |
| lucky_clover | Lucky Clover | Uncommon | 10% crit chance (×1.5) |
| wind_chime | Wind Chime | Uncommon | All critters +1 MOV |
| sharp_fang | Sharp Fang | Uncommon | 0-cooldown moves +15% damage |
| feather_token | Feather Token | Rare | Once per fight, first critter that would faint stays at 1 HP |
| druid_staff | Druid's Staff | Rare | +1 max mana |
| type charms (×8) | e.g. Ember Charm | Common | That type's moves +15% damage |

### 9.5 Druid powers (boss rewards, placeholder)
- After each boss on floors 10–40: pick 1 of 3. Lasts the whole run.

| ID | Name | Effect |
|---|---|---|
| verdant_heart | Verdant Heart | All critters +15% max HP |
| wild_mana | Wild Mana | +1 max mana |
| fleetfoot | Fleetfoot | All critters +1 MOV |
| thorned_hide | Thorned Hide | Reflect 10% damage taken |
| rooted_will | Rooted Will | Immune to Root and Slow |
| sunward | Sunward | Start each fight with Regen on all critters |

---

## 10. Events (placeholder)
- Format: title, short text, 2–3 choices, each with outcomes. Outcomes can be random (seeded).

| ID | Title | Choices |
|---|---|---|
| wishing_well | Wishing Well | Toss 20 Acorns (50%: random relic) / Leave |
| abandoned_camp | Abandoned Camp | Search (random potion) / Rest (heal living critters 20%) |
| wounded_critter | Wounded Critter | Help it (−25 Acorns, get it free at low level) / Walk away |
| mushroom_ring | Mushroom Ring | Step inside (random: +1 level to one critter OR −20% HP to all) / Avoid |
| traveling_merchant | Traveling Merchant | Trade a potion for a relic / Buy a mystery pack (40 Acorns) / Leave |
| old_shrine | Shrine of the Old Druid | Pray (one critter +1 level, another −15% HP) / Leave |
| strange_egg | Strange Egg | Take it (hatches into a random critter after 3 rooms) / Leave |
| river_fork | Fork in the River | Wade across (−10% HP all, +30 Acorns) / Go around (nothing) |
| hunters_trap | Hunter's Trap | Free the critter (fight it) / Sneak past |
| fallen_log | Fallen Log | Look under it (random: potion, Acorns, or ambush fight) / Ignore |

---

## 11. Biomes and bosses

### 11.1 Biomes
| ID | Name | Types | Critter pool | Act |
|---|---|---|---|---|
| meadow | Sunlit Meadow | Flora, Zephyr | gustling, pollenbee, sproutle, lumoth, pebbun | 1 (fixed) |
| marsh | Mistwater Marsh | Dew, Gloom | dewdle, murkling, shadewick, claypaw, sporeling | 2–4 |
| scorched | Scorched Grove | Ember, Flora | emberkit, ashmole, cinderbat, sproutle, wisplet | 2–4 |
| canyon | Clay Canyon | Clay, Zephyr | pebbun, ashmole, shellcrag, gustling, claypaw, cinderbat | 2–4 |
| rustwood | Rustwood Ruins | Iron, Gloom | rivetle, rustrat, shadewick, shellcrag | 2–4 |
| glowcap | Glowcap Caverns | Lume, Gloom, Flora | glimmet, sunpetal, sporeling, wisplet, lumoth | 2–4 |
| frostpine | Frostbitten Pines | Dew, Iron | frostfawn, rivetle, dewdle, murkling | 2–4 |
| heartwood | Withered Heartwood | All | all 20 | 5 (fixed) |

- Biomes are cosmetic + critter pool for now (no special tile rules yet).
- Enemy level by floor: `2 + floor(floor × 0.85)`. Elite +2. Boss +4 (*tunable*).
- Normal fights: 2–4 enemies (by grid size). Elite: 1 elite + 1–2 minions. Boss: boss + 0–2 minions.

### 11.2 Bosses (placeholder)
- Bosses are **Alpha** versions of a roster critter's final stage: HP ×4, ATK ×1.3, 64×64 sprite, 1 extra signature move (TBD).
- Their Captive offer gives the normal (non-Alpha) final-stage critter.

| Biome | Boss | Based on |
|---|---|---|
| meadow | The Meadow Queen | Alpha Bloomqueen |
| marsh | The Bog Maw | Alpha Bogmaw |
| scorched | The Ashen Tyrant | Alpha Magmole |
| canyon | The Crag Colossus | Alpha Fortortoise |
| rustwood | The Rust Monarch | Alpha Scrapking |
| glowcap | The Mycel Oracle | Alpha Mycelord |
| frostpine | The Rime Stag | Alpha Rimestag |
| heartwood | The Hollow Druid (the thief) | Unique, not catchable, 2 phases (TBD) |

---

## 12. Data files (`shared/data/`)
| File | Contents |
|---|---|
| `config.json` | All *tunable* numbers (mana, budget, XP curve, prices, weights, grid sizes, K) |
| `types.json` | Type list + chart |
| `critters.json` | Lines, stages, types, role, stats, moves, evolve levels, cost, optimal tile |
| `moves.json` | §8.3 |
| `statuses.json` | §7.7 |
| `potions.json`, `relics.json`, `druid_powers.json` | §9 |
| `events.json` | §10 |
| `biomes.json`, `bosses.json` | §11 |
| `badges.json` | `run_clear` for now |

Example `critters.json` entry:
```json
{
  "line": "emberkit",
  "types": ["Ember"],
  "role": "Striker",
  "optimalTile": "front",
  "cost": 3,
  "moves": ["E1", "E2", "E3", "E4"],
  "stages": [
    { "id": "emberkit", "name": "Emberkit", "evolveAt": 16 },
    { "id": "cindervix", "name": "Cindervix", "evolveAt": 32 },
    { "id": "pyrovulp", "name": "Pyrovulp", "evolveAt": null }
  ]
}
```
- Stats come from the role template unless a `statsOverride` is present.
- Sprites load by stage ID: `assets/critters/<stageId>.png` (see `ART_SPRITES.md`).

---

## 13. Save format
```ts
interface RunSave {
  saveVersion: 1;
  seed: string;
  rngState: number;
  floor: number;            // 1–50
  act: number;              // 1–5
  biomeId: string;
  biomeHistory: string[];
  map: MapNode[];           // current act
  currentNodeId: string | null;
  team: { active: OwnedCritter[]; bench: OwnedCritter[] };
  acorns: number;
  potions: (string | null)[]; // 3 slots
  relics: string[];
  druidPowers: string[];
  pendingEggs?: { hatchInRooms: number }[];
}
interface OwnedCritter {
  uid: string; line: string; stageId: string;
  level: number; xp: number; hp: number; // hp 0 = fainted
}
```
- Save to server (`PUT /api/run`) after every room. Mirror in `localStorage` as a fallback.
- No mid-combat saves. Reloading during a fight restarts that fight from its start state.

---

## 14. Rendering and UI notes
- Base resolution 480×270, integer-scaled to fit the window. `pixelArt: true` in Phaser (nearest-neighbor).
  - The zoom is worked out in device pixels, so screens with 125% or 150% scaling are not stretched by the browser. The canvas has 480×270 × zoom device pixels, and each scene's camera zooms by the same factor.
  - When the window crosses a zoom step, or the screen scaling changes, the Phaser game is rebuilt at the new size and continues from the stored combat state.
- UI text is HTML drawn on top of the canvas (`client/src/game/domText.ts`), so the browser renders it at full screen resolution.
  - HTML text is always above the canvas. When a canvas backdrop must cover text (like a popup's dark background), the scene hides the text below it.
  - Text that must move with a sprite inside a Phaser container stays as canvas text (`canvasLabel`).
- Tile = 32×32. Critter sprites = 48×48, anchored bottom-center on the tile (they overlap upward).
- Critter sheets are 288×48: 6 frames of 48×48 in this order: idle A, idle B, windup, strike, hurt, faint.
- Player critters face right. Enemy critters use the same sprite, flipped.
- Highlights drawn in code: move range (blue), attack range (yellow), enemy intents (red), optimal zone (soft green).
- Timeline bar: small portraits in turn order at the top.
- HUD: mana pips, Acorns, potions, relics row.
- Placeholder mode: if a sprite file is missing, draw a colored circle using the critter's first type color + its initial letter. The game must run with zero art.

---

## 15. Milestones
| # | Goal | Done when |
|---|---|---|
| M0 | Monorepo setup | `npm run dev` starts client + server; Vitest runs |
| M1 | Pages + auth | Home, Login, Starter Select work; signup/login/logout; 3 starters unlocked |
| M2 | Combat sandbox | One 5×3 fight: placement, move-then-act, mana, cooldowns, timeline, type chart. Damage, heals, lifesteal and pierce work. Enemies use a simple "best damage" turn. Moves that only apply a status, push/pull or a rock are disabled until M3 |
| M3 | Intents + AI | Enemy intents, dodging, push/pull, statuses. All moves usable. Support enemies heal and guard |
| M4 | Map + rooms | Act 1 map, room flow, rewards, faint +1 HP rule, game over |
| M5 | Economy | Shop, packs, potions, relics, Captive offers, unlocks API |
| M6 | Growth | XP, levels, evolution, Rest (Heal/Train), TeamScene |
| M7 | Full run | 5 acts, biome forks, bosses, Druid powers, victory + badge |
| M8 | Save/load | Server save + localStorage fallback, Continue modal |
| M9 | Art + audio | Swap in sprites, chiptune music, SFX |
| M10 | Polish | Balance pass, events, animations |

---

## 16. Open questions
- Screen layout for big grids: a 9×7 grid is 288×224 px, which does not fit the 480×270 screen next to the side panels. Needs smaller tiles, a scrolling board, or collapsible panels (before M7).
- Art still missing: status icons for Root, Slow, Evade and Empower (drawn in code for now). The bundle's potion and relic icon names do not match §9 yet.
- Boss signature moves and the Hollow Druid's phases.
- Biome-specific tile rules (later?).
- Move learning on level up / evolution.
- Branching evolutions: which critters?
- Difficulty tiers after a win.
- More final stages after floor 40.
- Story and the Druid's identity.
- More badges.
