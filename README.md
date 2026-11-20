# Neon Shores

[![make.fun GTA 6 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Neon Shores rank](https://make.fun/badge/gta6-01/aldy007x/neon-shores-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/aldy007x/neon-shores-v3/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You play a driver in **Costa Verde**, a neon coastal city, working six jobs for **Lena Marlowe**, the fixer who runs the town from the back of Cafe Luna.

## The game

- **A city to explore on foot and by car** — a seeded road grid with a harbour, two piers, parks, palms and neon-signed buildings, all drawn on canvas with no external assets
- **Three car classes** — Brisa Compact, Veloz GT and Mulo Hauler — with arcade driving physics; steal parked cars or pull drivers out of traffic
- **Traffic and pedestrians** — lane-following traffic that brakes for the car ahead, pedestrians who stroll the sidewalks and flee trouble (and drop cash when knocked down)
- **A wanted system (1–5 stars)** — crimes draw police who chase, ram and try to bust you; lay low out of sight and the heat cools off star by star
- **Six missions in sequence** — First Fare, Neon Run, Harbour Heat, Lose the Law, Three Drops and the Neon Finale — with cash rewards and a City Legend ending
- **A day–night cycle** — dusk tints, streetlight pools, neon glow and headlights after dark
- **HUD with a live minimap**, cash, health, wanted stars, bust meter, objective and speed, plus title, pause, busted, wasted and legend screens; progress saves to localStorage
- **Synthesized sound** — engine hum, sirens, pickup blips and crash thuds, all generated with WebAudio

## Play it

Serve `game/` with any static file server and open `game/index.html` in desktop Chrome. It runs fully offline — no network requests, no build step.

```
WASD  drive / walk      E  enter or steal a car      Shift  sprint      P  pause      M  mute
```

## How it is built

- `game/src/city.js` — the seeded city: roads, harbour, buildings, palms
- `game/src/actors.js` — traffic AI, pedestrians and police
- `game/src/missions.js` — the six-mission story chain
- `game/src/game.js` — game state, the wanted system and the mission state machine
- `game/src/render.js` — canvas drawing, day–night light, HUD and minimap
- `game/src/audio.js` — WebAudio synth
- `game/src/main.js` — bootstrap, input, frame loop and staged screenshot scenes
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library

## License

MIT — see [LICENSE](LICENSE).
