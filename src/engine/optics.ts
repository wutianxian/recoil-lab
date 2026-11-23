export const optics = [
  { name: '机瞄', zoom: 1.1, ads: 1.03 },
  { name: '1x HCOG 经典红点', zoom: 1.25, ads: .95 },
  { name: '1x Holo 全息', zoom: 1.25, ads: 1.01 },
  { name: '2x HCOG Bruiser', zoom: 2, ads: 1.04 },
  { name: '3x HCOG Ranger', zoom: 3, ads: 1.12 },
  { name: '2x–4x Variable AOG', zoom: 2, ads: 1.16 },
] as const

const rad = Math.PI / 180
export const easeAds = (progress: number) => progress * progress * (3 - 2 * progress)
export const adsFov = (base: number, zoom: number) => 2 * Math.atan(Math.tan(base * rad / 2) / zoom) / rad

function path(ctx: CanvasRenderingContext2D, xy: number[], fill: string, stroke?: string) {
  ctx.beginPath()
  ctx.moveTo(xy[0], xy[1])
  for (let i = 2; i < xy.length; i += 2) ctx.lineTo(xy[i], xy[i + 1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string | CanvasGradient, stroke = false) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI)
  if (stroke) {
    ctx.strokeStyle = color
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    ctx.fill()
  }
}

const accents = ['#b05736', '#988058', '#5e8d88', '#538ca8', '#c49044', '#63aba2', '#9b7d65', '#ba6d52', '#769ea3']
const energyWeapons = new Set([3, 4, 5, 8])

function drawWeapon(ctx: CanvasRenderingContext2D, w: number, h: number, ads: number,
  handX: number, handY: number, weapon: number, flash: number, reload: number, optic: number) {
  const scale = Math.min(w / 810, h / 490, 1.5)
  const strike = Math.sin(reload * Math.PI)
  const size = 1 + ads * .16
  ctx.save()
  ctx.translate(w / 2 + (1 - ads) * w * .236 + handX + strike * 48,
    h / 2 + (1 - ads) * h * .255 + handY + strike * h * .6 + flash * 4)
  ctx.rotate((1 - ads) * -.31 + strike * .18)
  ctx.scale(scale * size, scale * size)

  const muzzle = weapon === 8 ? -14 : weapon === 2 || weapon === 3 || weapon === 7 ? 12 : 0
  const tint = accents[weapon]
  ctx.lineWidth = 1.2
  path(ctx, [14, 104, 45, 75, 76, 89, 120, 145, 119, 228, 51, 268, 15, 208, -20, 176], '#222526', '#131619')
  path(ctx, [-28, 120, -7, 108, 29, 108, 54, 148, 43, 172, 20, 163, -36, 171, -56, 148], '#343738', '#17191b')
  path(ctx, [-45, 141, -24, 132, 17, 130, 12, 149, -28, 161], '#222629')
  path(ctx, [-13, 33 + muzzle, 9, 33 + muzzle, 38, 128, -42, 128], '#192023', '#4b5353')
  path(ctx, [-11, 38 + muzzle, 8, 38 + muzzle, 25, 112, -26, 112], '#333b3d', '#1e2326')
  path(ctx, [-22, 59 + muzzle, -13, 48 + muzzle, -10, 102, -30, 109], '#424b48')
  path(ctx, [10, 48 + muzzle, 22, 59 + muzzle, 29, 104, 16, 98], '#212629')
  path(ctx, [-32, 97, 24, 95, 42, 133, 54, 189, 45, 274, -34, 274, -53, 192, -50, 142], '#21292d', '#090c10')
  path(ctx, [-23, 100, 18, 100, 29, 147, -27, 146], '#505a56', '#191f22')
  path(ctx, [-48, 143, -32, 120, -30, 161, -42, 201, -53, 183], tint)
  path(ctx, [25, 119, 45, 141, 53, 179, 39, 193, 30, 161], tint)
  path(ctx, [-26, 149, 28, 151, 39, 207, 26, 272, -17, 272, -38, 207], '#101619', '#434b49')
  path(ctx, [-21, 153, 23, 155, 29, 181, 22, 202, -25, 200, -31, 182], '#303c3a')
  path(ctx, [-12, 160, 15, 161, 17, 179, -13, 178], '#182629', '#6b8b83')
  ctx.fillStyle = energyWeapons.has(weapon) ? '#64f1e2' : '#f4b66a'
  ctx.fillRect(-8, 167, 4, 5)
  ctx.fillRect(-1, 167, 4, 5)
  ctx.fillRect(6, 167, 4, 5)
  for (let i = 0; i < 4; i++) {
    const y = 67 + i * 6
    ctx.fillStyle = '#11181a'
    ctx.fillRect(-17 - i * 2, y, 6, 2)
    ctx.fillRect(11, y, 6 + i, 2)
  }
  if (ads < .995) {
    ctx.globalAlpha = 1 - ads
    if (optic === 0) path(ctx, [-17, 98, -15, 79, -10, 76, -7, 92, 8, 92, 11, 77, 16, 79, 18, 99], '#1c2226', '#656c65')
    else {
      path(ctx, [-22, 98, -21, 72, -14, 66, 13, 66, 20, 73, 22, 98, 15, 98, 13, 77, -13, 77, -15, 98], '#192023', '#565e5b')
      circle(ctx, 0, 86, 2, '#ff684e')
    }
    ctx.globalAlpha = 1
  }
  if (flash > 0) {
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = flash * .42
    const glow = ctx.createRadialGradient(0, 31 + muzzle, 2, 0, 31 + muzzle, 65)
    glow.addColorStop(0, '#fff1ad')
    glow.addColorStop(.21, '#ffb659')
    glow.addColorStop(1, '#ff641600')
    circle(ctx, 0, 31 + muzzle, 65, glow)
    ctx.globalAlpha = flash * .75
    path(ctx, [-10, 33 + muzzle, -29, 19 + muzzle, -8, 23 + muzzle, -3, 0 + muzzle, 7, 19 + muzzle,
      27, 9 + muzzle, 14, 32 + muzzle, 6, 39 + muzzle], '#ffc878')
  }
  ctx.restore()
}

