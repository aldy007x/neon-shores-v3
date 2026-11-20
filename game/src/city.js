// Costa Verde: the city Neon Shores is set in. A seeded road grid with a
// harbour at the south edge, parks, palms and neon-signed buildings. The
// road graph is what traffic, missions and the minimap all navigate on.
import { mulberry32, pickInt, pickOne } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const WATER_Y = 2080;

const NEON_SIGNS = [
  'HOTEL MAR', 'CAFE LUNA', 'NEON BAR', 'TACOS', 'PIER 9', 'DISCO SOL',
  'MOTEL', 'CASINO', 'SURF SHOP', 'RAMEN', 'CLUB AZUL', 'PIZZA', 'ARCADE',
  'BODEGA', 'GYM 24H', 'LAUNDRY', 'DONUTS', 'TATTOO', 'BANK', 'CINEMA',
];
const SIGN_COLORS = ['#ff2d78', '#00e5ff', '#ffe600', '#7cff00', '#ff9f1c', '#c77dff'];
const BUILDING_COLORS = ['#2b2f4a', '#3a2f4d', '#243447', '#46304a', '#2f4038', '#40342a'];

export function buildCity(seed) {
  const rnd = mulberry32(seed);
  const avenues = [240, 720, 1200, 1680, 2160, 2640];
  const streets = [240, 720, 1200, 1680];
  const buildings = [];
  const parks = [];
  const palms = [];

  // One building per block cell, with jitter, skipping the two park blocks
  // and the harbour strip. A few blocks stay empty as parking lots.
  for (let ai = 0; ai < avenues.length - 1; ai++) {
    for (let si = 0; si < streets.length - 1; si++) {
      const x0 = avenues[ai] + ROAD_W / 2 + 14;
      const x1 = avenues[ai + 1] - ROAD_W / 2 - 14;
      const y0 = streets[si] + ROAD_W / 2 + 14;
      const y1 = streets[si + 1] - ROAD_W / 2 - 14;
      if (y1 > WATER_Y - 40) continue;
      if ((ai === 1 && si === 1) || (ai === 3 && si === 2)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (rnd() < 0.12) continue; // parking lot
      const bw = x1 - x0;
      const bh = y1 - y0;
      const cols = rnd() < 0.3 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        const w = cols === 2 ? bw / 2 - 8 : bw;
        const h = bh * (0.55 + rnd() * 0.4);
        const bx = x0 + (cols === 2 ? c * (bw / 2 + 4) : 0);
        const by = y0 + rnd() * (bh - h);
        buildings.push({
          x: bx, y: by, w, h,
          height: pickInt(rnd, 1, 4),
          color: pickOne(rnd, BUILDING_COLORS),
          sign: rnd() < 0.55 ? pickOne(rnd, NEON_SIGNS) : null,
          signColor: pickOne(rnd, SIGN_COLORS),
          windows: pickInt(rnd, 2, 6),
        });
      }
    }
  }

  // Palm rows along the beach and around the parks.
  for (let x = 120; x < WORLD_W - 100; x += 90) {
    if (rnd() < 0.75) palms.push({ x: x + pickInt(rnd, -20, 20), y: WATER_Y - 30 + pickInt(rnd, -8, 8) });
  }
  for (const p of parks) {
    for (let i = 0; i < 5; i++) {
      palms.push({ x: p.x + 20 + rnd() * (p.w - 40), y: p.y + 20 + rnd() * (p.h - 40) });
    }
  }

  // Two drivable piers reaching out over the water.
  const piers = [
    { x: 1080, y: WATER_Y - 10, w: 120, h: 190 },
    { x: 2040, y: WATER_Y - 10, w: 120, h: 190 },
  ];

  return { seed, avenues, streets, buildings, parks, palms, piers };
}

// Is a point in the sea (south of the beach line, and not on a pier)?
export function isWater(city, x, y) {
  if (y < WATER_Y) return false;
  for (const p of city.piers) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
  }
  return true;
}

// Is a point on a road (avenue or street)?
export function onRoad(city, x, y) {
  for (const a of city.avenues) if (Math.abs(x - a) <= ROAD_W / 2) return true;
  for (const s of city.streets) if (Math.abs(y - s) <= ROAD_W / 2) return true;
  return false;
}

// Snap a point to the nearest road centre line, for spawning cars.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const a of city.avenues) {
    const d = Math.abs(x - a);
    if (d < bestD) { bestD = d; best = { x: a, y, vertical: true }; }
  }
  for (const s of city.streets) {
    const d = Math.abs(y - s);
    if (d < bestD) { bestD = d; best = { x, y: s, vertical: false }; }
  }
  return best;
}

// Push a circle out of every building it overlaps. Returns true when a
// push happened (callers use it to register a bump).
export function pushOutOfBuildings(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    } else {
      // Centre inside the rectangle: shove out through the nearest face.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    }
  }
  return hit;
}

// A random road point, used for mission targets and traffic spawning.
export function randomRoadPoint(city, rnd) {
  if (rnd() < 0.55) {
    return { x: pickOne(rnd, city.avenues), y: 140 + rnd() * (WATER_Y - 280) };
  }
  return { x: 140 + rnd() * (WORLD_W - 280), y: pickOne(rnd, city.streets) };
}
