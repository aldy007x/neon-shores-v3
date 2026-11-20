// Neon Shores: the game state and its update loop. The player explores
// Costa Verde on foot or by car, steals cars, earns wanted stars, outruns
// the police and works through Lena Marlowe's six-mission story chain.
import { buildCity, isWater, pushOutOfBuildings, randomRoadPoint, WORLD_W, WORLD_H, WATER_Y } from './city.js';
import { CAR_CLASSES, makeTrafficCar, updateTraffic, makePedestrian, updatePedestrians, makePoliceCar, updatePolice } from './actors.js';
import { buildMissions, objectiveText, FIXER_NAME } from './missions.js';
import { mulberry32 } from './rng.js';
import { ensureAudio, setEngine, setSiren, playPickup, playCash, playCrash, playBusted } from './audio.js';

export const SAVE_KEY = 'neon-shores-save-v1';
const DAY_LENGTH = 240; // seconds per full day
const POLICE_STATION = { x: 240, y: 240 };
const CLINIC = { x: 2640, y: 1680 };

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function createGame(seed) {
  const rnd = mulberry32(seed);
  const city = buildCity(seed);
  const missions = buildMissions(city, rnd);

  const parked = [];
  let guard = 0;
  while (parked.length < 10 && guard++ < 200) {
    const pt = randomRoadPoint(city, rnd);
    const cls = CAR_CLASSES[Math.floor(rnd() * CAR_CLASSES.length)];
    const ok = parked.every((c) => Math.hypot(c.x - pt.x, c.y - pt.y) > 120);
    if (ok) parked.push({ kind: 'parked', x: pt.x, y: pt.y, angle: rnd() * Math.PI * 2, speed: 0, cls, color: cls.color, driver: false });
  }

  const traffic = [];
  for (let i = 0; i < 14; i++) {
    traffic.push(makeTrafficCar(city, rnd, 150 + rnd() * (WORLD_W - 300), 150 + rnd() * 1300));
  }
  const peds = [];
  for (let i = 0; i < 26; i++) peds.push(makePedestrian(city, rnd));

  const game = {
    seed, city, missions, parked, traffic, peds,
    police: [],
    pickups: [],
    player: {
      x: 1200, y: 1200, angle: -Math.PI / 2, speed: 0,
      inCar: false, car: null, health: 100, cash: 60,
    },
    missionIndex: 0, phase: 'pickup', missionTimer: 0, pointsLeft: [],
    wanted: 0, bust: 0, unseenT: 0, heatTimer: 0,
    timeOfDay: 0.22, elapsed: 0,
    status: 'title', // title | playing | paused | busted | wasted | legend
    banner: '', bannerT: 0,
    phone: '', phoneT: 0,
    camera: { x: 1200, y: 1200 },
    frozen: false,
    stats: { carsStolen: 0, missionsDone: 0, bustedCount: 0 },
    muted: false,
  };

  // Restore a previous save (cash + story progress only).
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.cash === 'number') game.player.cash = s.cash;
      if (typeof s.missionIndex === 'number' && s.missionIndex < missions.length) {
        game.missionIndex = s.missionIndex;
      }
    }
  } catch (e) { /* no save, start fresh */ }

  startMission(game);
  return game;
}

export function saveGame(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.player.cash,
      missionIndex: game.missionIndex,
    }));
  } catch (e) { /* storage unavailable */ }
}

function showBanner(game, text, seconds) {
  game.banner = text;
  game.bannerT = seconds || 3;
}

function showPhone(game, text) {
  game.phone = text;
  game.phoneT = 6;
}

function currentMission(game) {
  return game.missions[game.missionIndex] || null;
}

function startMission(game) {
  const m = currentMission(game);
  if (!m) {
    game.status = 'legend';
    return;
  }
  game.phase = m.type === 'checkpoints' || m.type === 'drops' || m.type === 'finale' ? 'points' : 'pickup';
  if (m.type === 'evade') game.phase = 'hideout';
  if (m.type === 'finale') game.phase = 'pickup';
  game.missionTimer = m.timeLimit || 0;
  game.pointsLeft = m.points ? m.points.slice() : [];
  if (m.heat > 0) setWanted(game, m.heat);
  showPhone(game, `${FIXER_NAME}: ${m.brief}`);
}

