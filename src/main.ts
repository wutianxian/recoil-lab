import { Camera } from './engine/camera.ts'
import type { Vec3 } from './engine/camera.ts'
import { Movement } from './engine/movement.ts'
import { Recoil, baseRecoilPath, spreadOffset, viewKickProgress } from './engine/recoil.ts'
import { FixedClock, Magazine } from './engine/cadence.ts'
import { adsFov, drawSight, easeAds, optics } from './engine/optics.ts'
import { RangeAudio } from './engine/audio.ts'
import { World } from './engine/world.ts'
import { weapons } from './data/weapons.ts'
import { Arena, BOARD_AIM_Y } from './modes/arena.ts'
import { Panel } from './ui/panel.ts'
import type { ChartPoint, Settings } from './ui/panel.ts'
import { drawRecoilGuide } from './ui/recoil-guide.ts'

const rad = Math.PI / 180
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const wrap = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180
const armorColors: Record<number, string> = { 50: '#f4f7f3', 75: '#77c6ff', 100: '#c894fa', 125: '#ff654f' }

const camera = new Camera()
const clock = new FixedClock()
const audio = new RangeAudio()
const world = new World()
const arena = new Arena()
const recoil = new Recoil()
let move = new Movement()
let magazine = new Magazine(weapons[0])
let guidePath: ChartPoint[] = []
let baseline: ChartPoint[] = []
let controlled: ChartPoint[] = []
let clipOffsets: { x: number; y: number }[] = []
let traceOrigin: { position: Vec3; forward: Vec3; yaw: number; pitch: number; depth: number } | null = null
let clipShots = 0
let clipSmoothed = 0
let stats = { shots: 0, hits: 0, heads: 0, damage: 0, kills: 0, oneClips: 0, killTime: 0, firingTime: 0, smoothTime: 0 }
const firstMagazine = new Map<number, { magazine: Magazine; serial: number }>()
const keys = new Set<string>()
const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ControlLeft', 'ControlRight', 'Space'])
const floaters: { p: Vec3; text: string; color: string; age: number }[] = []

let simNow = 0
let lookYaw = 0
let lookPitch = 0
let adsProgress = 0
let zoom = 1
let variableZoom = 2
let aimDown = false
let fireDown = false
let fireTap = false
let mouseX = 0
let mouseY = 0
let locked = false
let redraw = true
let recoilFlash = 0
let guideShot: { index: number; at: number } | null = null
let hitFlash = 0
let hitColor = '#ffffff'
let spread = 0
let notice = ''
let noticeTime = 0
let previous = performance.now()
let lastHud = -Infinity

const panel = new Panel(weapons, optics.map(optic => optic.name), change, enter, resetSession)
const { canvas } = panel
const ctx = canvas.getContext('2d', { alpha: false })!
resize()
new ResizeObserver(resize).observe(canvas)
resetSession()
requestAnimationFrame(frame)

function resize() {
  const width = Math.max(1, canvas.clientWidth)
  const height = Math.max(1, canvas.clientHeight)
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pixelsX = Math.round(width * dpr)
  const pixelsY = Math.round(height * dpr)
  if (canvas.width !== pixelsX) canvas.width = pixelsX
  if (canvas.height !== pixelsY) canvas.height = pixelsY
  ctx.setTransform(pixelsX / width, 0, 0, pixelsY / height, 0, 0)
  camera.width = width
  camera.height = height
  redraw = true
}

function setNotice(text: string, duration = 1.6) {
  notice = text
  noticeTime = duration
}

function clearTrace() {
  traceOrigin = null
  controlled = []
  clipOffsets = []
  clipShots = clipSmoothed = 0
}

function equip() {
  const weapon = weapons[panel.settings.weapon]
  magazine = new Magazine(weapon)
  guidePath = baseRecoilPath(weapon.pattern)
  baseline = guidePath.slice(0, -1)
  clearTrace()
  guideShot = null
  recoil.reset()
  audio.stopCharge()
}

