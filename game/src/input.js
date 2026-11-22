// Keyboard + mouse input for Cinderport.
export const keys = {};
export const mouse = { x: 0, y: 0, clicked: false, down: false };

const KEYMAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
  KeyE: "action",
  Space: "punch",
  KeyP: "pause",
  Escape: "pause",
  KeyM: "mute",
  KeyR: "restart",
  Enter: "enter",
  KeyH: "heal",
};

export function initInput(canvas) {
  window.addEventListener("keydown", (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      keys[name] = true;
      if (name === "punch" || name === "pause") e.preventDefault();
    }
    if (e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    const name = KEYMAP[e.code];
    if (name) keys[name] = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener("mouseup", () => {
    mouse.down = false;
  });
}

export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}

// Edge-triggered key press: true once per physical press.
const pressedEdge = {};
export function pressed(name) {
  if (keys[name] && !pressedEdge[name]) {
    pressedEdge[name] = true;
    return true;
  }
  if (!keys[name]) pressedEdge[name] = false;
  return false;
}
