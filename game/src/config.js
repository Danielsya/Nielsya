// Sunport City v2 — 3D tuning, districts, crew, story missions. Written fresh.
export const CONFIG = {
  tile: 32,
  worldTiles: 72,
  roadEvery: 8,
  playerSpeed: 70,      // units/sec on foot (3D world units)
  runMult: 1.6,
  carSpeed: 260,        // units/sec top speed
  carAccel: 320,
  policeSpeed: 230,
  saveKey: 'sunport-city-save-v2',
  dayLength: 240,       // seconds per full day/night cycle
};
export const COLOURS = {
  grass: 0x7fae5a, road: 0x3a3f4a, sidewalk: 0xb8b0a0,
  park: 0x5da85a, water: 0x3d7fd1, sand: 0xe8d8a0,
  player: 0xffcf3d, police: 0x2f6df6, gang: 0xb03a5a,
  shop: 0x3dd0c0, crew: 0x7ee06a, race: 0xff8c1a,
};
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x0: 24, y0: 24, x1: 48, y1: 48, color: '#8a7f8d', desc: 'Glass towers and neon' },
  { id: 'marina', name: 'Marina Docks', x0: 56, y0: 8, x1: 72, y1: 40, color: '#3d7fd1', desc: 'Boats, crates, salt air' },
  { id: 'oldtown', name: 'Old Town', x0: 0, y0: 24, x1: 24, y1: 48, color: '#9e8a6f', desc: 'Brick lanes and markets' },
  { id: 'hills', name: 'Ember Hills', x0: 24, y0: 0, x1: 56, y1: 24, color: '#7f9e8a', desc: 'Mansions above the city' },
  { id: 'beach', name: 'Sunset Beach', x0: 0, y0: 48, x1: 72, y1: 72, color: '#e8d8a0', desc: 'Sand, surf and street races' },
];
export const CREW = [
  { id: 'driver', name: 'Maya "Jet" Ramos', role: 'Driver', bonus: 'Cars +25% top speed', cost: 0 },
  { id: 'hacker', name: 'Kiko "Ghost" Tan', role: 'Hacker', bonus: 'Wanted decays 2x faster', cost: 300 },
  { id: 'muscle', name: 'Bruno "Wall" Costa', role: 'Muscle', bonus: 'Punch/shoot +50% damage', cost: 500 },
];
export const MISSIONS = [
  { id: 1, name: 'Package Run', type: 'deliver', objective: 'Deliver the package to Marina Docks in 120s', time: 120, reward: 500, district: 'marina', story: 'Rico Vale, driver for hire. Your first job: a sealed package for the docks. No questions.' },
  { id: 2, name: 'Hot Pursuit', type: 'escape', objective: 'Escape the police — reach the Hideout in Old Town', time: 90, reward: 750, district: 'oldtown', story: 'The package was hot. The whole force is on you. Lose them in the Old Town lanes.' },
  { id: 3, name: 'Cash Drops', type: 'collect', objective: 'Collect 5 cash drops around the city', time: 150, reward: 1000, district: 'downtown', story: 'A crew stash is scattered across Downtown. Grab it before the rival gang does.' },
  { id: 4, name: 'Street Race', type: 'race', objective: 'Win the Sunset Beach street race — hit all 4 checkpoints first', time: 120, reward: 1200, district: 'beach', story: 'The beach crew races at sunset. Beat their champion and the streets will know your name.' },
  { id: 5, name: 'The Vault Car', type: 'heist', objective: 'Steal the vault car in Ember Hills and deliver it to the Hideout', time: 150, reward: 2000, district: 'hills', story: 'One car. A vault on wheels, parked in the Hills. Take it, and the crew eats for a month.' },
  { id: 6, name: 'Final Job', type: 'final', objective: 'Survive a 5-star chase and reach the Hideout — own Sunport City', time: 180, reward: 5000, district: 'oldtown', story: 'Every cop in Sunport is coming. One last run through the city you now own.' },
];
export const STORY = 'Sunport City: you are Rico Vale, a driver for hire on an island city. Take jobs, build your crew, earn every district\'s respect, dodge the law, own the streets.';