function resetSession() {
  const { mode, distance, difficulty, armor } = panel.settings
  arena.configure(mode, distance, difficulty, armor)
  move = new Movement()
  stats = { shots: 0, hits: 0, heads: 0, damage: 0, kills: 0, oneClips: 0, killTime: 0, firingTime: 0, smoothTime: 0 }
  firstMagazine.clear()
  floaters.length = 0
  recoilFlash = hitFlash = noticeTime = 0
  notice = ''
  lookYaw = 0
  const initialAimY = mode === 'recoil' ? BOARD_AIM_Y : 1.36
  lookPitch = Math.atan2(initialAimY - move.y, distance - move.z) / rad
  adsProgress = 0
  aimDown = false
  equip()
  syncCamera()
  redraw = true
}

function change(settings: Settings, key: keyof Settings) {
  if (key === 'mode' || key === 'distance' || key === 'difficulty' || key === 'armor') resetSession()
  if (key === 'weapon') {
    lookYaw = camera.yaw
    lookPitch = camera.pitch
    equip()
  }
  if (key === 'optic') variableZoom = 2
  if (key === 'adsMode') aimDown = false
  if (key === 'volume') audio.volume = settings.volume
  syncCamera()
  redraw = true
}

function enter() {
  if (document.pointerLockElement === canvas) return
  audio.unlock()
  try {
    const result = canvas.requestPointerLock({ unadjustedMovement: true })
    if (result) void result.catch((error: DOMException) => {
      if (error.name === 'NotSupportedError') {
        try {
          const fallback = canvas.requestPointerLock()
          if (fallback) void fallback.catch(pointerError)
        } catch {
          pointerError()
        }
      } else pointerError()
    })
  } catch {
    pointerError()
  }
}

function pointerError() {
  setNotice('无法锁定鼠标。请在独立桌面浏览器中打开靶场，再点击训练区域。', 5)
  redraw = true
}

function releaseInput() {
  keys.clear()
  fireDown = fireTap = aimDown = false
  mouseX = mouseY = 0
  clock.clearInput()
  guideShot = null
  magazine.release()
  audio.stopCharge()
}

canvas.addEventListener('click', enter)
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas
  releaseInput()
  if (locked) {
    noticeTime = 0
    audio.unlock()
  } else {
    adsProgress = 0
    syncCamera()
    audio.clear()
  }
  previous = performance.now()
  redraw = true
})
document.addEventListener('pointerlockerror', pointerError)
window.addEventListener('blur', () => {
  if (locked) {
    releaseInput()
    document.exitPointerLock()
  }
})
document.addEventListener('contextmenu', event => {
  if (locked || event.target === canvas) event.preventDefault()
})
document.addEventListener('mousemove', event => {
  if (!locked) return
  mouseX += event.movementX
  mouseY += event.movementY
})
document.addEventListener('mousedown', event => {
  if (!locked) return
  if (event.button === 0) {
    fireDown = fireTap = true
    event.preventDefault()
  }
  if (event.button === 2) {
    aimDown = panel.settings.adsMode === 'toggle' ? !aimDown : true
    event.preventDefault()
  }
})
document.addEventListener('mouseup', event => {
  if (event.button === 0) {
    fireDown = false
    audio.stopCharge()
  }
  if (event.button === 2 && panel.settings.adsMode === 'hold') aimDown = false
})
document.addEventListener('keydown', event => {
  if (!locked) return
  if (moveKeys.has(event.code)) {
    keys.add(event.code)
    event.preventDefault()
    return
  }
  if (event.repeat) return
  const settings = panel.settings
  if (/^Digit[1-9]$/.test(event.code)) panel.set('weapon', Number(event.code[5]) - 1)
  else if (event.code === 'KeyQ') panel.set('optic', (settings.optic + optics.length - 1) % optics.length)
  else if (event.code === 'KeyE') panel.set('optic', (settings.optic + 1) % optics.length)
  else if (event.code === 'KeyR') {
    if (magazine.reload(simNow)) {
      audio.stopCharge()
      audio.reload(magazine.spec.reload)
    }
  } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    if (settings.optic === 5 && aimDown && adsProgress > 0) {
      variableZoom = variableZoom === 2 ? 4 : 2
      setNotice(variableZoom + '×')
    }
  } else if (event.code !== 'Escape') return
  if (event.code === 'Escape') document.exitPointerLock()
  event.preventDefault()
})
document.addEventListener('keyup', event => keys.delete(event.code))

