// All drawing for Neon Shores: the city, the cars and people in it, the
// day–night light, and the HUD with its minimap. One canvas, no images.
import { WORLD_W, WORLD_H, WATER_Y, ROAD_W, isWater } from './city.js';
import { missionTarget, hudObjective } from './game.js';

const VIEW_W = 1280;
const VIEW_H = 800;

// How bright the world is at a given time of day (0..1 through the day).
export function daylight(t) {
  const s = Math.sin(t * Math.PI * 2);
  return 0.32 + 0.68 * Math.max(0, s);
}

function drawCar(ctx, x, y, angle, color, isPolice, light, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-22, -11, 44, 24);
  ctx.fillStyle = color;
  roundRect(ctx, -21, -12, 42, 24, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(2, -9, 10, 18); // windshield
  ctx.fillStyle = 'rgba(20,20,30,0.9)';
  ctx.fillRect(-14, -9, 8, 18); // rear window
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.fillStyle = light === 'red' ? '#ff2222' : '#2266ff';
    ctx.beginPath();
    ctx.arc(-6, 0, 4, 0, Math.PI * 2);
    ctx.arc(6, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Headlights at night.
  if (t > 0.62 || t < 0.08) {
    ctx.fillStyle = 'rgba(255,255,190,0.9)';
    ctx.beginPath();
    ctx.arc(21, -7, 2.5, 0, Math.PI * 2);
    ctx.arc(21, 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWorld(ctx, game, camX, camY, light) {
  const city = game.city;
  // Ground.
  ctx.fillStyle = '#252b3a';
  ctx.fillRect(camX - VIEW_W / 2 - 40, camY - VIEW_H / 2 - 40, VIEW_W + 80, VIEW_H + 80);
  // Beach and sea.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(camX - VIEW_W / 2 - 40, WATER_Y - 60, VIEW_W + 80, 70);
  ctx.fillStyle = '#0e4d6e';
  ctx.fillRect(camX - VIEW_W / 2 - 40, WATER_Y + 10, VIEW_W + 80, VIEW_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = WATER_Y + 40 + i * 46 + Math.sin(game.elapsed * 0.7 + i * 2) * 6;
    ctx.beginPath();
    ctx.moveTo(camX - VIEW_W / 2 - 40, wy);
    ctx.lineTo(camX + VIEW_W / 2 + 40, wy);
    ctx.stroke();
  }
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = '#2d5a3a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#3f7a4e';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads.
  ctx.fillStyle = '#3a3f4d';
  for (const a of city.avenues) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WATER_Y);
  for (const s of city.streets) ctx.fillRect(0, s - ROAD_W / 2, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const a of city.avenues) {
    ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, WATER_Y); ctx.stroke();
  }
  for (const s of city.streets) {
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(WORLD_W, s); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalks.
  ctx.strokeStyle = '#565d6e';
  ctx.lineWidth = 6;
  for (const a of city.avenues) {
    ctx.beginPath(); ctx.moveTo(a - ROAD_W / 2 - 3, 0); ctx.lineTo(a - ROAD_W / 2 - 3, WATER_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a + ROAD_W / 2 + 3, 0); ctx.lineTo(a + ROAD_W / 2 + 3, WATER_Y); ctx.stroke();
  }
  // Piers.
  for (const pier of city.piers) {
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = '#5d4426';
    ctx.lineWidth = 3;
    for (let y = pier.y + 20; y < pier.y + pier.h; y += 30) {
      ctx.beginPath(); ctx.moveTo(pier.x, y); ctx.lineTo(pier.x + pier.w, y); ctx.stroke();
    }
  }
  // Buildings with pseudo-3D rooftops and neon signs.
  for (const b of city.buildings) {
    const top = b.height * 7;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + top * 0.4, b.y - top * 0.4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    // Lit windows at night.
    ctx.fillStyle = light < 0.6 ? 'rgba(255,220,120,0.85)' : 'rgba(140,170,220,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.height) % 3 === 0) {
          ctx.fillRect(b.x + 8 + i * 34, b.y + 8 + j * 34, 16, 12);
        }
      }
    }
    if (b.sign) {
      ctx.save();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      if (light < 0.6) {
        ctx.shadowColor = b.signColor;
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = b.signColor;
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.restore();
    }
  }
  // Palms.
  for (const palm of city.palms) {
    ctx.strokeStyle = '#6e4f2a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 4, palm.y - 16); ctx.stroke();
    ctx.fillStyle = '#3f8a4e';
    ctx.beginPath(); ctx.arc(palm.x + 4, palm.y - 20, 12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEntities(ctx, game) {
  // Cash pickups.
  for (const pk of game.pickups) {
    ctx.save();
    ctx.translate(pk.x, pk.y + Math.sin(game.elapsed * 4) * 3);
    ctx.fillStyle = '#37d67a';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#062b16';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
    ctx.restore();
  }
  // Mission markers.
  const target = missionTarget(game);
  if (target) {
    const pulse = 1 + Math.sin(game.elapsed * 5) * 0.15;
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.arc(target.x, target.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const pt of game.pointsLeft) {
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Parked cars.
  for (const c of game.parked) drawCar(ctx, c.x, c.y, c.angle, c.color, false, null, game.timeOfDay);
  // Traffic.
  for (const c of game.traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, false, null, game.timeOfDay);
  // Police.
  for (const pc of game.police) drawCar(ctx, pc.x, pc.y, pc.angle, pc.color, true, pc.light, game.timeOfDay);
  // Pedestrians.
  for (const ped of game.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-9, -4, 18, 8);
    } else {
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // The player: a car, or a walker on foot.
  const p = game.player;
  if (p.inCar && p.car) {
    drawCar(ctx, p.x, p.y, p.angle, p.car.color, false, null, game.timeOfDay);
  } else {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(4, -4, 8, 8);
    ctx.restore();
  }
}

function drawMinimap(ctx, game) {
  const mw = 220;
  const mh = 165;
  const mx = VIEW_W - mw - 16;
  const my = VIEW_H - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 8);
  ctx.clip();
  ctx.strokeStyle = '#8a93a8';
  ctx.lineWidth = 2;
  for (const a of game.city.avenues) {
    ctx.beginPath(); ctx.moveTo(mx + a * sx, my); ctx.lineTo(mx + a * sx, my + mh); ctx.stroke();
  }
  for (const s of game.city.streets) {
    ctx.beginPath(); ctx.moveTo(mx, my + s * sy); ctx.lineTo(mx + mw, my + s * sy); ctx.stroke();
  }
  ctx.fillStyle = '#0e4d6e';
  ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
  const target = missionTarget(game);
  if (target) {
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const pc of game.police) {
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const p = game.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff5d8f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawHUD(ctx, game) {
  const p = game.player;
  const m = game.missions[game.missionIndex];
  ctx.save();
  // Cash and health, top left.
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  roundRect(ctx, 14, 14, 250, 64, 8);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash.toLocaleString()}`, 26, 42);
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(26, 52, 120, 10);
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(26, 52, 120 * Math.max(0, p.health) / 100, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 152, 61);
  ctx.fillStyle = '#c9d1e0';
  ctx.font = '12px sans-serif';
  if (p.inCar && p.car) ctx.fillText(p.car.cls.name, 26, 72);
  // Wanted stars, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.wanted ? '#ffd21c' : 'rgba(255,255,255,0.25)';
    ctx.font = '28px sans-serif';
    ctx.fillText('★', VIEW_W - 24 - i * 32, 44);
  }
  if (game.bust > 0) {
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('BUST METER', VIEW_W - 24, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(VIEW_W - 154, 70, 130, 8);
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(VIEW_W - 154, 70, 130 * game.bust, 8);
  }
  // Objective, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,24,0.75)';
  const obj = hudObjective(game);
  const ow = Math.min(560, ctx.measureText(obj).width + 36);
  roundRect(ctx, VIEW_W / 2 - ow / 2, 14, ow, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(m ? `${m.name} — ${obj}` : obj, VIEW_W / 2, 32);
  if (m && m.timeLimit > 0 && game.missionTimer > 0) {
    ctx.fillStyle = game.missionTimer < 15 ? '#ff5d5d' : '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`TIME ${Math.ceil(game.missionTimer)}s`, VIEW_W / 2, 50);
  }
  // Speed, bottom right above the minimap.
  if (p.inCar) {
    ctx.fillStyle = 'rgba(10,14,24,0.75)';
    roundRect(ctx, VIEW_W - 250, VIEW_H - 216, 90, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.speed) * 0.32)} km/h`, VIEW_W - 205, VIEW_H - 192);
  }
  // Phone message from Lena.
  if (game.phoneT > 0) {
    ctx.fillStyle = 'rgba(16,20,36,0.92)';
    roundRect(ctx, 14, VIEW_H - 150, 420, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ff5d8f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LENA MARLOWE', 26, VIEW_H - 126);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '13px sans-serif';
    wrapText(ctx, game.phone, 26, VIEW_H - 106, 396, 17);
  }
  // Banner, centre.
  if (game.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, game.bannerT);
    ctx.fillStyle = 'rgba(10,14,24,0.85)';
    const bw = Math.min(640, ctx.measureText(game.banner).width + 44);
    roundRect(ctx, VIEW_W / 2 - bw / 2, 84, bw, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner, VIEW_W / 2, 110);
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, game);
  // Controls hint, bottom left.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD drive/walk · E enter or steal a car · Shift sprint · P pause', 16, VIEW_H - 16);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawScreen(ctx, game, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffe600';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  let y = VIEW_H / 2 - 40;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 30;
  }
  ctx.restore();
}

export function render(ctx, game) {
  const light = daylight(game.timeOfDay);
  const p = game.player;
  const camX = Math.max(VIEW_W / 2, Math.min(WORLD_W - VIEW_W / 2, game.camera.x));
  const camY = Math.max(VIEW_H / 2, Math.min(WORLD_H - VIEW_H / 2, game.camera.y));

  ctx.save();
  ctx.translate(VIEW_W / 2 - camX, VIEW_H / 2 - camY);
  drawWorld(ctx, game, camX, camY, light);
  drawEntities(ctx, game);
  ctx.restore();

  // Night overlay and streetlight pools.
  if (light < 0.85) {
    ctx.save();
    ctx.fillStyle = `rgba(8,10,40,${(0.85 - light) * 0.55})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
    // Headlight cone when driving at night.
    if (p.inCar) {
      const sx = VIEW_W / 2;
      const sy = VIEW_H / 2;
      const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
      grad.addColorStop(0, 'rgba(255,255,190,0.18)');
      grad.addColorStop(1, 'rgba(255,255,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, 260, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Edge arrow pointing at the mission target when it is off screen.
  const target = missionTarget(game);
  if (target && game.status === 'playing') {
    const tx = target.x - camX + VIEW_W / 2;
    const ty = target.y - camY + VIEW_H / 2;
    if (tx < 40 || tx > VIEW_W - 40 || ty < 40 || ty > VIEW_H - 40) {
      const cx = Math.max(40, Math.min(VIEW_W - 40, tx));
      const cy = Math.max(40, Math.min(VIEW_H - 40, ty));
      const ang = Math.atan2(ty - VIEW_H / 2, tx - VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (game.status === 'playing' || game.status === 'paused') {
    drawHUD(ctx, game);
  }

  if (game.status === 'title') {
    drawScreen(ctx, game, 'NEON SHORES', [
      'An open-world crime game in Costa Verde',
      'Six jobs for Lena Marlowe. Steal cars. Outrun the law. Become a legend.',
      '',
      'Press ENTER to start',
      'WASD — drive / walk      E — enter or steal a car      Shift — sprint      P — pause',
      'Your progress saves automatically',
    ]);
  } else if (game.status === 'paused') {
    drawScreen(ctx, game, 'PAUSED', ['Press P to keep playing', `Cash $${game.player.cash} · ${game.stats.missionsDone} jobs done`]);
  } else if (game.status === 'busted') {
    drawScreen(ctx, game, 'BUSTED', ['The Costa Verde police took you in.', 'Press ENTER to get back out there'], '#ff5d5d');
  } else if (game.status === 'wasted') {
    drawScreen(ctx, game, 'WASTED', ['The clinic patched you up. The city is still waiting.', 'Press ENTER to get back out there'], '#ff5d5d');
  } else if (game.status === 'legend') {
    drawScreen(ctx, game, 'CITY LEGEND', [
      `Every job done. $${game.player.cash} in your pocket.`,
      `Cars stolen: ${game.stats.carsStolen} · Times busted: ${game.stats.bustedCount}`,
      'Press ENTER to keep roaming Costa Verde',
    ]);
  }
}
