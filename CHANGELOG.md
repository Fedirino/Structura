# Changelog

## 0.3.0 — 2026-06-23

- Firebase Authentication with Google sign-in
- Save/load layouts to Firestore (cloud sync across devices)
- Layout picker with load, delete, and rename support
- Three.js 3D preview with orbit camera, pan, and zoom
- Multi-layer 3D visualization (buildings stacked by floor)
- 2D/3D view toggle in layout planner toolbar
- Save As for duplicating layouts
- Layout limit of 20 per user (Spark plan)
- Auth state persists across sessions

## 0.2.0 — 2026-06-23

- 2D layout planner with 60x60 grid canvas
- Multi-layer support: Basement, Ground, Upper, Roof
- Building palette with 40 placeable items across 8 categories
- Pan (right/middle-click drag), zoom (scroll wheel), keyboard shortcuts
- Ghost preview on hover, collision detection, erase tool
- Power summary auto-calculated from placed buildings across all layers
- Added grid sizes, colors, and abbreviations to game data
- Structural items added: foundations, walls, doors, stairs, ramps, storage
- Nav switching between Power Calculator and Layout Planner views

## 0.1.0 — 2026-06-23

- Initial scaffold: plain HTML/JS/CSS, no build step
- Power calculator with all four generator types (Fuel, Omni Turbine, Directional Turbine, Spice)
- Power consumption tracker for 20+ building types across 5 categories
- Fuel cost breakdown over configurable time period
- Game data JSON with stats verified against community sources (Aug 2025)
- Firestore security rules for users and layouts collections
- Firebase Hosting deploy-on-push via GitHub Actions