function effectiveZoom(settings = panel.settings) {
  return settings.optic === 5 ? variableZoom : optics[settings.optic].zoom
}

function syncCamera() {
  const settings = panel.settings
  const ads = easeAds(adsProgress)
  zoom = mix(1, effectiveZoom(settings), ads)
  camera.fov = adsFov(settings.fov, zoom)
  camera.x = move.x
  camera.y = move.y
  camera.z = move.z
  camera.yaw = wrap(lookYaw + recoil.yaw + move.bobYaw)
  camera.pitch = clamp(lookPitch + recoil.pitch + move.bobPitch, -85, 85)
  const hip = weapons[settings.weapon].hip * (1 + move.speed * .105) * (1 - move.crouch * .38)
  spread = mix(hip, .025, ads)
}

function simulate(dt: number, now: number, dx: number, dy: number) {
  simNow = now
  const settings = panel.settings
  const weapon = weapons[settings.weapon]
  const adsTarget = aimDown && magazine.reloadUntil < 0
  const adsDuration = weapon.ads * optics[settings.optic].ads
  adsProgress = clamp(adsProgress + (adsTarget ? 1 : -1) * dt / adsDuration, 0, 1)
  const ads = easeAds(adsProgress)
  const magnification = effectiveZoom(settings)
  const opticLevel = magnification < 2 ? 0 : magnification - 1
  const degreesPerCount = .022 * settings.sensitivity * mix(1, settings.multipliers[opticLevel] / magnification, ads)
  const mouseYaw = dx * degreesPerCount
  const trigger = fireDown || fireTap
  fireTap = false
  const event = magazine.step(now, trigger, settings.turbo)
  const firing = magazine.reloadUntil < 0 && magazine.chargeStarted < 0
    && (event.shot !== undefined || (magazine.ammo > 0 && (trigger || magazine.bursting)))
  lookYaw = wrap(lookYaw + mouseYaw)
  lookPitch = clamp(lookPitch - dy * degreesPerCount, -85 - recoil.pitch, 85 - recoil.pitch)
  move.step(dt, keys, camera.yaw, ads)
  recoil.step(dt, mouseYaw, firing, settings.smoothing, settings.threshold,
    settings.recovery, move.swayYaw, move.swayPitch)
  arena.step(dt)
  syncCamera()
  recoilFlash = Math.max(0, recoilFlash - dt * 17)
  hitFlash = Math.max(0, hitFlash - dt * 8)
  noticeTime = Math.max(0, noticeTime - dt)
  for (let i = floaters.length - 1; i >= 0; i--) {
    const floater = floaters[i]
    floater.age += dt
    if (floater.age > .78) floaters.splice(i, 1)
  }
  if (firing) {
    stats.firingTime += dt
    if (recoil.active) stats.smoothTime += dt
  }
  if (event.charging && fireDown) audio.startCharge()
  if (event.empty) audio.empty()
  if (event.reloaded) audio.ready()
  if (event.shot !== undefined) shoot(event.shot)
}

