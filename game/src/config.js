// Cinderport — configuration, districts, crew and story missions.
// Original game for make.fun gta6-01, written from scratch by the agent.
export const TILE = 10;
export const MAP = 72; // tiles per side
export const WORLD = MAP * TILE; // world size in units (720)
export const SAVE_KEY = "cinderport-save-v1";
export const DAY_LENGTH = 240; // seconds per full day/night cycle

export const DISTRICTS = [
  { id: 0, name: "Observatory Heights", short: "Heights", ground: [0.42, 0.62, 0.42], desc: "Hilltop villas and the old observatory" },
  { id: 1, name: "Neon Strip", short: "Neon", ground: [0.32, 0.30, 0.38], desc: "Casinos, clubs and bright signs" },
  { id: 2, name: "Harborlight Wharf", short: "Wharf", ground: [0.45, 0.42, 0.36], desc: "Fishing harbor, crates and gulls" },
  { id: 3, name: "Lavaflow Row", short: "Lavaflow", ground: [0.23, 0.20, 0.20], desc: "Black rock where the old lava ran" },
  { id: 4, name: "Blacksand Shore", short: "Shore", ground: [0.16, 0.15, 0.15], desc: "Black-sand beach and the open sea" },
];

export const CREW = [
  { id: 0, name: "Rio \"Vex\" Castellanos", role: "Driver", cost: 250, bonus: "Cars +30% top speed", spot: "neon" },
  { id: 1, name: "Nia \"Cipher\" Adeyemi", role: "Hacker", cost: 300, bonus: "Wanted stars fade twice as fast", spot: "wharf" },
  { id: 2, name: "Tomas \"Brick\" Kovac", role: "Muscle", cost: 400, bonus: "Punches deal double damage", spot: "lava" },
];

export const MISSIONS = [
  {
    name: "First Spark",
    pay: 500,
    brief: "Madame Cinder needs crates moved. Pick them up at the Wharf, then drop them at the Neon Strip casino. 120 seconds.",
    hint: "Drive to the gold marker at the Wharf, then to the casino.",
  },
  {
    name: "Smoke Screen",
    pay: 800,
    brief: "The deal went loud. The cops are on you. Lose them and reach the hideout in the Lavaflow before the timer runs out.",
    hint: "Reach the purple hideout marker. Wanted is 3 — keep moving.",
  },
  {
    name: "Tide Money",
    pay: 900,
    brief: "Five cash bags washed up along Blacksand Shore. Grab all five before the tide takes them.",
    hint: "Collect the 5 green bags on the beach.",
  },
  {
    name: "Neon Grand Prix",
    pay: 1500,
    brief: "A street race through the Strip: 4 checkpoints, 2 rival drivers. Beat them both to the finish line.",
    hint: "Hit the orange rings in order. Rivals can win — drive clean and fast.",
  },
  {
    name: "The Vault Beneath",
    pay: 2500,
    brief: "The casino keeps a vault car under the Strip. Steal it and bring it to the hideout. The whole island will be looking for you.",
    hint: "Steal the gold car at the casino, deliver it to the hideout.",
  },
  {
    name: "Eruption",
    pay: 5000,
    brief: "Final job. Five stars, the whole force after you. Reach the observatory at the top of the island and you own Cinderport.",
    hint: "Reach the observatory marker with 5 wanted stars on you.",
  },
];

export const SHOP_ITEMS = [
  { key: "ammo", name: "Ammo +24", cost: 50 },
  { key: "health", name: "Health +30", cost: 50 },
];

export const COLORS = {
  road: [0.16, 0.16, 0.17],
  roadLine: [0.85, 0.80, 0.45],
  sidewalk: [0.30, 0.30, 0.31],
  water: [0.05, 0.25, 0.45],
  sand: [0.14, 0.13, 0.13],
  park: [0.20, 0.42, 0.22],
  lava: [0.55, 0.14, 0.05],
  rock: [0.25, 0.23, 0.24],
};
