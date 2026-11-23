import type { Weapon } from '../data/weapons.ts'

export const STEP = 1 / 480

export class FixedClock {
  private remainder = 0
  private tick = 0
  private mouseX = 0
  private mouseY = 0

  clearInput() {
    this.remainder = this.mouseX = this.mouseY = 0
  }

  advance(elapsed: number, mouseX: number, mouseY: number,
    simulate: (dt: number, now: number, mouseX: number, mouseY: number) => void) {
    this.remainder += Math.min(elapsed, .1)
    this.mouseX += mouseX
    this.mouseY += mouseY
    const steps = Math.floor((this.remainder + 1e-9) / STEP)
    if (!steps) return
    // Carry the mouse displacement for the fraction of a physics step into the next frame.
    const x = this.mouseX * STEP / this.remainder
    const y = this.mouseY * STEP / this.remainder
    this.remainder = Math.max(0, this.remainder - STEP * steps)
    this.mouseX = this.remainder > 1e-9 ? this.mouseX - x * steps : 0
    this.mouseY = this.remainder > 1e-9 ? this.mouseY - y * steps : 0
    for (let i = 0; i < steps; i++) simulate(STEP, this.tick++ * STEP, x, y)
  }
}

type MagazineSpec = Pick<Weapon, 'mag' | 'rpm' | 'reload' | 'charge' | 'burst' | 'spinUp'>
interface FireEvent { shot?: number; charging?: boolean; reloaded?: boolean; empty?: boolean }

export class Magazine {
  ammo: number
  serial = 0
  patternIndex = 0
  reloadUntil = -1
  chargeStarted = -1
  private readyAt = 0
  private lastShot = -Infinity
  private held = false
  private burstRemaining = 0
  private burstHeat = 0
  private lastBurstAt = -Infinity
  private spinStarted = -1
  readonly spec: MagazineSpec

  constructor(spec: MagazineSpec) {
    this.spec = spec
    this.ammo = spec.mag
  }

  reload(now: number) {
    if (this.reloadUntil >= 0 || this.ammo === this.spec.mag) return false
    this.reloadUntil = now + this.spec.reload
    this.release()
    return true
  }

  release() {
    this.stopTrigger()
    this.burstRemaining = 0
    this.burstHeat = 0
    this.lastBurstAt = -Infinity
  }

  private stopTrigger() {
    this.held = false
    this.chargeStarted = -1
    this.spinStarted = -1
  }

  get bursting() {
    return this.burstRemaining > 0
  }

  private nextPattern(now: number) {
    const resetAfter = Math.max(.28, (this.spec.burst?.pause ?? 0) + .10)
    return now - this.lastShot > resetAfter ? 0 : this.patternIndex
  }

  private nextInterval(now: number) {
    const { rpm, spinUp, burst } = this.spec
    if (burst) {
      this.burstRemaining--
      if (this.burstRemaining > 0) return 60 / rpm
      if (burst.minPause === undefined) return burst.pause
      if (now - this.lastBurstAt > 1.2) this.burstHeat = 0
      this.lastBurstAt = now
      const pause = burst.pause + (burst.minPause - burst.pause) * this.burstHeat / 5
      this.burstHeat = Math.min(5, this.burstHeat + 1)
      return pause
    }
    if (spinUp) {
      const spin = Math.min(1, (now - this.spinStarted) / spinUp.seconds)
      return 60 / (spinUp.startRpm + (rpm - spinUp.startRpm) * spin)
    }
    return 60 / rpm
  }

  step(now: number, trigger: boolean, turbo: boolean): FireEvent {
    if (this.reloadUntil >= 0) {
      if (now + 1e-9 < this.reloadUntil) return {}
      this.ammo = this.spec.mag
      this.serial++
      this.patternIndex = 0
      this.lastShot = -Infinity
      this.reloadUntil = -1
      return { reloaded: true }
    }

    if (!trigger) {
      this.stopTrigger()
      if (!this.bursting) return {}
    }

    const first = trigger && !this.held
    this.held = trigger
    if (!this.ammo) return first ? { empty: true } : {}

    const charge = turbo ? 0 : (this.spec.charge ?? 0)
    if (first && !this.bursting) {
      this.chargeStarted = charge ? now : -1
      this.spinStarted = now
      this.readyAt = Math.max(this.readyAt, now)
    }
    if (this.chargeStarted >= 0) {
      const chargedAt = turbo ? now : this.chargeStarted + charge
      if (now + 1e-9 < chargedAt) return first ? { charging: true } : {}
      this.readyAt = Math.max(this.readyAt, chargedAt)
      this.chargeStarted = -1
    }
    if (now + 1e-9 < this.readyAt) return {}
    if (this.spec.burst && !this.bursting) this.burstRemaining = Math.min(this.spec.burst.rounds, this.ammo)
    this.patternIndex = this.nextPattern(now)
    this.lastShot = now
    this.readyAt += this.nextInterval(now)
    this.ammo--
    return { shot: this.patternIndex++ }
  }
}
