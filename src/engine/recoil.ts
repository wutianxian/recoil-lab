type Kick = { yaw: number; pitch: number; duration: number; elapsed: number }
type MouseSample = { time: number; yaw: number }

const smoothingWindow = .06
const springFrequency = 26

export function viewKickProgress(progress: number) {
  return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3
}

export function baseRecoilPath(pattern: readonly (readonly [number, number])[]) {
  let yaw = 0
  let pitch = 0
  const path = [{ yaw, pitch }]
  for (const [yawKick, pitchKick] of pattern) {
    yaw += yawKick
    pitch += pitchKick
    path.push({ yaw, pitch })
  }
  return path
}

export class Recoil {
  yaw = 0
  pitch = 0
  swayYaw = 0
  swayPitch = 0
  yawRate = 0
  suppression = 0
  active = false

  private readonly kicks: Kick[] = []
  private readonly samples: MouseSample[] = []
  private sampledTime = 0
  private sampledYaw = 0
  private springYaw = 0
  private springPitch = 0

  reset() {
    this.yaw = this.pitch = this.swayYaw = this.swayPitch = 0
    this.yawRate = this.suppression = 0
    this.active = false
    this.kicks.length = this.samples.length = 0
    this.sampledTime = this.sampledYaw = this.springYaw = this.springPitch = 0
  }

  private sampleMouse(dt: number, mouseYaw: number) {
    this.samples.push({ time: dt, yaw: mouseYaw })
    this.sampledTime += dt
    this.sampledYaw += mouseYaw
    // Keep a time window of signed input deltas. Weapon kick never enters it.
    while (this.sampledTime - smoothingWindow > 1e-12) {
      const oldest = this.samples[0]
      const expired = Math.min(this.sampledTime - smoothingWindow, oldest.time)
      const angle = oldest.yaw * expired / oldest.time
      this.sampledTime -= expired
      this.sampledYaw -= angle
      oldest.time -= expired
      oldest.yaw -= angle
      if (oldest.time <= 1e-12) this.samples.shift()
    }
    this.yawRate = this.sampledYaw / smoothingWindow
  }

  step(dt: number, mouseYaw: number, firing: boolean, smoothing: boolean, threshold: number,
    recovery: boolean, moveYaw: number, movePitch: number) {
    if (dt <= 0) return
    this.sampleMouse(dt, mouseYaw)
    const turnSpeed = Math.abs(this.yawRate)
    this.active = firing && smoothing && turnSpeed > threshold
    this.suppression = this.active ? .88 + .10 * Math.min(1, (turnSpeed - threshold) / Math.max(1, threshold)) : 0

    for (const impulse of this.kicks) {
      const before = viewKickProgress(impulse.elapsed / impulse.duration)
      impulse.elapsed = Math.min(impulse.duration, impulse.elapsed + dt)
      const kick = viewKickProgress(impulse.elapsed / impulse.duration) - before
      this.yaw += impulse.yaw * kick
      this.pitch += impulse.pitch * kick
    }
    while (this.kicks.length && this.kicks[0].elapsed >= this.kicks[0].duration) this.kicks.shift()

    if (recovery && !firing && !this.kicks.length) {
      const settle = Math.exp(-4.6 * dt)
      this.yaw *= settle
      this.pitch *= settle
    }

    // Critically damped spring tracking a changing movement offset.
    const decay = Math.exp(-springFrequency * dt)
    const yawError = this.swayYaw - moveYaw
    const pitchError = this.swayPitch - movePitch
    const yawVelocity = this.springYaw + springFrequency * yawError
    const pitchVelocity = this.springPitch + springFrequency * pitchError
    this.swayYaw = moveYaw + (yawError + yawVelocity * dt) * decay
    this.swayPitch = movePitch + (pitchError + pitchVelocity * dt) * decay
    this.springYaw = (this.springYaw - springFrequency * yawVelocity * dt) * decay
    this.springPitch = (this.springPitch - springFrequency * pitchVelocity * dt) * decay
  }

  kick(yaw: number, pitch: number, duration: number, random: () => number = Math.random) {
    const shotYaw = (yaw + (random() - .5) * .045) * (1 - this.suppression)
    const shotPitch = (pitch + (random() - .5) * .06) * (1 - this.suppression * .32)
    this.kicks.push({ yaw: shotYaw, pitch: shotPitch, duration: Math.max(.001, duration), elapsed: 0 })
    this.springYaw += 21 * shotYaw
    this.springPitch += 17 * shotPitch
  }
}

export function spreadOffset(radius: number, random: () => number = Math.random) {
  const distance = Math.sqrt(random()) * radius
  const heading = random() * 2 * Math.PI
  return { yaw: Math.cos(heading) * distance, pitch: Math.sin(heading) * distance }
}
