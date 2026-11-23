export type Vec3 = { x: number; y: number; z: number }
type ScreenPoint = { x: number; y: number; depth: number }

const radians = Math.PI / 180
const near = .08

function clipToNear(point: Vec3, front: Vec3): Vec3 {
  const t = (near - point.z) / (front.z - point.z)
  return {
    x: point.x + (front.x - point.x) * t,
    y: point.y + (front.y - point.y) * t,
    z: near,
  }
}

export class Camera {
  x = 0
  y = 1.64
  z = 0
  yaw = 0
  pitch = 0
  fov = 104
  width = 1
  height = 1
  private focalCache = { fov: NaN, height: NaN, value: 0 }
  private axes = { yaw: NaN, pitch: NaN, sinYaw: 0, cosYaw: 1, sinPitch: 0, cosPitch: 1 }

  // The slider describes horizontal FOV at a 4:3 reference aspect ratio.
  // Keep vertical coverage fixed when the viewport becomes wider or narrower.
  get focal() {
    const cache = this.focalCache
    if (cache.fov !== this.fov || cache.height !== this.height) {
      cache.fov = this.fov
      cache.height = this.height
      cache.value = this.height * (2 / 3) / Math.tan(this.fov * radians / 2)
    }
    return cache.value
  }

  direction(yawOffset = 0, pitchOffset = 0): Vec3 {
    const yaw = (this.yaw + yawOffset) * radians
    const pitch = (this.pitch + pitchOffset) * radians
    const horizontal = Math.cos(pitch)
    return { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch), z: Math.cos(yaw) * horizontal }
  }

  // Rotate a local polar offset into world space to preserve the cone while looking up or down.
  shotDirection(right: number, up: number): Vec3 {
    const angle = Math.hypot(right, up)
    const forward = this.direction()
    if (angle === 0) return forward
    const localRight = this.direction(90, -this.pitch)
    const localUp = this.direction(0, 90)
    const along = Math.cos(angle * radians)
    const across = Math.sin(angle * radians) / angle
    return {
      x: forward.x * along + (localRight.x * right + localUp.x * up) * across,
      y: forward.y * along + (localRight.y * right + localUp.y * up) * across,
      z: forward.z * along + (localRight.z * right + localUp.z * up) * across,
    }
  }

  cameraSpace(point: Vec3): Vec3 {
    const x = point.x - this.x
    const y = point.y - this.y
    const z = point.z - this.z
    const axes = this.axes
    if (axes.yaw !== this.yaw || axes.pitch !== this.pitch) {
      axes.yaw = this.yaw
      axes.pitch = this.pitch
      axes.sinYaw = Math.sin(this.yaw * radians)
      axes.cosYaw = Math.cos(this.yaw * radians)
      axes.sinPitch = Math.sin(this.pitch * radians)
      axes.cosPitch = Math.cos(this.pitch * radians)
    }
    const { sinYaw, cosYaw, sinPitch, cosPitch } = axes
    const forward = x * sinYaw + z * cosYaw
    return {
      x: x * cosYaw - z * sinYaw,
      y: y * cosPitch - forward * sinPitch,
      z: y * sinPitch + forward * cosPitch,
    }
  }

  private toScreen(point: Vec3): ScreenPoint {
    const scale = this.focal / point.z
    return { x: this.width / 2 + point.x * scale, y: this.height / 2 - point.y * scale, depth: point.z }
  }

  project(point: Vec3): ScreenPoint | null {
    const local = this.cameraSpace(point)
    return local.z < near ? null : this.toScreen(local)
  }

  segment(a: Vec3, b: Vec3): [ScreenPoint, ScreenPoint] | null {
    let start = this.cameraSpace(a)
    let end = this.cameraSpace(b)
    if (start.z < near && end.z < near) return null
    if (start.z < near) start = clipToNear(start, end)
    if (end.z < near) end = clipToNear(end, start)
    return [this.toScreen(start), this.toScreen(end)]
  }
}
