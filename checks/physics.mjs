import assert from 'node:assert/strict'
import { FixedClock, Magazine } from '../src/engine/cadence.ts'
import { weapons } from '../src/data/weapons.ts'

const [rifle, , , , havoc, nemesis, hemlok, car, devotion] = weapons

for (const weapon of [rifle, havoc]) {
  let reference
  for (const hz of [60, 144, 165, 240]) {
    const clock = new FixedClock()
    const magazine = new Magazine(weapon)
    const shots = []
    let input = 0
    for (let i = 0; i < hz * 4; i++) {
      clock.advance(1 / hz, 100 / hz, 0, (_dt, now, x) => {
        input += x
        const event = magazine.step(now, true, false)
        if (event.shot !== undefined) shots.push({ time: now, pattern: event.shot })
      })
    }
    assert.equal(shots.length, weapon.mag)
    assert.ok(Math.abs(input - 400) < .0001)
    assert.ok(Math.abs(shots[0].time - (weapon.charge ?? 0)) <= 1 / 480)
    assert.ok(Math.abs(shots.at(-1).time - shots[0].time - (weapon.mag - 1) * 60 / weapon.rpm) <= 1 / 480)
    if (reference) assert.deepEqual(shots, reference)
    reference = shots
    assert.equal(magazine.reload(4), true)
    assert.equal(magazine.reload(4), false)
    assert.equal(magazine.step(4 + weapon.reload, false, false).reloaded, true)
    assert.equal(magazine.ammo, weapon.mag)
  }
}

const charged = new Magazine(havoc)
assert.equal(charged.step(0, true, false).charging, true)
assert.deepEqual(charged.step(.2, false, false), {})
assert.equal(charged.step(.3, true, false).charging, true)
assert.equal(charged.step(.45, true, false).shot, undefined)
assert.equal(charged.step(.75, true, false).shot, 0)
assert.equal(new Magazine(havoc).step(0, true, true).shot, 0)
console.log('Physics timing checks passed at 60 / 144 / 165 / 240 Hz.')

const { Camera } = await import('../src/engine/camera.ts')
const { Movement } = await import('../src/engine/movement.ts')
const { Recoil, baseRecoilPath, spreadOffset, viewKickProgress } = await import('../src/engine/recoil.ts')
const { drawRecoilGuide } = await import('../src/ui/recoil-guide.ts')
const { adsFov } = await import('../src/engine/optics.ts')
const { Arena } = await import('../src/modes/arena.ts')
assert.deepEqual(weapons.map(w => w.pattern.length), [28, 30, 27, 26, 32, 32, 30, 27, 48])
assert.deepEqual(weapons.map(w => w.pattern.length), weapons.map(w => w.mag))
assert.ok(weapons.every(w => w.reload >= .95 && w.reload <= 1.45))
const cancel = new Magazine(havoc)
cancel.step(0, true, false)
cancel.step(.1, false, false)
assert.equal(cancel.step(.2, true, true).shot, 0)

const camera = new Camera()
camera.width = 960
camera.height = 600
const point = { x: 0, y: 1.64, z: 30 }
assert.equal(camera.project(point).x, camera.width / 2)
const move = new Movement()
for (let i = 0; i < 240; i++) move.step(1 / 480, new Set(['KeyD']), 0, 1)
camera.x = move.x
assert.ok(camera.project(point).x < camera.width / 2)
const before = camera.width / 2 - camera.project(point).x
camera.fov = adsFov(camera.fov, 4)
assert.ok(Math.abs(camera.width / 2 - camera.project(point).x - 4 * before) < .0001)
camera.yaw = Math.atan2(-camera.x, 30) * 180 / Math.PI
assert.ok(Math.abs(camera.project(point).x - camera.width / 2) < .0001)
camera.pitch = 73
const central = camera.direction()
const ray = camera.shotDirection(3, 4)
const dot = central.x * ray.x + central.y * ray.y + central.z * ray.z
assert.ok(Math.abs(Math.acos(dot) * 180 / Math.PI - 5) < .0001)
assert.ok(Math.abs(Math.hypot(ray.x, ray.y, ray.z) - 1) < .0001)
const cone = spreadOffset(2, () => .25)
assert.ok(Math.abs(Math.hypot(cone.yaw, cone.pitch) - 1) < .0001)