export interface SightFrame {
  index: number
  zoom: number
  ads: number
  spread: number
  focal: number
  swayYaw: number
  swayPitch: number
  weapon: number
  flash: number
  reload: number
}

export function drawSight(ctx: CanvasRenderingContext2D, w: number, h: number, sight: SightFrame) {
  const { index, zoom, ads, spread, focal, swayYaw, swayPitch, weapon, flash, reload } = sight
  const x = w / 2
  const y = h / 2
  const dx = Math.tan(swayYaw * rad) * focal
  const dy = -Math.tan(swayPitch * rad) * focal
  drawWeapon(ctx, w, h, ads, dx, dy, weapon, flash, reload, index)

  ctx.save()
  ctx.translate(x, y)
  if (ads < 1) {
    const cross = Math.max(4, Math.tan(spread * rad) * focal * .63)
    ctx.globalAlpha = 1 - ads
    ctx.strokeStyle = '#e9efec'
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(-cross - 6, 0); ctx.lineTo(-cross, 0)
    ctx.moveTo(cross, 0); ctx.lineTo(cross + 6, 0)
    ctx.moveTo(0, -cross - 6); ctx.lineTo(0, -cross)
    ctx.moveTo(0, cross); ctx.lineTo(0, cross + 6)
    ctx.stroke()
    circle(ctx, 0, 0, 1.05, '#f5f8f6')
  }

  if (ads > 0) {
    ctx.globalAlpha = ads * (1 - Math.sin(reload * Math.PI) * .94)
    const radiusScale = index === 5 ? (zoom === 4 ? .214 : .242) : index === 4 ? .228 : .133
    const r = Math.min(w, h) * radiusScale
    ctx.scale(.76 + ads * .24, .76 + ads * .24)
    ctx.lineWidth = 1.1

    if (index >= 4) {
      const vignette = ctx.createRadialGradient(0, 0, r * .83, 0, 0, r * 2.65)
      vignette.addColorStop(0, '#05080c00')
      vignette.addColorStop(.43, '#05080cd9')
      vignette.addColorStop(1, '#05080cf5')
      ctx.fillStyle = vignette
      ctx.fillRect(-w, -h, 2 * w, 2 * h)
      ctx.lineWidth = 13
      circle(ctx, 0, 0, r + 6, '#10171b', true)
      ctx.lineWidth = 2
      circle(ctx, 0, 0, r - 1, '#5a655a', true)
      circle(ctx, 0, 0, r + 13, '#353b3b', true)
      const teeth = 12
      ctx.strokeStyle = '#797c68'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < teeth; i++) {
        const a = i * 2 * Math.PI / teeth
        ctx.moveTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9))
        ctx.lineTo(Math.cos(a) * (r + 13), Math.sin(a) * (r + 13))
      }
      ctx.stroke()
    } else if (index === 2) {
      ctx.lineWidth = 8
      circle(ctx, 0, 0, r, '#1b2125', true)
      ctx.lineWidth = 1.5
      circle(ctx, 0, 0, r + 4, '#59615b', true)
    } else if (index === 1) {
      path(ctx, [-r, r * .88, -r, -r * .72, -r * .77, -r, r * .77, -r, r, -r * .72, r, r * .88,
        r - 7, r * .88, r - 7, -r * .67, r * .68, 7 - r, -r * .68, 7 - r, 7 - r, -r * .67, 7 - r, r * .88],
      '#1e2529', '#686b60')
    } else if (index === 3) {
      path(ctx, [-r, -r * .48, -r * .81, -r * .52, -r * .74, r * .59, -r * .51, r * .78, r * .51, r * .78,
        r * .74, r * .59, r * .81, -r * .52, r, -r * .48, r * .92, r * .69, r * .61, r * .98, -r * .61, r * .98,
        -r * .92, r * .69], '#24292a', '#686b60')
    } else {
      path(ctx, [-r, r * .82, -r * .82, r * .11, -r * .61, r * .11, -r * .49, r * .58, r * .49, r * .58,
        r * .61, r * .11, r * .82, r * .11, r, r * .82, r * .67, r, -r * .67, r], '#272c2c', '#5c6258')
    }

    ctx.translate(dx, dy)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ff6a55'
    ctx.fillStyle = '#ff7662'
    ctx.lineWidth = 1.35
    ctx.shadowColor = '#ff6748'
    ctx.shadowBlur = 5
    if (index <= 2) {
      if (index === 0) ctx.fillRect(-1, -1, 2, r * .6)
      else circle(ctx, 0, 0, 1.65, '#ff735b')
      if (index === 2) circle(ctx, 0, 0, r * .245, '#ff765f', true)
    } else {
      const span = zoom === 4 ? 6 : 4.5
      ctx.beginPath()
      ctx.moveTo(-span, 4); ctx.lineTo(0, 0); ctx.lineTo(span, 4)
      if (index >= 4) {
        ctx.moveTo(0, 8); ctx.lineTo(0, r * .67)
        for (let i = 1; i <= (zoom === 4 ? 6 : 4); i++) {
          const rail = r * (.1 + .073 * i)
          const length = 4 + i * 1.6
          ctx.moveTo(-length, rail); ctx.lineTo(length, rail)
        }
        ctx.moveTo(-r * .32, 0); ctx.lineTo(-span * 2.5, 0)
        ctx.moveTo(span * 2.5, 0); ctx.lineTo(r * .32, 0)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
}
