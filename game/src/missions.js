// The six-mission story chain for Neon Shores, handed out by Lena Marlowe,
// the fixer who runs Costa Verde from the back of Cafe Luna. Missions are
// data: each one names its type, its spots on the map and its reward, and the
// game module drives them through one small state machine.
import { randomRoadPoint } from './city.js';

export const FIXER_NAME = 'Lena Marlowe';

// Mission types:
//  deliver       pick up a passenger/package at A, drop it at B
//  checkpoints   drive through N beacons before the timer runs out
//  pickup-heat   pick up at A under a forced wanted level, deliver to B
//  evade         reach the hideout, then drop to 0 stars
//  drops         collect N drops against the clock, heat rises per drop
//  finale        dock pickup, then N beacons at high heat, deliver home
export function buildMissions(city, rnd) {
  const p1 = randomRoadPoint(city, rnd);
  const d1 = randomRoadPoint(city, rnd);
  const pier = city.piers[0];
  const pier2 = city.piers[1];
  const home = { x: 240, y: 1680 };
  const garage = { x: 2640, y: 240 };
  const dropSpots = [randomRoadPoint(city, rnd), randomRoadPoint(city, rnd), randomRoadPoint(city, rnd)];
  const beacons = [];
  for (let i = 0; i < 4; i++) beacons.push(randomRoadPoint(city, rnd));
  const checks = [];
  for (let i = 0; i < 6; i++) checks.push(randomRoadPoint(city, rnd));

  return [
    {
      id: 'first-fare', name: 'First Fare', reward: 150, type: 'deliver',
      brief: 'Lena needs a driver. Pick up the client at the marker and take them across town.',
      pickup: p1, dropoff: d1, timeLimit: 0, heat: 0,
    },
    {
      id: 'neon-run', name: 'Neon Run', reward: 220, type: 'checkpoints',
      brief: 'Six beacons, one timer. Show Lena you can drive this city.',
      points: checks, timeLimit: 75, heat: 0,
    },
    {
      id: 'harbour-heat', name: 'Harbour Heat', reward: 320, type: 'pickup-heat',
      brief: 'A package waits on Pier 9. The law is already watching — grab it and deliver.',
      pickup: { x: pier.x + pier.w / 2, y: pier.y + pier.h - 20 },
      dropoff: d1, timeLimit: 0, heat: 2,
    },
    {
      id: 'lose-the-law', name: 'Lose the Law', reward: 260, type: 'evade',
      brief: 'Three stars on you. Reach the garage on the east side, then vanish until the heat dies.',
      hideout: garage, timeLimit: 0, heat: 3,
    },
    {
      id: 'three-drops', name: 'Three Drops', reward: 420, type: 'drops',
      brief: 'Three drops, one clock. Every drop pulls more heat — keep moving.',
      points: dropSpots, timeLimit: 90, heat: 0,
    },
    {
      id: 'neon-finale', name: 'Neon Finale', reward: 800, type: 'finale',
      brief: 'The big one. Dock pickup, four beacons at four stars, then bring it home.',
      pickup: { x: pier2.x + pier2.w / 2, y: pier2.y + pier2.h - 20 },
      points: beacons, dropoff: home, timeLimit: 120, heat: 4,
    },
  ];
}

// Human-readable objective line for the HUD, from the mission and its
// current phase. phase: 'pickup' | 'deliver' | 'points' | 'hideout' | 'evade' | 'done'
export function objectiveText(mission, phase, left) {
  if (!mission) return 'Free roam — find a car (E) and explore Costa Verde';
  switch (mission.type) {
    case 'deliver':
      return phase === 'pickup'
        ? `Pick up the client — ${left} m`
        : `Drop off the client — ${left} m`;
    case 'checkpoints':
      return `Hit the beacons — ${left} left`;
    case 'pickup-heat':
      return phase === 'pickup'
        ? `Grab the package on Pier 9 — ${left} m`
        : `Deliver the package — ${left} m (stay ahead of the law)`;
    case 'evade':
      return phase === 'hideout'
        ? `Reach the garage hideout — ${left} m`
        : 'Lay low until the heat dies down';
    case 'drops':
      return `Make the drops — ${left} left`;
    case 'finale':
      return phase === 'pickup'
        ? `Dock pickup — ${left} m`
        : phase === 'points'
          ? `Hit the beacons — ${left} left`
          : `Bring it home — ${left} m`;
    default:
      return mission.brief;
  }
}