function shoot(index: number) {
  const { weapon: weaponIndex } = panel.settings
  const weapon = weapons[weaponIndex]
  const dispersion = spreadOffset(spread)
  const origin = { x: camera.x, y: camera.y, z: camera.z }
  const direction = camera.shotDirection(dispersion.yaw, dispersion.pitch)
  if (magazine.ammo === weapon.mag - 1) clearTrace()
  addTrace(origin, direction)
  stats.shots++
  clipShots++
  if (recoil.active) clipSmoothed++
  const shot = arena.shoot(origin, direction, weapon.body, weapon.head)
  audio.fire(weaponIndex)
  recoilFlash = 1
  const [yaw, pitch] = weapon.pattern[index]
  recoil.kick(yaw, pitch, weapon.kickTime)
  guideShot = { index, at: simNow }
  if (!shot.hit) return
  stats.hits++
  if (shot.head) stats.heads++
  if (shot.targetId === null || !shot.point) {
    hitFlash = .52
    hitColor = '#dfe8df'
    return
  }

  const targetId = shot.targetId
  const armor = arena.targets.find(target => target.id === targetId)?.maxArmor ?? 125
  stats.damage += shot.damage
  hitColor = shot.broken || shot.killed ? '#ff654f' : shot.shield ? armorColors[armor] ?? '#d1dbdf' : '#ffffff'
  hitFlash = 1
  audio.hit(shot.shield, shot.head, shot.broken)
  if (!firstMagazine.has(targetId)) {
    firstMagazine.set(targetId, { magazine, serial: magazine.serial })
  }
  if (shot.killed) {
    stats.kills++
    stats.killTime += shot.elapsed
    const firstHit = firstMagazine.get(targetId)
    if (firstHit?.magazine === magazine && firstHit.serial === magazine.serial) {
      stats.oneClips++
      setNotice('一梭子击杀 · ONE CLIP', 2)
    } else setNotice('假人击倒')
    firstMagazine.delete(targetId)
  } else if (shot.broken) setNotice('护甲击破')
  if (floaters.length >= 20) floaters.shift()
  floaters.push({ p: shot.point, text: String(shot.damage), color: hitColor, age: 0 })
}

function addTrace(position: Vec3, direction: Vec3) {
  if (!traceOrigin) {
    const depth = Math.max(2, arena.distance - position.z)
    traceOrigin = { position, forward: camera.direction(), depth, yaw: camera.yaw, pitch: camera.pitch }
  }
  const anchor = traceOrigin
  const forward = anchor.forward
  const dot = direction.x * forward.x + direction.y * forward.y + direction.z * forward.z
  const offset = (position.x - anchor.position.x) * forward.x
    + (position.y - anchor.position.y) * forward.y + (position.z - anchor.position.z) * forward.z
  const t = (anchor.depth - offset) / dot
  if (!Number.isFinite(t) || t < 0 || t > anchor.depth * 4) return
  const x = position.x + direction.x * t - anchor.position.x
  const y = position.y + direction.y * t - anchor.position.y
  const z = position.z + direction.z * t - anchor.position.z
  controlled.push({
    yaw: wrap(Math.atan2(x, z) / rad - anchor.yaw),
    pitch: Math.atan2(y, Math.hypot(x, z)) / rad - anchor.pitch,
  })
  const right = x * Math.cos(anchor.yaw * rad) - z * Math.sin(anchor.yaw * rad)
  const up = y * Math.cos(anchor.pitch * rad) - Math.sin(anchor.pitch * rad)
    * (x * Math.sin(anchor.yaw * rad) + z * Math.cos(anchor.yaw * rad))
  clipOffsets.push({ x: right, y: up })
}

function spreadRadius() {
  const count = clipOffsets.length
  if (count < 2) return null
  const mx = clipOffsets.reduce((sum, hit) => sum + hit.x, 0) / count
  const my = clipOffsets.reduce((sum, hit) => sum + hit.y, 0) / count
  return 100 * Math.sqrt(clipOffsets.reduce((sum, hit) => sum + (hit.x - mx) ** 2 + (hit.y - my) ** 2, 0) / count)
}