function testKick(turnSpeed) {
  const recoil = new Recoil()
  for (let i = 0; i < 30; i++) recoil.step(1 / 480, turnSpeed / 480, true, true, 3.75, false, 0, 0)
  recoil.kick(1, 1, .05, () => .5)
  assert.equal(recoil.yaw, 0)
  recoil.step(1 / 480, turnSpeed / 480, true, true, 3.75, false, 0, 0)
  assert.ok(recoil.pitch > 0 && recoil.pitch < .23)
  for (let i = 0; i < 32; i++) recoil.step(1 / 480, turnSpeed / 480, true, true, 3.75, false, 0, 0)
  return recoil
}
const stock = testKick(0)
assert.equal(stock.active, false)
assert.ok(Math.abs(stock.yaw - 1) < .0001 && Math.abs(stock.pitch - 1) < .0001)
const smoothed = testKick(-12)
assert.equal(smoothed.active, true)
assert.ok(smoothed.yaw < .15 && smoothed.pitch > .65 && smoothed.pitch < .8)
for (let i = 0; i < 480; i++) smoothed.step(1 / 480, 0, false, true, 3.75, true, 0, 0)
assert.ok(Math.abs(smoothed.pitch) < .01)

const board = new Arena('recoil', 30, 1, 125)
assert.equal(board.shoot({ x: 0, y: 1.64, z: 0 }, { x: 0, y: 0, z: 1 }, 18, 27).hit, true)
board.step(1)
assert.equal(board.impacts.length, 1)
board.clearImpacts()
assert.equal(board.impacts.length, 0)
const strafe = new Arena('strafe', 30, 1, 125)
const bodyRay = () => strafe.shoot({ x: 0, y: 1.36, z: 0 }, { x: 0, y: 0, z: 1 }, 50, 90)
assert.equal(bodyRay().shield, true)
bodyRay()
assert.equal(bodyRay().broken, true)
assert.equal(strafe.targets[0].hp, 75)
bodyRay()
assert.equal(bodyRay().killed, true)
strafe.step(1.36)
assert.equal(strafe.targets[0].armor, 125)
assert.equal(strafe.beat, 'right')
for (const distance of [15, 30, 50, 75]) {
  const free = new Arena('free', distance)
  assert.equal(new Set(free.targets.map(target => target.z)).size, 3)
  assert.equal(Math.min(...free.targets.map(target => target.z)), 15)
  assert.equal(Math.max(...free.targets.map(target => target.z)), 75)
}
console.log('Projection, optical cone, recoil smoothing/recovery, magazines, targets and shield damage passed.')

for (const speed of [3.74, 3.76]) for (const hz of [60, 144, 165, 240]) {
  const clock = new FixedClock()
  const recoil = new Recoil()
  for (let i = 0; i < hz; i++) {
    clock.advance(1 / hz, speed / hz, 0, (dt, now, yaw) => {
      recoil.step(dt, yaw, true, true, 3.75, false, 0, 0)
      if (now > .08) assert.equal(recoil.active, speed > 3.75)
    })
  }
}
const finalRound = new Recoil()
finalRound.step(.06, .72, true, true, 3.75, false, 0, 0)
finalRound.kick(1, 1, .05, () => .5)
finalRound.step(.05, 0, false, true, 3.75, false, 0, 0)
assert.ok(finalRound.yaw < .15)
console.log('Near-threshold input and final-round smoothing passed.')

const guide = baseRecoilPath([[1, 2], [-3, 2]])
assert.deepEqual(guide, [{ yaw: 0, pitch: 0 }, { yaw: 1, pitch: 2 }, { yaw: -2, pitch: 4 }])
assert.equal(baseRecoilPath(weapons[0].pattern).length, weapons[0].mag + 1)
assert.equal(viewKickProgress(0), 0)
assert.equal(viewKickProgress(.5), .875)
assert.equal(viewKickProgress(2), 1)
const lines = []
const circles = []
const canvas = {
  save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {}, moveTo() {},
  lineTo(x, y) { lines.push({ x, y }) },
  arc(x, y) { circles.push({ x, y }) },
}
drawRecoilGuide(canvas, 800, 600, 500, guide, 1.5)
assert.ok(lines[0].x < 400 && lines[1].x > 400 && lines[1].y > lines[0].y)
assert.ok(circles.at(-1).x > 400 && circles.at(-1).y > lines[0].y && circles.at(-1).y < lines[1].y)
console.log('Counter-recoil curve includes the full magazine and moves smoothly between inverse waypoints.')

function runCadence(spec, hz, duration, held) {
  const clock = new FixedClock()
  const magazine = new Magazine(spec)
  const shots = []
  for (let frame = 0; frame < Math.round(hz * duration); frame++) {
    clock.advance(1 / hz, 0, 0, (_dt, time) => {
      const event = magazine.step(time, held(time), false)
      if (event.shot !== undefined) shots.push({ time, index: event.shot })
    })
  }
  return { shots, ammo: magazine.ammo }
}

assert.equal(hemlok.burst.rounds, 3)
assert.equal(nemesis.burst.rounds, 4)
assert.equal(car.burst, undefined)

