export const PHYSICS_STATIC = 0;
export const PHYSICS_FLOAT = 1;
export const PHYSICS_DRIP = 2;

export interface BubbleCell {
  x: number;       // position in grid units (float)
  y: number;
  vx: number;      // velocity in grid units/sec
  vy: number;
  radius: number;
  age: number;
  hue: number;
}

export class BubbleGrid {
  private cells: BubbleCell[] = [];
  private armed = new Set<number>(); // grid keys already spawned
  private currentHue = 0;

  get cellCount(): number {
    return this.cells.length;
  }

  clear() {
    this.cells.length = 0;
    this.armed.clear();
    this.currentHue = 0;
  }

  /** Arm a cell — creates a new bubble if not already present */
  armCell(col: number, row: number, dirX: number, dirY: number): boolean {
    col = Math.max(0, Math.min(255, col | 0));
    row = Math.max(0, Math.min(255, row | 0));
    const key = row * 256 + col;
    if (this.armed.has(key)) return false;
    this.armed.add(key);
    const angle = Math.atan2(dirY, dirX);
    const hue = ((angle + Math.PI) / (2 * Math.PI) + this.currentHue) % 1;
    this.cells.push({
      x: col + 0.5,
      y: row + 0.5,
      vx: dirX * 2,  // initial velocity from stroke direction
      vy: dirY * 2,
      radius: 0.01,
      age: 0,
      hue,
    });
    return true;
  }

  private armDisc(cx: number, cy: number, r: number, dirX: number, dirY: number) {
    const ri = Math.ceil(r);
    const r2 = r * r;
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const c = cx + dx;
        const rw = cy + dy;
        if (c < 0 || c > 255 || rw < 0 || rw > 255) continue;
        this.armCell(c, rw, dirX, dirY);
      }
    }
  }

  armLine(
    fromCol: number, fromRow: number,
    toCol: number, toRow: number,
    dirX: number, dirY: number,
    brushRadius = 3,
  ) {
    let x0 = Math.max(0, Math.min(255, fromCol | 0));
    let y0 = Math.max(0, Math.min(255, fromRow | 0));
    const x1 = Math.max(0, Math.min(255, toCol | 0));
    const y1 = Math.max(0, Math.min(255, toRow | 0));

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.armDisc(x0, y0, brushRadius, dirX, dirY);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  rotateHue(amount: number) {
    this.currentHue = (this.currentHue + amount) % 1;
  }

  /** Update physics and growth. Returns number of active bubbles. */
  tick(
    dt: number,
    growthRate: number,
    maxRadius: number,
    audioLevel: number,
    physicsMode: number,
    gravity: number,
    viscosity: number,
    fieldSize: number,
  ): number {
    const boost = 1 + audioLevel * 2;
    const gravDir = physicsMode === PHYSICS_FLOAT ? -1 : 1; // up vs down

    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      c.age += dt;

      // Growth
      const growth = growthRate * boost * dt * Math.max(0.1, maxRadius - c.radius);
      c.radius = Math.min(maxRadius, c.radius + growth);

      // Physics (skip for static mode)
      if (physicsMode !== PHYSICS_STATIC) {
        // Apply gravity
        c.vy += gravity * gravDir * dt;

        // Apply viscosity (drag)
        const drag = Math.pow(1 - viscosity, dt * 60);
        c.vx *= drag;
        c.vy *= drag;

        // Small random jitter for organic feel
        c.vx += (Math.random() - 0.5) * 0.3 * dt;

        // Move
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }

      // Remove off-screen bubbles (with margin for radius)
      const margin = maxRadius * 2;
      if (c.y < -margin || c.y > fieldSize + margin ||
          c.x < -margin || c.x > fieldSize + margin) {
        this.cells[i] = this.cells[this.cells.length - 1];
        this.cells.pop();
      }
    }

    return this.cells.length;
  }

  /**
   * Pack active bubbles into a Float32Array for GPU upload.
   * Each bubble: [clipX, clipY, clipRadius, hue]
   */
  packInstances(canvasWidth: number, canvasHeight: number, cellSize: number): Float32Array {
    const count = this.cells.length;
    const data = new Float32Array(count * 4);
    let i = 0;
    const invW = 2 / canvasWidth;
    const invH = 2 / canvasHeight;
    for (const cell of this.cells) {
      const px = cell.x * cellSize;
      const py = cell.y * cellSize;
      data[i]     = px * invW - 1;
      data[i + 1] = 1 - py * invH;
      data[i + 2] = cell.radius * cellSize * invW;
      data[i + 3] = cell.hue;
      i += 4;
    }
    return data;
  }
}