function draw() {
  const { width, height } = camera
  const settings = panel.settings
  world.draw(ctx, camera, arena)

  const reload = magazine.reloadUntil < 0 ? 0
    : clamp(1 - (magazine.reloadUntil - simNow) / magazine.spec.reload, 0, 1)
  drawSight(ctx, width, height, {
    index: settings.optic, zoom: effectiveZoom(), ads: easeAds(adsProgress), spread,
    focal: camera.focal, swayYaw: recoil.swayYaw, swayPitch: recoil.swayPitch,
    weapon: settings.weapon, flash: recoilFlash, reload,
  })

  if (locked && settings.guide && magazine.reloadUntil < 0 && guideShot) {
    const age = simNow - guideShot.at
    if (age < .65) {
      const progress = guideShot.index + viewKickProgress(age / weapons[settings.weapon].kickTime)
      drawRecoilGuide(ctx, width, height, camera.focal, guidePath, progress)
    }
  }

  ctx.save()
  ctx.font = '700 16px ui-monospace, monospace'
  ctx.textAlign = 'center'
  for (const floater of floaters) {
    const p = camera.project(floater.p)
    if (!p) continue
    ctx.globalAlpha = 1 - floater.age / .78
    ctx.lineWidth = 3
    ctx.strokeStyle = '#10151a'
    ctx.fillStyle = floater.color
    const y = p.y - 16 - floater.age * 42
    ctx.strokeText(floater.text, p.x, y)
    ctx.fillText(floater.text, p.x, y)
  }
  if (hitFlash > 0) {
    ctx.globalAlpha = hitFlash
    ctx.strokeStyle = hitColor
    ctx.lineWidth = 1.8
    ctx.translate(width / 2, height / 2)
    ctx.beginPath()
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.moveTo(sx * 6, sy * 6)
      ctx.lineTo(sx * 12, sy * 12)
    }
    ctx.stroke()
  }
  ctx.restore()
}

function lookingAtDistance() {
  let best = Infinity
  let distance = Math.max(1, arena.distance - camera.z)
  for (const target of arena.targets) {
    const screen = camera.project({ x: target.x, y: target.height * .72, z: target.z })
    if (!screen) continue
    const error = Math.hypot(screen.x - camera.width / 2, screen.y - camera.height / 2)
    if (error < best) {
      best = error
      distance = Math.hypot(target.x - camera.x, target.z - camera.z)
    }
  }
  return distance
}

function frame(timestamp: number) {
  requestAnimationFrame(frame)
  const elapsed = Math.max(0, (timestamp - previous) / 1000)
  previous = timestamp
  if (locked) {
    clock.advance(elapsed, mouseX, mouseY, simulate)
    mouseX = mouseY = 0
  }
  if (!redraw && !locked) return
  draw()
  if (redraw || timestamp - lastHud > 33) {
    lastHud = timestamp
    const burst = weapons[panel.settings.weapon].burst
    panel.update({
      locked, ads: easeAds(adsProgress), zoom, ammo: magazine.ammo, magazine: magazine.spec.mag,
      yawRate: recoil.yawRate, smoothing: recoil.suppression, smoothingActive: recoil.active,
      beat: arena.mode === 'strafe' ? arena.beat : null, beatProgress: arena.beatProgress,
      damage: stats.damage, lookingAtDistance: lookingAtDistance(), status:
        magazine.reloadUntil >= 0 ? '换弹中' : magazine.chargeStarted >= 0 ? '蓄力中'
          : magazine.ammo === 0 ? '按 R 换弹' : burst ? `${burst.rounds} 连发` : '全自动',
      shotCoverage: clipShots ? clipSmoothed / clipShots : 0,
      hits: stats.hits, shots: stats.shots, headRate: stats.hits ? stats.heads / stats.hits : 0,
      accuracy: stats.shots ? stats.hits / stats.shots : 0, ttk: stats.kills ? stats.killTime / stats.kills : null,
      oneClip: stats.kills ? stats.oneClips / stats.kills : null,
      smoothingTime: stats.firingTime ? stats.smoothTime / stats.firingTime : 0,
      spread: spreadRadius(), notice: noticeTime > 0 ? notice : '', baseline, controlled,
    })
  }
  redraw = false
}
