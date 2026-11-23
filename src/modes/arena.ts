import type { Vec3 } from '../engine/camera.ts'

export type Mode = 'recoil' | 'strafe' | 'tracking' | 'free'
export type ImpactKind = 'board' | 'shield' | 'flesh' | 'miss'

export interface Impact {
  point: Vec3
  age: number
  kind: ImpactKind
  targetId: number | null
}

export interface Target {
  id: number
  kind: 'dummy' | 'moving'
  x: number
  z: number
  homeX: number
  homeZ: number
  height: number
  hp: number
  armor: number
  maxArmor: number
  hitFlash: number
  flashShield: boolean
  dead: boolean
  firstHit: number | null
  respawnAt: number
  motion?: Motion
}

interface Motion {
  seed: number
  direction: -1 | 1
  speed: number
  remaining: number
  crouch: boolean
}

export interface Shot {
  hit: boolean
  head: boolean
  damage: number
  shield: boolean
  broken: boolean
  killed: boolean
  point: Vec3 | null
  targetId: number | null
  elapsed: number
}

export const BOARD_LEFT = -3.8
export const BOARD_RIGHT = 3.8
export const BOARD_BOTTOM = .16
export const BOARD_TOP = 5.55
export const BOARD_AIM_Y = 1.64
export const BEAT_SECONDS = 1.2
const MAX_IMPACTS = 120
const WALL_Z = 132
const DEFAULT_HEIGHT = 1.95
const MAX_HP = 100

function makeTarget(id: number, x: number, z: number, armor: number, kind: Target['kind'] = 'dummy'): Target {
  return {
    id, kind, x, z, homeX: x, homeZ: z, height: DEFAULT_HEIGHT, hp: MAX_HP,
    armor, maxArmor: armor, hitFlash: 0, flashShield: false, dead: false, firstHit: null, respawnAt: 0,
    motion: kind === 'moving' ? { seed: Math.imul(id, 0x9e3779b9), direction: -1, speed: 0, remaining: 0, crouch: false } : undefined,
  }
}

function random(state: Motion): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0
  return state.seed / 0x100000000
}

function moveTarget(target: Target, tier: number, dt: number): void {
  const state = target.motion
  if (!state) return
  const span = tier === 1 ? 4.3 : tier === 2 ? 5.1 : 5.8
  while (dt > 1e-9) {
    if (state.remaining <= 1e-9) {
      if (tier === 1) {
        state.speed = 2.85
        state.remaining = Infinity
      } else if (tier === 2) {
        state.speed = 3.2 + random(state) * 2.1
        state.remaining = .35 + random(state) * .78
      } else {
        const pause = state.speed > 0 && random(state) < .29
        state.speed = pause ? 0 : 4.45 + random(state) * 3.65
        state.remaining = pause ? .12 + random(state) * .18 : .19 + random(state) * .53
        state.crouch = random(state) < (pause ? .68 : .25)
      }
      state.direction = state.direction === 1 ? -1 : 1
    }
    const boundary = target.homeX + state.direction * span
    const travel = state.speed ? Math.abs(boundary - target.x) / state.speed : Infinity
    const slice = Math.min(dt, travel, state.remaining)
    target.x += slice * state.speed * state.direction
    const height = state.crouch ? DEFAULT_HEIGHT * .73 : DEFAULT_HEIGHT
    target.height += (height - target.height) * -Math.expm1(-18 * slice)
    dt -= slice
    state.remaining -= slice
    if (travel <= slice + 1e-9 && travel <= state.remaining + slice + 1e-9) {
      target.x = boundary
      if (state.remaining <= 1e-9) continue
      state.direction = state.direction === 1 ? -1 : 1
    }
  }
}

function strikeRegion(target: Target, point: Vec3): 'head' | 'body' | null {
  const x = Math.abs(point.x - target.x)
  const y = point.y / target.height
  const head = (x / .145) ** 2 + ((y - .925) / .075) ** 2 <= 1
  if (head) return 'head'
  if (y >= .76 && y < .85 && x <= .115) return 'body'
  if (y >= .42 && y < .76 && x <= (y >= .55 ? .34 : .24)) return 'body'
  if (y >= .025 && y < .42 && x >= .044 && x <= .23) return 'body'
  return null
}

export class Arena {
  mode: Mode = 'recoil'
  distance = 30
  difficulty = 1
  armor = 125
  targets: Target[] = []
  impacts: Impact[] = []
  private time = 0

  constructor(mode: Mode = 'recoil', distance = 30, difficulty = 1, armor = 125) {
    this.configure(mode, distance, difficulty, armor)
  }

