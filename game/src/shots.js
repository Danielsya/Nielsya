// Screenshot modes for Cinderport (?shot=start|play|end).
// These set up deterministic, good-looking states for the entry's captures.
import { MISSIONS } from "./config.js";

export function applyShot(s, shot, world) {
  if (shot === "start") {
    s.mode = "title";
    s.dayClock = 40; // bright morning
    s.wanted = 0;
    s.money = 100;
    s.player.x = world.spawn.x;
    s.player.z = world.spawn.z;
    s.player.angle = 0.6;
    s.player.inCar = false;
    s.police = [];
    s.missionIndex = 0;
    s.missionText = MISSIONS[0].hint;
    s.target = null;
    s.orbit = true;
  } else if (shot === "end") {
    s.mode = "complete";
    s.dayClock = 40;
    s.missionIndex = 5;
    s.money = 2300;
    s.wanted = 0;
    s.player.x = world.observatory.x + 20;
    s.player.z = world.observatory.z + 20;
    s.player.angle = 2.4;
    s.police = [];
    s.target = null;
    s.orbit = true;
  } else if (shot === "play") {
    // Live chase: player driving, wanted 3, police behind, job 1 active.
    s.mode = "playing";
    s.dayClock = 40;
    s.missionIndex = 0;
    s.missionStage = 1;
    s.missionTimer = 120;
    s.missionText = MISSIONS[0].hint;
    s.wanted = 3;
    s.money = 250;
    s.health = 100;
    s.ammo = 30;
    s.invulnerable = true;
    // Drive along the road at tz=36 (z=365, road centre) so the camera
    // behind the car stays on the road, not inside a building block.
    s.player.x = 24 * 10;
    s.player.z = 36 * 10 + 5;
    s.player.angle = Math.PI / 2;
    s.player.inCar = true;
    s.player.speed = 16;
    s.target = { x: world.casino.x, z: world.casino.z };
    s.police = [
      { x: s.player.x - 10, z: s.player.z - 4, angle: Math.PI / 2, speed: 15 },
      { x: s.player.x - 14, z: s.player.z, angle: Math.PI / 2, speed: 15 },
      { x: s.player.x - 18, z: s.player.z + 4, angle: Math.PI / 2, speed: 14 },
    ];
    s.orbit = false;
  }
  return s;
}

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("shot");
  } catch (e) {
    return null;
  }
}
