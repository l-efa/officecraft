// First-person player: AABB physics against the voxel grid, axis-by-axis.
import { WATER } from './blocks.js';

export const PW = 0.3;   // half width
export const PH = 1.8;   // height
export const EYE = 1.62; // eye height

export class Player {
  constructor() {
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.hitWall = false;
    this.flying = false;
    this.airMaxY = 0;   // highest point since leaving the ground (for fall damage)
    this.lastFall = 0;  // fall distance of the most recent landing
  }

  collides(world) {
    const p = this.pos;
    const x0 = Math.floor(p.x - PW), x1 = Math.floor(p.x + PW);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + PH);
    const z0 = Math.floor(p.z - PW), z1 = Math.floor(p.z + PW);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (world.isSolid(x, y, z)) return true;
    return false;
  }

  moveAxis(world, axis, d) {
    if (!d) return;
    const p = this.pos;
    p[axis] += d;
    if (!this.collides(world)) return;
    if (axis === 'y') {
      if (d < 0) { p.y = Math.floor(p.y) + 1; this.onGround = true; }
      else p.y = Math.floor(p.y + PH) - PH - 0.001;
    } else {
      if (d > 0) p[axis] = Math.floor(p[axis] + PW) - PW - 0.001;
      else p[axis] = Math.floor(p[axis] - PW) + 1 + PW + 0.001;
      this.hitWall = true;
    }
    this.vel[axis] = 0;
  }

  update(dt, input, world) {
    const p = this.pos, v = this.vel;
    const inWater = world.get(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === WATER;

    // desired horizontal movement
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = fx * input.forward + rx * input.strafe;
    let mz = fz * input.forward + rz * input.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; } // allow partial speeds (< 1) for creatures
    const speed = this.flying ? 11 : (input.sprint && input.forward > 0 ? 5.8 : 4.3) * (inWater ? 0.55 : 1);
    const accel = this.flying ? 10 : this.onGround ? 16 : inWater ? 6 : 5;
    const k = Math.min(1, accel * dt);
    v.x += (mx * speed - v.x) * k;
    v.z += (mz * speed - v.z) * k;

    if (this.flying) {
      // Space = up, Shift = down
      const vy = ((input.jump ? 1 : 0) - (input.sprint ? 1 : 0)) * 8;
      v.y += (vy - v.y) * k;
    } else if (inWater) {
      v.y -= 12 * dt;
      v.y *= Math.max(0, 1 - 3 * dt);
      if (input.jump) v.y = Math.min(v.y + 30 * dt, 3.6);
      if (input.jump && this.hitWall) v.y = 6.5; // climb out onto the shore
      v.y = Math.max(v.y, -4);
    } else {
      v.y -= 30 * dt;
      if (v.y < -55) v.y = -55;
      if (input.jump && this.onGround) v.y = 9;
    }

    const maxV = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const steps = Math.max(1, Math.ceil((maxV * dt) / 0.35));
    const sdt = dt / steps;
    const wasOnGround = this.onGround;
    this.onGround = false;
    this.hitWall = false;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(world, 'x', v.x * sdt);
      this.moveAxis(world, 'z', v.z * sdt);
      this.moveAxis(world, 'y', v.y * sdt);
    }

    // fall tracking: water and flying cancel falls
    this.lastFall = 0;
    if (inWater || this.flying) this.airMaxY = p.y;
    else if (this.onGround) {
      if (!wasOnGround) this.lastFall = this.airMaxY - p.y;
      this.airMaxY = p.y;
    } else this.airMaxY = Math.max(this.airMaxY, p.y);
    return inWater;
  }
}
