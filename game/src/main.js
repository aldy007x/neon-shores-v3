// Neon Shores bootstrap: canvas, keyboard input, the frame loop, and the
// staged scenes the screenshots are taken from (?shot=cover|play|mission|
// night&seed=1). Also exposes window.__ns, the small handle the headless
// playtest uses to drive the game through its own rules.
import { createGame, update, tryEnterCar, setWanted, missionTarget } from './game.js';
import { render } from './render.js';
import { hashSeed } from './rng.js';

const params = new URLSearchParams(location.search);
const seed = hashSeed(params.get('seed') || 'costa-verde');
const game = createGame(seed);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = { up: false, down: false, left: false, right: false, sprint: false };

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function startPlaying() {
  if (game.status === 'title' || game.status === 'busted' || game.status === 'wasted' || game.status === 'legend') {
    game.status = 'playing';
  } else if (game.status === 'paused') {
    game.status = 'playing';
  }
}

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = true;
    e.preventDefault();
  }
  if (e.code === 'Enter') startPlaying();
  if (e.code === 'KeyE' && game.status === 'playing') tryEnterCar(game);
  if (e.code === 'KeyP') {
    if (game.status === 'playing') game.status = 'paused';
    else if (game.status === 'paused') game.status = 'playing';
  }
  if (e.code === 'KeyM') game.muted = !game.muted;
});

window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});

// ---- staged scenes for screenshots (?shot=...) -------------------------
// Each scene freezes the world in a readable, seed-fixed frame so the
// photograph shows the game at its best and cannot drift between runs.
function stageScene(name) {
  const p = game.player;
  game.status = 'playing';
  if (name === 'cover') {
    game.status = 'title';
    game.timeOfDay = 0.48; // dusk over the city
    game.camera.x = 1500;
    game.camera.y = 900;
    game.elapsed = 0.48 * 240;
  } else if (name === 'play') {
    game.timeOfDay = 0.25; // bright day
    game.elapsed = 0.25 * 240;
    const car = game.parked[0];
    if (car) {
      game.parked = game.parked.filter((c) => c !== car);
      p.inCar = true;
      p.car = car;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = 300;
    }
    p.x = 1200; p.y = 720; p.angle = 0;
    game.camera.x = p.x; game.camera.y = p.y;
  } else if (name === 'mission') {
    game.timeOfDay = 0.3;
    game.elapsed = 0.3 * 240;
    game.missionIndex = 2; // Harbour Heat, delivery phase
    game.phase = 'deliver';
    game.phone = `Lena Marlowe: ${game.missions[2].brief}`;
    game.phoneT = 6;
    setWanted(game, 3);
    const car = game.parked[1] || game.parked[0];
    if (car) {
      game.parked = game.parked.filter((c) => c !== car);
      p.inCar = true;
      p.car = car;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = 320;
    }
    p.x = 1140; p.y = 1900; p.angle = Math.PI / 2;
    game.camera.x = p.x; game.camera.y = p.y;
    // Two police cars in close pursuit for the shot.
    game.police = [
      { kind: 'police', x: p.x - 160, y: p.y - 90, angle: 0.3, speed: 480, cruise: 520, color: '#1c1c22', light: 'red', ram: 0 },
      { kind: 'police', x: p.x - 220, y: p.y + 130, angle: -0.2, speed: 460, cruise: 520, color: '#1c1c22', light: 'blue', ram: 0 },
    ];
  } else if (name === 'night') {
    game.timeOfDay = 0.78; // deep night, neon on
    game.elapsed = 0.78 * 240;
    p.inCar = false;
    p.car = null;
    p.x = 1200; p.y = 720; p.angle = 0;
    game.camera.x = p.x; game.camera.y = p.y;
  }
  game.frozen = true;
}

const shot = params.get('shot');
if (shot) stageScene(shot);

// ---- frame loop --------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(game, input, dt);
  render(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- headless playtest handle ------------------------------------------
window.__ns = {
  game,
  start: startPlaying,
  // Teleport the player next to the current objective; the mission still
  // completes only through the game's own proximity rules in update().
  warpToObjective() {
    const t = missionTarget(game);
    if (t) {
      game.player.x = t.x + 10;
      game.player.y = t.y + 10;
      game.camera.x = t.x;
      game.camera.y = t.y;
    }
  },
  warpTo(x, y) {
    game.player.x = x;
    game.player.y = y;
    game.camera.x = x;
    game.camera.y = y;
  },
  enterCar() { tryEnterCar(game); },
  setWanted(n) { setWanted(game, n); },
};
