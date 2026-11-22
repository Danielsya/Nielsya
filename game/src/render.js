// Cinderport HUD — 2D overlay canvas: mission info, wanted stars, money,
// health, ammo, minimap, and the title / pause / story / end screens.
import { DISTRICTS, MISSIONS, CREW } from "./config.js";
import { TILE, MAP } from "./config.js";

function bar(ctx, x, y, w, h, frac, color, bg = "#222") {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

export function drawHUD(ctx, W, H, s) {
  ctx.clearRect(0, 0, W, H);
  if (s.mode === "title") { drawTitle(ctx, W, H, s); return; }
  if (s.mode === "complete") { drawComplete(ctx, W, H, s); return; }
  if (s.mode === "story") { drawStory(ctx, W, H, s); return; }

  // Night tint.
  const night = s.nightFactor || 0;
  if (night > 0.05) {
    ctx.fillStyle = `rgba(8, 12, 40, ${(night * 0.35).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Top-left: game name + district + standing there.
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("CINDERPORT", 16, 30);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#ffd76a";
  const d = DISTRICTS[s.district] || DISTRICTS[0];
  ctx.fillText(d.name + "  ·  " + d.desc, 16, 52);
  ctx.fillStyle = "#cfe3ff";
  ctx.fillText(`Standing here: ${s.standing ? s.standing[s.district] || 0 : 0}  ·  Crew: ${s.crewRecruited ? s.crewRecruited.length : 0}/3`, 16, 70);

  // Mission line.
  const m = MISSIONS[s.missionIndex];
  if (m) {
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Job ${s.missionIndex + 1}/6 — ${m.name}  ($${m.pay})`, 16, 92);
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#cfe3ff";
    wrapText(ctx, s.missionText || m.hint, 16, 112, W * 0.45, 17);
    if (s.missionTimer > 0) {
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = s.missionTimer < 20 ? "#ff5a5a" : "#fff";
      ctx.fillText(`⏱ ${Math.ceil(s.missionTimer)}s`, 16, 146);
    }
  }

  // Top-right: wanted stars + money.
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#ffd76a";
  let stars = "";
  for (let i = 0; i < 5; i++) stars += i < s.wanted ? "★" : "☆";
  ctx.fillText(stars, W - 170, 32);
  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = "#7cff6a";
  ctx.fillText("$" + s.money, W - 170, 58);

  // Bottom-left: health + ammo.
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("♥ HEALTH", 16, H - 56);
  bar(ctx, 16, H - 48, 180, 12, s.health / 100, "#ff4d4d");
  ctx.fillText("AMMO " + s.ammo, 16, H - 24);
  bar(ctx, 16, H - 16, 180, 8, s.ammo / 60, "#ffd76a");
  ctx.fillStyle = "#cfe3ff";
  ctx.fillText(s.player.inCar ? "IN CAR — E to exit · Shift boost" : "ON FOOT — E to steal a car", 210, H - 24);

  // Speed.
  if (s.player.inCar) {
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(Math.round(Math.abs(s.player.speed) * 3.2) + " mph", W - 170, H - 24);
  }

  // Minimap.
  drawMinimap(ctx, W, H, s);

  // Rain streaks.
  if (s.raining) {
    ctx.strokeStyle = "rgba(180,200,255,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = (i * 97 + (s.time * 900)) % W;
      const y = (i * 53 + (s.time * 1400)) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
      ctx.stroke();
    }
  }

  if (s.mode === "paused") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", W / 2, H / 2 - 10);
    ctx.font = "16px sans-serif";
    ctx.fillText("P / Esc to keep playing  ·  S to save  ·  R to restart", W / 2, H / 2 + 24);
    ctx.textAlign = "left";
  }
  if (s.mode === "busted") {
    ctx.fillStyle = "rgba(20,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ff5a5a";
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUSTED", W / 2, H / 2 - 10);
    ctx.fillStyle = "#fff";
    ctx.font = "17px sans-serif";
    ctx.fillText("The Cinderport force took you down. Press R to try again.", W / 2, H / 2 + 28);
    ctx.textAlign = "left";
  }
  if (s.toast) {
    ctx.font = "bold 16px sans-serif";
    const tw = ctx.measureText(s.toast).width;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(W / 2 - tw / 2 - 12, H - 110, tw + 24, 30);
    ctx.fillStyle = "#ffd76a";
    ctx.textAlign = "center";
    ctx.fillText(s.toast, W / 2, H - 89);
    ctx.textAlign = "left";
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawMinimap(ctx, W, H, s) {
  const size = 150;
  const x0 = W - size - 14;
  const y0 = H - size - 14;
  const scale = size / (MAP * TILE);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  // District tint blocks.
  for (let tz = 0; tz < MAP; tz += 4) {
    for (let tx = 0; tx < MAP; tx += 4) {
      const d = s.world.districtAtWorld((tx + 2) * TILE, (tz + 2) * TILE);
      const col = DISTRICTS[d].ground;
      ctx.fillStyle = `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})`;
      ctx.fillRect(x0 + tx * scale, y0 + tz * scale, 4 * scale + 1, 4 * scale + 1);
    }
  }
  const dot = (wx, wz, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * scale, y0 + wz * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (s.target) dot(s.target.x, s.target.z, "#ffd76a", 5);
  for (const p of s.police || []) dot(p.x, p.z, "#4da6ff", 3);
  for (const c of s.crewMarkers || []) dot(c.x, c.z, "#c07cff", 3);
  dot(s.player.x, s.player.z, "#fff", 4);
  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.fillText("MAP — CINDERPORT", x0, y0 - 8);
}

function drawTitle(ctx, W, H, s) {
  ctx.fillStyle = "rgba(8, 8, 18, 0.45)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffb347";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText("CINDERPORT", W / 2, H * 0.28);
  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.fillText("An open-world crime story on a volcanic island", W / 2, H * 0.28 + 34);
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#ffd76a";
  ctx.fillText("6 STORY JOBS", W / 2, H * 0.42);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#e8e8e8";
  MISSIONS.forEach((m, i) => {
    ctx.fillText(`${i + 1}. ${m.name} — $${m.pay}`, W / 2, H * 0.42 + 24 + i * 22);
  });
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#cfe3ff";
  ctx.fillText("WASD drive / move · E steal car · Space punch · Click shoot · P pause · M mute", W / 2, H * 0.42 + 24 + 6 * 22 + 18);
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("Press ENTER to start", W / 2, H * 0.42 + 24 + 6 * 22 + 52);
  ctx.textAlign = "left";
}

function drawStory(ctx, W, H, s) {
  ctx.fillStyle = "rgba(8, 8, 18, 0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffb347";
  ctx.font = "bold 34px sans-serif";
  const m = MISSIONS[s.missionIndex];
  ctx.fillText(`JOB ${s.missionIndex + 1}: ${m ? m.name : ""}`, W / 2, H * 0.36);
  ctx.fillStyle = "#fff";
  ctx.font = "18px sans-serif";
  wrapTextCenter(ctx, m ? m.brief : "", W / 2, H * 0.42, W * 0.6, 26);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ffd76a";
  ctx.fillText("Press ENTER to begin the job", W / 2, H * 0.62);
  ctx.textAlign = "left";
}

function wrapTextCenter(ctx, text, cx, y, maxW, lh) {
  const words = String(text).split(" ");
  let line = "";
  let yy = y;
  const lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  for (const l of lines) {
    ctx.fillText(l, cx, yy);
    yy += lh;
  }
}

function drawComplete(ctx, W, H, s) {
  ctx.fillStyle = "rgba(8, 8, 18, 0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd76a";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText("ALL JOBS DONE!", W / 2, H * 0.34);
  ctx.fillStyle = "#fff";
  ctx.font = "22px sans-serif";
  ctx.fillText("Eruption — $5000", W / 2, H * 0.34 + 40);
  ctx.fillStyle = "#7cff6a";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(`You own Cinderport. Total money: $${s.money}`, W / 2, H * 0.34 + 82);
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px sans-serif";
  ctx.fillText("Crew recruited: " + (s.crewRecruited.map((id) => CREW[id].name).join(" · ") || "none"), W / 2, H * 0.34 + 118);
  ctx.fillText("Press R to play again  ·  Press ENTER to keep playing", W / 2, H * 0.34 + 152);
  ctx.textAlign = "left";
}
