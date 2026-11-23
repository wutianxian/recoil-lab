import type { ChartPoint } from './panel.ts'

const radians = Math.PI / 180

export function drawRecoilGuide(
  ctx: CanvasRenderingContext2D, width: number, height: number, focal: number,
  path: readonly ChartPoint[], progress: number,
) {
  const maxYaw = Math.max(1, ...path.map(point => Math.abs(point.yaw)))
  const maxPitch = Math.max(1, ...path.map(point => Math.abs(point.pitch)))
  const scale = Math.min(focal * radians, width * .44 / maxYaw, height * .35 / maxPitch)
  const startY = height / 2 + Math.max(15, height * .025)
  const points = path.map(point => ({
    x: width / 2 - point.yaw * scale,
    y: startY + point.pitch * scale,
  }))
  const position = Math.min(points.length - 1, Math.max(0, progress))
  const index = Math.floor(position)
  const start = points[index]
  const end = points[Math.min(index + 1, points.length - 1)]
  const cursorX = start.x + (end.x - start.x) * (position - index)
  const cursorY = start.y + (end.y - start.y) * (position - index)

  ctx.save()
  ctx.lineJoin = ctx.lineCap = 'round'
  ctx.shadowColor = '#10171a'
  ctx.shadowBlur = 4
  ctx.strokeStyle = '#67ddd6'
  ctx.globalAlpha = .68
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.strokeStyle = '#a0f4ed'
  ctx.lineWidth = 2.3
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i <= index; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.lineTo(cursorX, cursorY)
  ctx.stroke()

  ctx.fillStyle = '#9de8e2'
  for (let i = 0; i < points.length; i += 4) {
    ctx.beginPath()
    ctx.arc(points[i].x, points[i].y, 2, 0, 2 * Math.PI)
    ctx.fill()
  }
  ctx.shadowColor = '#67ddd6'
  ctx.fillStyle = '#d6fffb'
  ctx.beginPath()
  ctx.arc(cursorX, cursorY, 4, 0, 2 * Math.PI)
  ctx.fill()
  ctx.restore()
}
