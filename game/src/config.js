// Sunport City — tuning, colours, missions. Written fresh.
export const CONFIG = {
  tile: 32,
  worldTiles: 72,
  roadEvery: 8,
  playerSpeed: 3.2,
  carSpeed: 7.5,
  policeSpeed: 6.8,
  saveKey: 'sunport-city-save-v1',
};
export const COLOURS = {
  grass: '#7fae5a', road: '#3a3f4a', roadLine: '#e8d44d',
  sidewalk: '#b8b0a0', building: '#8a7f8d', building2: '#6f7f9e',
  park: '#5da85a', water: '#4d8fd1', player: '#ffcf3d', police: '#2f6df6',
  traffic: '#e05a4d', ped: '#f2e6c9', car2: '#4dd0a5', car3: '#c96fd1',
};
export const MISSIONS = [
  { id: 1, name: 'Package Run', objective: 'Deliver the package to Marina Docks in 120s', time: 120, reward: 500 },
  { id: 2, name: 'Hot Pursuit', objective: 'Escape the police — reach the Hideout', time: 90, reward: 750 },
  { id: 3, name: 'Cash Drops', objective: 'Collect 5 cash drops around the city', time: 150, reward: 1000 },
];
export const STORY = 'Sunport City: you are Rico Vale, a driver for hire. Take jobs, dodge the law, own the streets.';