function failMission(game, reason) {
  showBanner(game, `Mission failed — ${reason}. Try again.`, 3.5);
  startMission(game);
}

function completeMission(game) {
  const m = currentMission(game);
  if (!m) return;
  game.player.cash += m.reward;
  game.stats.missionsDone++;
  playCash();
  showBanner(game, `Mission complete: ${m.name} — $${m.reward}`, 3.5);
  game.missionIndex++;
  saveGame(game);
  if (game.missionIndex >= game.missions.length) {
    game.status = 'legend';
    showBanner(game, 'CITY LEGEND — you finished every job in Costa Verde', 6);
  } else {
    startMission(game);
  }
}

export function setWanted(game, stars) {
  game.wanted = Math.max(0, Math.min(5, stars));
  game.unseenT = 0;
}

function addWanted(game, stars) {
  setWanted(game, game.wanted + stars);
  if (stars > 0) showBanner(game, `Wanted level ${game.wanted} — the law is coming`, 2.5);
}

function nearestCar(game, maxD) {
  const p = game.player;
  let best = null;
  let bestD = maxD;
  const all = game.parked.concat(game.traffic);
  for (const c of all) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function tryEnterCar(game) {
  const p = game.player;
  if (p.inCar) {
    // Step out of the car, beside it.
    p.inCar = false;
    p.x += Math.cos(p.angle + Math.PI / 2) * 30;
    p.y += Math.sin(p.angle + Math.PI / 2) * 30;
    p.speed = 0;
    p.car = null;
    return;
  }
  const car = nearestCar(game, 70);
  if (!car) return;
  p.inCar = true;
  p.car = car;
  p.angle = car.angle;
  p.speed = 0;
  p.x = car.x;
  p.y = car.y;
  if (car.kind === 'traffic' && car.driver) {
    car.driver = false;
    addWanted(game, 1);
    game.stats.carsStolen++;
    showBanner(game, `You stole the ${car.cls.name}`, 2.5);
  } else if (car.kind === 'parked') {
    game.stats.carsStolen++;
    showBanner(game, `You took the ${car.cls.name}`, 2);
  }
  // Remove the taken car from its list so it is not drawn twice.
  if (car.kind === 'parked') game.parked = game.parked.filter((c) => c !== car);
  else game.traffic = game.traffic.filter((c) => c !== car);
}

function damagePlayer(game, amount, cause) {
  const p = game.player;
  p.health -= amount;
  if (p.health <= 0) {
    p.health = 100;
    game.status = 'wasted';
    game.player.cash = Math.max(0, game.player.cash - 100);
    game.player.x = CLINIC.x;
    game.player.y = CLINIC.y;
    game.player.inCar = false;
    game.player.car = null;
    game.player.speed = 0;
    setWanted(game, 0);
    game.bust = 0;
    playBusted();
    showBanner(game, `Wasted — the clinic patched you up. -$100 (${cause})`, 4);
  }
}

function bustPlayer(game) {
  const p = game.player;
  game.stats.bustedCount++;
  const fine = Math.min(p.cash, 150);
  p.cash -= fine;
  p.x = POLICE_STATION.x;
  p.y = POLICE_STATION.y;
  p.inCar = false;
  p.car = null;
  p.speed = 0;
  setWanted(game, 0);
  game.bust = 0;
  game.status = 'busted';
  playBusted();
  showBanner(game, `Busted — fined $${fine}. The law let you walk.`, 4);
}

// ---- main update -------------------------------------------------------

export function update(game, input, dt) {
  if (game.status !== 'playing' || game.frozen) return;
  const p = game.player;
  game.elapsed += dt;
  game.timeOfDay = (game.elapsed % DAY_LENGTH) / DAY_LENGTH;
  if (game.bannerT > 0) game.bannerT -= dt;
  if (game.phoneT > 0) game.phoneT -= dt;
  ensureAudio();

  // --- player movement ---
  const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (p.inCar && p.car) {
    const cls = p.car.cls;
    const top = cls.topSpeed;
    if (fwd > 0) p.speed += cls.accel * dt;
    else if (fwd < 0) p.speed -= cls.accel * 1.4 * dt;
    else p.speed -= Math.sign(p.speed) * 160 * dt;
    if (Math.abs(p.speed) < 4 && fwd === 0) p.speed = 0;
    p.speed = Math.max(-top * 0.45, Math.min(top, p.speed));
    const steerAmount = steer * 2.1 * dt * Math.min(1, Math.abs(p.speed) / 140) * (p.speed < 0 ? -1 : 1);
    p.angle += steerAmount;
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (!isWater(game.city, nx, ny)) { p.x = nx; p.y = ny; }
    else { p.speed *= 0.4; }
    if (pushOutOfBuildings(game.city, p, 20)) {
      if (Math.abs(p.speed) > 260) { damagePlayer(game, 12, 'crash'); playCrash(); }
      p.speed *= 0.45;
    }
    p.car.x = p.x; p.car.y = p.y; p.car.angle = p.angle; p.car.speed = p.speed;
  } else {
    const run = input.sprint ? 300 : 185;
    const mx = ((input.right ? 1 : 0) - (input.left ? 1 : 0));
    const my = ((input.down ? 1 : 0) - (input.up ? 1 : 0));
    const len = Math.hypot(mx, my);
    if (len > 0) {
      p.angle = Math.atan2(my, mx);
      const nx = p.x + (mx / len) * run * dt;
      const ny = p.y + (my / len) * run * dt;
      if (!isWater(game.city, nx, p.y)) p.x = nx;
      if (!isWater(game.city, p.x, ny)) p.y = ny;
      p.speed = run;
    } else {
      p.speed = 0;
    }
    pushOutOfBuildings(game.city, p, 14);
  }
  p.x = Math.max(30, Math.min(WORLD_W - 30, p.x));
  p.y = Math.max(30, Math.min(WORLD_H - 30, p.y));

  // --- car-on-car and car-on-pedestrian collisions ---
  if (p.inCar) {
    for (const c of game.traffic) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (p.x - c.x) / d;
        const ny = (p.y - c.y) / d;
        p.x += nx * push; p.y += ny * push;
        c.x -= nx * push; c.y -= ny * push;
        if (Math.abs(p.speed) > 240) { playCrash(); damagePlayer(game, 5, 'collision'); }
        p.speed *= 0.92;
      }
    }
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < 34) {
        ped.state = 'down';
        ped.downT = 6;
        addWanted(game, 2);
        playCrash();
        damagePlayer(game, 4, 'hit a pedestrian');
        game.pickups.push({ x: ped.x, y: ped.y, amount: 20 + Math.floor(Math.random() * 40), t: 20 });
        showBanner(game, 'You hit a pedestrian — witnesses called it in', 2.5);
      }
    }
    for (const pc of game.police) {
      const d = Math.hypot(pc.x - p.x, pc.y - p.y);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = (p.x - pc.x) / d;
        const ny = (p.y - pc.y) / d;
        p.x += nx * push; p.y += ny * push;
        pc.x -= nx * push; pc.y -= ny * push;
        if (Math.abs(p.speed) > 200) { addWanted(game, 1); playCrash(); damagePlayer(game, 6, 'rammed a police car'); }
        p.speed *= 0.9;
      }
    }
  }

  // --- cash pickups ---
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.t -= dt;
    if (pk.t <= 0) { game.pickups.splice(i, 1); continue; }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 40) {
      p.cash += pk.amount;
      playPickup();
      showBanner(game, `Picked up $${pk.amount}`, 1.5);
      game.pickups.splice(i, 1);
    }
  }

  // --- pedestrians: the downed ones get back up ---
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) { ped.state = 'stroll'; ped.speed = 55; }
    }
  }

  // --- wanted system: police, heat decay, bust meter ---
  const wantedTarget = Math.min(4, game.wanted);
  while (game.police.length < wantedTarget) {
    game.police.push(makePoliceCar(game.city, Math.random, p.x, p.y));
  }
  while (game.police.length > wantedTarget) game.police.pop();
  updatePolice(dt, game.city, game.police, p);

  let nearestCop = Infinity;
  for (const pc of game.police) nearestCop = Math.min(nearestCop, Math.hypot(pc.x - p.x, pc.y - p.y));
  if (game.wanted > 0) {
    const hiding = currentMission(game) && currentMission(game).type === 'evade' && game.phase === 'evade'
      && currentMission(game).hideout && dist(p, currentMission(game).hideout) < 140;
    if (nearestCop > 620 || hiding) {
      game.unseenT += dt * (hiding ? 3 : 1);
      if (game.unseenT > 8) {
        game.unseenT = 0;
        setWanted(game, game.wanted - 1);
      }
    } else {
      game.unseenT = 0;
    }
    // Bust meter fills when a cop is close and the player is slow.
    if (nearestCop < 95 && Math.abs(p.speed) < 70) game.bust += dt * 0.45;
    else game.bust = Math.max(0, game.bust - dt * 0.25);
    if (game.bust >= 1) bustPlayer(game);
  } else {
    game.bust = 0;
  }

  // --- traffic and pedestrians ---
  updateTraffic(dt, game.city, game.traffic, p, game.police);
  updatePedestrians(dt, game.city, game.peds, p, Math.random);

  // --- mission state machine ---
  const m = currentMission(game);
  if (m) {
    if (m.timeLimit > 0) {
      game.missionTimer -= dt;
      if (game.missionTimer <= 0) {
        failMission(game, 'out of time');
        return;
      }
    }
    if (m.type === 'deliver' || m.type === 'pickup-heat') {
      const target = game.phase === 'pickup' ? m.pickup : m.dropoff;
      if (dist(p, target) < 75) {
        if (game.phase === 'pickup') {
          game.phase = 'deliver';
          playPickup();
          showBanner(game, m.type === 'pickup-heat' ? 'Package secured — deliver it' : 'Client aboard — drive to the drop-off', 2.5);
        } else {
          completeMission(game);
        }
      }
    } else if (m.type === 'checkpoints' || m.type === 'drops') {
      for (let i = game.pointsLeft.length - 1; i >= 0; i--) {
        if (dist(p, game.pointsLeft[i]) < 75) {
          game.pointsLeft.splice(i, 1);
          playPickup();
          if (m.type === 'drops') addWanted(game, 1);
        }
      }
      if (game.pointsLeft.length === 0) completeMission(game);
    } else if (m.type === 'evade') {
      if (game.phase === 'hideout' && dist(p, m.hideout) < 90) {
        game.phase = 'evade';
        showBanner(game, 'You made the garage — now stay out of sight', 3);
      } else if (game.phase === 'evade' && game.wanted === 0) {
        completeMission(game);
      }
    } else if (m.type === 'finale') {
      if (game.phase === 'pickup') {
        if (dist(p, m.pickup) < 75) {
          game.phase = 'points';
          game.pointsLeft = m.points.slice();
          playPickup();
          showBanner(game, 'Cargo aboard — hit the four beacons', 2.5);
        }
      } else if (game.phase === 'points') {
        for (let i = game.pointsLeft.length - 1; i >= 0; i--) {
          if (dist(p, game.pointsLeft[i]) < 75) {
            game.pointsLeft.splice(i, 1);
            playPickup();
          }
        }
        if (game.pointsLeft.length === 0) game.phase = 'deliver';
      } else if (game.phase === 'deliver') {
        if (dist(p, m.dropoff) < 75) completeMission(game);
      }
    }
  }

  // --- camera follows the player ---
  game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 5);

  // --- audio ---
  if (!game.muted) {
    setEngine(p.inCar ? Math.abs(p.speed) / 580 : 0, p.inCar);
    setSiren(game.wanted, game.elapsed);
  } else {
    setEngine(0, false);
    setSiren(0, game.elapsed);
  }
}

export function missionTarget(game) {
  const m = currentMission(game);
  if (!m) return null;
  if (m.type === 'deliver' || m.type === 'pickup-heat') return game.phase === 'pickup' ? m.pickup : m.dropoff;
  if (m.type === 'checkpoints' || m.type === 'drops') return game.pointsLeft[0] || null;
  if (m.type === 'evade') return game.phase === 'hideout' ? m.hideout : null;
  if (m.type === 'finale') {
    if (game.phase === 'pickup') return m.pickup;
    if (game.phase === 'points') return game.pointsLeft[0] || null;
    return m.dropoff;
  }
  return null;
}

export function hudObjective(game) {
  const m = currentMission(game);
  if (!m) return 'Free roam — explore Costa Verde';
  const target = missionTarget(game);
  const left = m.type === 'checkpoints' || m.type === 'drops' || (m.type === 'finale' && game.phase === 'points')
    ? game.pointsLeft.length
    : target ? Math.round(dist(game.player, target)) : 0;
  return objectiveText(m, game.phase, left);
}
