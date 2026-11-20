// Traffic, pedestrians and police for Neon Shores. Traffic follows the road
// graph in the right-hand lane and brakes for the car ahead; pedestrians
// stroll the sidewalks and flee trouble; police chase the player when the
// wanted level is up and try to ram the player's car to a stop.
import { mulberry32, pickInt, pickOne } from './rng.js';
import { nearestRoadPoint, onRoad, pushOutOfBuildings, WORLD_W, WORLD_H } from './city.js';

export const CAR_CLASSES = [
  { name: 'Brisa Compact', topSpeed: 430, accel: 300, color: '#e8b64c', tough: 1 },
  { name: 'Veloz GT', topSpeed: 580, accel: 380, color: '#e84c4c', tough: 1 },
  { name: 'Mulo Hauler', topSpeed: 390, accel: 240, color: '#4c9de8', tough: 2 },
];
const TRAFFIC_COLORS = ['#c9c9c9', '#7a7f8a', '#4c6e91', '#8a6f4c', '#5d7a52', '#915d7a', '#b8b8b8'];

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function makeTrafficCar(city, rnd, x, y) {
  const cls = pickOne(rnd, CAR_CLASSES);
  const pt = nearestRoadPoint(city, x, y);
  const angle = pt.vertical ? (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI);
  return {
    kind: 'traffic',
    x: pt.x + (pt.vertical ? (angle === Math.PI / 2 ? 22 : -22) : 0),
    y: pt.y + (pt.vertical ? 0 : (angle === 0 ? 22 : -22)),
    angle, speed: 0,
    cruise: pickInt(rnd, 130, 210),
    color: pickOne(rnd, TRAFFIC_COLORS),
    cls, driver: true, honk: 0,
  };
}

// Pick a new destination intersection for a traffic car and steer toward it.
function retarget(car, city, rnd) {
  const a = pickOne(rnd, city.avenues);
  const s = pickOne(rnd, city.streets);
  car.tx = a;
  car.ty = s;
}

export function updateTraffic(dt, city, cars, player, police) {
  for (const car of cars) {
    if (car.tx === undefined) retarget(car, city, Math.random);
    // Steer along roads: first reach the target avenue, then the street.
    let wantAngle;
    const dx = car.tx - car.x;
    const dy = car.ty - car.y;
    if (Math.abs(dx) > 30) wantAngle = dx > 0 ? 0 : Math.PI;
    else if (Math.abs(dy) > 30) wantAngle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    else { retarget(car, city, Math.random); continue; }
    car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 4));
    // Brake for the car ahead (traffic, player or police).
    let blocked = false;
    const ahead = { x: car.x + Math.cos(car.angle) * 70, y: car.y + Math.sin(car.angle) * 70 };
    for (const other of cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - ahead.x, other.y - ahead.y);
      if (d < 46) { blocked = true; break; }
    }
    if (!blocked && player && player.inCar) {
      const d = Math.hypot(player.x - ahead.x, player.y - ahead.y);
      if (d < 50) blocked = true;
    }
    if (!blocked && police) {
      for (const p of police) {
        const d = Math.hypot(p.x - ahead.x, p.y - ahead.y);
        if (d < 50) { blocked = true; break; }
      }
    }
    const target = blocked ? 0 : car.cruise;
    car.speed += Math.max(-500, Math.min(260, target - car.speed)) * dt;
    if (car.speed < 0) car.speed = 0;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep cars on the map and out of buildings.
    car.x = Math.max(60, Math.min(WORLD_W - 60, car.x));
    car.y = Math.max(60, Math.min(WORLD_H - 60, car.y));
    pushOutOfBuildings(city, car, 20);
  }
}

export function makePedestrian(city, rnd) {
  const pt = nearestRoadPoint(city, 100 + rnd() * (WORLD_W - 200), 100 + rnd() * 1400);
  return {
    kind: 'ped',
    x: pt.x + (rnd() - 0.5) * 60,
    y: pt.y + (rnd() - 0.5) * 60,
    angle: rnd() * Math.PI * 2,
    speed: pickInt(rnd, 40, 70),
    color: pickOne(rnd, ['#e8e8e8', '#d94f70', '#4fd1d9', '#e8c84f', '#9a6fd9']),
    state: 'stroll',
    fleeT: 0,
  };
}

export function updatePedestrians(dt, city, peds, player, rnd) {
  for (const p of peds) {
    // Flee when the player is close and fast, or a crime just happened.
    const pd = player ? Math.hypot(player.x - p.x, player.y - p.y) : 9999;
    if (p.state === 'stroll' && pd < 130 && player && (player.inCar ? player.speed > 200 : false)) {
      p.state = 'flee';
      p.fleeT = 2.5;
      p.angle = Math.atan2(p.y - player.y, p.x - player.x);
    }
    if (p.state === 'flee') {
      p.fleeT -= dt;
      p.speed = 170;
      if (p.fleeT <= 0) { p.state = 'stroll'; p.speed = 55; }
    }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 40 || p.x > WORLD_W - 40 || p.y < 40 || p.y > WORLD_H - 40 || Math.random() < dt * 0.05) {
      p.angle = rnd() * Math.PI * 2;
      p.x = Math.max(40, Math.min(WORLD_W - 40, p.x));
      p.y = Math.max(40, Math.min(WORLD_H - 40, p.y));
    }
    pushOutOfBuildings(city, p, 10);
  }
}

export function makePoliceCar(city, rnd, nearX, nearY) {
  // Spawn on a road at the map edge nearest the player.
  const edge = pickOne(rnd, ['n', 's', 'e', 'w']);
  let x, y;
  if (edge === 'n') { x = nearX; y = 120; }
  else if (edge === 's') { x = nearX; y = 1960; }
  else if (edge === 'e') { x = WORLD_W - 120; y = nearY; }
  else { x = 120; y = nearY; }
  const pt = nearestRoadPoint(city, x, y);
  return {
    kind: 'police', x: pt.x, y: pt.y, angle: 0, speed: 0,
    cruise: 520, color: '#1c1c22', light: rnd() < 0.5 ? 'red' : 'blue',
    ram: 0,
  };
}

export function updatePolice(dt, city, police, player) {
  for (const p of police) {
    if (!player) continue;
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    p.angle = angleLerp(p.angle, want, Math.min(1, dt * 3.2));
    // Ease off when right on top of the player, then ram.
    const target = dist < 60 ? 120 : p.cruise;
    p.speed += Math.max(-640, Math.min(560, target - p.speed)) * dt;
    if (p.speed < 0) p.speed = 0;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    p.light = (p.light === 'red' ? 'blue' : 'red');
    pushOutOfBuildings(city, p, 20);
  }
}

// A seeded stream helper for the game module.
export function seededRandom(seed) {
  return mulberry32(seed);
}
