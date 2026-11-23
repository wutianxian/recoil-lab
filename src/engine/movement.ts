const gravity = 15.5

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

export class Movement {
  x = 0
  y = 1.64
  z = 0
  bobYaw = 0
  bobPitch = 0
  swayYaw = 0
  swayPitch = 0
  speed = 0
  crouch = 0

  private vx = 0
  private vz = 0
  private jumpVelocity = 0
  private lift = 0
  private jumpHeld = false
  private phase = 0

  step(dt: number, keys: ReadonlySet<string>, yaw: number, ads: number) {
    if (dt <= 0) return
    const crouching = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')
    this.crouch += (Number(crouching) - this.crouch) * (1 - Math.exp(-15 * dt))

    const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
    const input = Math.hypot(right, forward)
    const heading = yaw * Math.PI / 180
    const sin = Math.sin(heading)
    const cos = Math.cos(heading)
    const topSpeed = (4.8 - 2.45 * this.crouch) * (1 - .33 * ads)
    const stride = topSpeed / (input || 1)
    const targetX = (right * cos + forward * sin) * stride
    const targetZ = (forward * cos - right * sin) * stride
    const response = input ? (this.lift > 0 ? 5 : 12) : 16
    const approach = 1 - Math.exp(-response * dt)
    const previousX = this.vx
    const previousZ = this.vz
    const nextX = this.x + targetX * dt + (previousX - targetX) * approach / response
    const nextZ = this.z + targetZ * dt + (previousZ - targetZ) * approach / response
    this.x = clamp(nextX, -10, 10)
    this.z = clamp(nextZ, -12, 5)
    this.vx = this.x === nextX ? previousX + (targetX - previousX) * approach : 0
    this.vz = this.z === nextZ ? previousZ + (targetZ - previousZ) * approach : 0
    this.speed = Math.hypot(this.vx, this.vz)

    const jumping = keys.has('Space')
    if (jumping && !this.jumpHeld && this.lift === 0) this.jumpVelocity = 4.55
    this.jumpHeld = jumping
    if (this.jumpVelocity || this.lift) {
      this.lift += (this.jumpVelocity - gravity * dt / 2) * dt
      this.jumpVelocity -= gravity * dt
      if (this.lift <= 0) this.lift = this.jumpVelocity = 0
    }

    this.phase = (this.phase + this.speed * 4.2 * dt) % (4 * Math.PI)
    const bob = this.speed / 4.8 * (1 - .65 * ads) * (this.lift > 0 ? .12 : 1)
    const footstep = Math.sin(this.phase)
    this.y = 1.64 - .64 * this.crouch + this.lift + footstep * .026 * bob
    this.bobYaw = Math.sin(this.phase / 2) * .17 * bob
    this.bobPitch = footstep * .11 * bob

    const ax = (this.vx - previousX) / dt
    const az = (this.vz - previousZ) / dt
    const sway = 1 - Math.exp(-17 * dt)
    const turn = clamp(-(ax * cos - az * sin) * .012, -.38, .38)
    const tilt = clamp((ax * sin + az * cos) * .008, -.23, .23)
    this.swayYaw += (turn - this.swayYaw) * sway
    this.swayPitch += (tilt - this.swayPitch) * sway
  }
}