for (const spec of [hemlok, nemesis]) {
  const singleTap = runCadence(spec, 60, 1, now => now === 0)
  assert.equal(singleTap.shots.length, spec.burst.rounds)
  assert.equal(singleTap.ammo, spec.mag - spec.burst.rounds)
  const full = runCadence(spec, 60, 6, () => true)
  assert.equal(full.shots.length, spec.mag)
  assert.deepEqual(full.shots.map(shot => shot.index), full.shots.map((_, index) => index))
  for (const hz of [144, 165, 240]) assert.deepEqual(runCadence(spec, hz, 6, () => true), full)
}

const warmed = runCadence(nemesis, 144, 5, () => true).shots
assert.ok(warmed[4].time - warmed[3].time > warmed[16].time - warmed[15].time)
const spunUp = runCadence(devotion, 60, 5, () => true)
assert.equal(spunUp.shots.length, devotion.mag)
assert.ok(spunUp.shots[1].time - spunUp.shots[0].time > spunUp.shots[16].time - spunUp.shots[15].time)
for (const hz of [144, 165, 240]) assert.deepEqual(runCadence(devotion, hz, 5, () => true), spunUp)
assert.equal(runCadence({ ...hemlok, mag: 2 }, 60, 1, now => now === 0).ammo, 0)
const canceledBurst = new Magazine(nemesis)
assert.equal(canceledBurst.step(0, true, false).shot, 0)
assert.equal(canceledBurst.reload(.02), true)
assert.deepEqual(canceledBurst.step(.25, false, false), {})
assert.equal(canceledBurst.step(.02 + nemesis.reload, false, false).reloaded, true)
assert.deepEqual(canceledBurst.step(1.4, false, false), {})
canceledBurst.step(1.5, true, false)
canceledBurst.release()
assert.deepEqual(canceledBurst.step(1.7, false, false), {})
console.log('Burst, charge ramp, spin-up and burst cancellation passed at 60 / 144 / 165 / 240 Hz.')

function followedShot(turn, bearing, proximity = 1, smoothing = true) {
  const recoil = new Recoil()
  recoil.step(.06, turn * .06, true, smoothing, 3.75, false, 0, 0, { yawRate: bearing, proximity })
  return recoil
}
assert.equal(followedShot(0, 10).suppression, 0)
assert.equal(followedShot(3, -4).suppression, 0)
assert.equal(followedShot(3, 4, 0).suppression, 0)
assert.equal(followedShot(12, 12, 1, false).suppression, 0)
assert.ok(followedShot(3, 1).suppression < followedShot(3, 3).suppression)
assert.ok(followedShot(9, 9).suppression > followedShot(9, 0).suppression)
assert.ok(followedShot(5, 5).suppression < followedShot(12, 12).suppression)
assert.ok(followedShot(110, 110).suppression <= .98)
const tracked = followedShot(-3, -3)
assert.equal(tracked.trackingActive, true)
tracked.kick(1, 1, .05, () => .5)
tracked.step(.05, 0, false, true, 3.75, false, 0, 0)
assert.ok(tracked.yaw < 1 && tracked.pitch < 1)
tracked.clearTurnHistory()
assert.equal(tracked.yawRate, 0)
assert.equal(tracked.trackingRate, 0)
console.log('Relative tracking requires matching look input and scales the captured shot kick.')

const { TargetMotion } = await import('../src/engine/tracking.ts')
function bearingFor(distance, playerSpeed, dummySpeed, radialSpeed = 0) {
  const tracking = new TargetMotion()
  for (let i = 0; i < 145; i++) {
    const time = i / 480
    const body = { id: 1, x: dummySpeed * time, z: distance + radialSpeed * time, height: 2 }
    const origin = { x: playerSpeed * time, y: 1.44, z: 0 }
    const yaw = Math.atan2(body.x - origin.x, body.z) * 180 / Math.PI
    tracking.step(1 / 480, origin, yaw, 0, [body])
  }
  return tracking
}
assert.equal(bearingFor(30, 5, 5).yawRate, 0)
assert.equal(bearingFor(30, 0, 0, 5).yawRate, 0)
assert.ok(bearingFor(30, 4, 0).yawRate < 0)
assert.ok(bearingFor(15, -4, 4).yawRate > bearingFor(75, -4, 4).yawRate)
assert.ok(bearingFor(30, -4, 4).yawRate > bearingFor(30, 0, 4).yawRate)
const switched = bearingFor(30, 0, 4)
switched.step(1 / 480, { x: 0, y: 1.44, z: 0 }, 0, 0, [{ id: 2, x: 0, z: 30, height: 2 }])
assert.equal(switched.yawRate, 0)
switched.step(1 / 480, { x: 0, y: 1.44, z: 0 }, 30, 0, [{ id: 2, x: 0, z: 30, height: 2 }])
assert.equal(switched.proximity, 0)
console.log('Target bearing follows relative side motion, distance and target selection.')
