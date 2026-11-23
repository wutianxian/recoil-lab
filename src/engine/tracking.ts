import type { Vec3 } from './camera.ts'

export interface TrackingTarget {
  id: number
  x: number
  z: number
  height: number
  dead?: boolean
}

const radians = Math.PI / 180
const coneCosine = Math.cos(9 * radians)
const rateTime = .05

type Sample = { id: number; x: number; z: number }

export class TargetMotion {
  yawRate = 0
  proximity = 0
  private previous?: Sample

  reset(): void {
    this.previous = undefined
    this.yawRate = 0
    this.proximity = 0
  }

  step(dt: number, origin: Vec3, yaw: number, pitch: number, targets: readonly TrackingTarget[]): void {
    if (!(dt > 0) || !Number.isFinite(dt)) {
      this.reset()
      return
    }

    const horizontal = Math.cos(pitch * radians)
    const forwardX = Math.sin(yaw * radians) * horizontal
    const forwardY = Math.sin(pitch * radians)
    const forwardZ = Math.cos(yaw * radians) * horizontal
    let closestCosine = coneCosine
    let closest: Sample | undefined

    for (const target of targets) {
      if (target.dead) continue
      const x = target.x - origin.x
      const y = target.height * .72 - origin.y
      const z = target.z - origin.z
      if (x * x + z * z < .08 ** 2) continue
      const cosine = (x * forwardX + y * forwardY + z * forwardZ) / Math.hypot(x, y, z)
      if (cosine > closestCosine) {
        closestCosine = cosine
        closest = { id: target.id, x, z }
      }
    }

    if (!closest) {
      this.reset()
      return
    }

    const previous = this.previous
    this.previous = closest
    this.proximity = Math.min(1, (closestCosine - coneCosine) / (1 - coneCosine))
    // The arena's combined player and target speed stays below 16 m/s.
    if (previous?.id !== closest.id || Math.hypot(closest.x - previous.x, closest.z - previous.z) > .05 + 16 * dt) {
      this.yawRate = 0
      return
    }

    const delta = Math.atan2(closest.x, closest.z) - Math.atan2(previous.x, previous.z)
    const wrapped = Math.atan2(Math.sin(delta), Math.cos(delta))
    this.yawRate += (wrapped / radians / dt - this.yawRate) * -Math.expm1(-dt / rateTime)
  }
}
