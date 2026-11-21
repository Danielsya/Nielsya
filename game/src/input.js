// Keyboard + mouse tracker. Written fresh.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._pressed = {};
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this._pressed[k] = true;
      this.keys[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => { this.mouse.down = true; this.mouse.clicked = true; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
  }
  down(k) { return !!this.keys[k.toLowerCase()]; }
  pressed(k) { const v = !!this._pressed[k.toLowerCase()]; this._pressed[k.toLowerCase()] = false; return v; }
  moveVector() {
    let x = 0, y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }
  endFrame() { this.mouse.clicked = false; for (const k in this._pressed) this._pressed[k] = false; }
}