  get phase(): number { return this.time % BEAT_SECONDS }
  get beat(): 'left' | 'right' { return Math.floor(this.time / BEAT_SECONDS) % 2 === 0 ? 'left' : 'right' }
  get beatProgress(): number { return this.phase / BEAT_SECONDS }

  configure(mode: Mode, distance: number, difficulty: number, armor: number): void {
    this.mode = mode
    this.distance = Math.max(1, distance)
    this.difficulty = Math.min(3, Math.max(1, Math.round(difficulty)))
    this.armor = Math.max(0, armor)
    this.time = 0
    this.clearImpacts()
    this.respawn()
  }

  respawn(): void {
    const distance = this.distance
    if (this.mode === 'recoil') this.targets = []
    else if (this.mode === 'free') this.targets = [
      makeTarget(1, -4.5, distance === 15 ? 30 : 15, this.armor),
      makeTarget(2, 0, distance, this.armor),
      makeTarget(3, 6.5, distance === 75 ? 30 : 75, this.armor, 'moving'),
    ]
    else this.targets = [makeTarget(1, 0, distance, this.armor, this.mode === 'tracking' ? 'moving' : 'dummy')]
    this.step(0)
  }

  clearImpacts(): void { this.impacts.length = 0 }

  step(dt: number): void {
    this.time += dt
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i]
      impact.age += dt
      if (impact.kind !== 'board' && impact.age > .72) this.impacts.splice(i, 1)
    }
    for (const target of this.targets) {
      target.hitFlash = Math.max(0, target.hitFlash - dt)
      if (target.dead && this.time >= target.respawnAt) {
        target.hp = MAX_HP
        target.armor = target.maxArmor
        target.dead = false
        target.firstHit = null
      }
      if (!target.dead) moveTarget(target, this.difficulty, dt)
    }
  }

  shoot(origin: Vec3, direction: Vec3, body: number, head: number): Shot {
    const result: Shot = {
      hit: false, head: false, damage: 0, shield: false, broken: false, killed: false,
      point: null, targetId: null, elapsed: 0,
    }
    const at = (t: number): Vec3 => ({ x: origin.x + direction.x * t, y: origin.y + direction.y * t, z: origin.z + direction.z * t })
    let impact: ImpactKind = 'miss'
    if (this.mode === 'recoil' && direction.z > 0) {
      const t = (this.distance - origin.z) / direction.z
      const point = at(t)
      if (t > 0 && point.x >= BOARD_LEFT && point.x <= BOARD_RIGHT && point.y >= BOARD_BOTTOM && point.y <= BOARD_TOP) {
        result.hit = true
        result.point = point
        impact = 'board'
      }
    }

    let matched: Target | undefined
    let nearest = Infinity
    if (direction.z !== 0) {
      for (const target of this.targets) {
        const t = (target.z - origin.z) / direction.z
        if (target.dead || t <= 0 || t >= nearest) continue
        const point = at(t)
        const region = strikeRegion(target, point)
        if (!region) continue
        nearest = t
        matched = target
        result.point = point
        result.head = region === 'head'
      }
    }
    if (matched) {
      const damage = Math.max(0, result.head ? head : body)
      const absorbed = Math.min(matched.armor, damage)
      const healthDamage = Math.min(matched.hp, damage - absorbed)
      matched.firstHit ??= this.time
      matched.armor -= absorbed
      matched.hp -= healthDamage
      matched.hitFlash = .19
      matched.flashShield = absorbed > 0
      matched.dead = matched.hp === 0
      if (matched.dead) matched.respawnAt = this.time + 1.35
      result.hit = true
      result.damage = absorbed + healthDamage
      result.shield = absorbed > 0
      result.broken = result.shield && matched.armor === 0
      result.killed = matched.dead
      result.targetId = matched.id
      result.elapsed = this.time - matched.firstHit
      impact = result.shield ? 'shield' : 'flesh'
    }

    if (!result.point) {
      const floor = direction.y < 0 ? -origin.y / direction.y : Infinity
      const wall = direction.z > 0 ? (WALL_Z - origin.z) / direction.z : Infinity
      const t = Math.min(floor > 0 ? floor : Infinity, wall > 0 ? wall : Infinity)
      if (Number.isFinite(t)) result.point = at(t)
    }
    if (result.point) {
      // ponytail: bounded FIFO keeps impact rendering predictable during long sprays.
      if (this.impacts.length >= MAX_IMPACTS) this.impacts.shift()
      this.impacts.push({ point: result.point, age: 0, kind: impact, targetId: result.targetId })
    }
    return result
  }
}
