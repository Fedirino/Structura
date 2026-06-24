# Structura — Dune Awakening Base Builder

A web tool for planning bases in [Dune: Awakening](https://www.duneawakening.com/). Calculate power balance, fuel costs, and (coming soon) design base layouts on a 2D grid.

## Live Site

Deployed automatically to Firebase Hosting on push to `main`.

## Tech Stack

- **Frontend:** Plain HTML, CSS, JavaScript — no framework, no build step
- **Hosting:** Firebase Hosting (via GitHub Actions CI)
- **Auth:** Firebase Authentication (Google sign-in) — planned
- **Database:** Firestore (Native mode, Spark plan) — planned
- **Game Data:** Static JSON checked into the repo (`public/data/game-data.json`)

## Project Structure

```
Structura/
├── public/                  # Served by Firebase Hosting
│   ├── index.html           # App entry point
│   ├── styles.css           # All styles (Desert Holtzman theme)
│   ├── app.js               # App logic, APP_VERSION constant
│   └── data/
│       └── game-data.json   # Generator stats, building power costs
├── firestore.rules          # Firestore security rules
├── firebase.json            # Firebase Hosting config
├── CHANGELOG.md
└── README.md
```

## Features

### v0.1.0 — Power Calculator
- Add/remove generators (Fuel, Omni Turbine, Directional Turbine, Spice)
- Add/remove power-consuming buildings (windtraps, fabricators, refineries, etc.)
- Live power balance display (surplus/deficit)
- Fuel cost breakdown over a configurable number of days
- Category filtering for buildings

## Roadmap

- [ ] 2D grid base layout planner
- [ ] Firebase Auth (Google sign-in)
- [ ] Save/load layouts to Firestore
- [ ] Share layouts with friends via `sharedWith` array
- [ ] Building placement with power draw auto-calculated
- [ ] Export/import layout as JSON

## Game Data

Generator stats and building costs are stored in `public/data/game-data.json`. This is static reference data — not user data — so it lives in the repo rather than Firestore.

Funcom patches Dune: Awakening frequently. The data file notes when it was last verified. If you spot outdated numbers, update the JSON and note the new verification date.

## Development

No build step. Open `public/index.html` in a browser, or use any local server:

```bash
cd public
npx serve .
```

## Deploy

Pushes to `main` trigger the GitHub Actions workflow (`.github/workflows/firebase-hosting-deploy.yml`), which deploys `public/` to Firebase Hosting via `FirebaseExtended/action-hosting-deploy`.

## License

Fan project. Not affiliated with Funcom or the Dune franchise.
