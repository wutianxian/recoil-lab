import type { Weapon } from '../data/weapons.ts'
import { optics } from '../engine/optics.ts'
import type { Mode } from '../modes/arena.ts'

export interface Settings {
  mode: Mode
  weapon: number
  optic: number
  distance: number
  dpi: number
  sensitivity: number
  fov: number
  multipliers: number[]
  adsMode: 'hold' | 'toggle'
  threshold: number
  smoothing: boolean
  relativeTracking: boolean
  recovery: boolean
  guide: boolean
  volume: number
  turbo: boolean
  difficulty: number
  armor: number
}

export interface ChartPoint {
  yaw: number
  pitch: number
}

export interface HudState {
  locked: boolean
  ads: number
  zoom: number
  ammo: number
  magazine: number
  yawRate: number
  targetYawRate: number
  trackingRate: number
  trackingActive: boolean
  smoothing: number
  smoothingActive: boolean
  beat: 'left' | 'right' | null
  beatProgress: number
  damage: number
  status: string
  lookingAtDistance: number
  shotCoverage: number
  hits: number
  shots: number
  headRate: number
  accuracy: number
  ttk: number | null
  oneClip: number | null
  smoothingTime: number
  spread: number | null
  notice: string
  baseline: readonly ChartPoint[]
  controlled: readonly ChartPoint[]
}

const modes: readonly Mode[] = ['recoil', 'strafe', 'tracking', 'free']
const modeInfo: Record<Mode, { title: string; tag: string; description: string }> = {
  recoil: { title: '站定压枪', tag: 'RECOIL', description: '保持站定，观察弹道并练习反向压枪。' },
  strafe: { title: '横移降后坐', tag: 'STRAFE', description: '跟随节拍横移，转动视角并持续瞄住目标。' },
  tracking: { title: '移动靶跟枪', tag: 'TRACKING', description: '跟随移动靶保持准星稳定。' },
  free: { title: '自由练习', tag: 'FREE RANGE', description: '混合练习压枪、横移与移动靶跟踪。' },
}

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`
const signedRate = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero', useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 1,
}).format
const text = (element: HTMLElement, value: string) => {
  if (element.textContent !== value) element.textContent = value
}
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const constrain = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function fillOptions(select: HTMLSelectElement, names: readonly string[]) {
  for (const [index, name] of names.entries()) select.add(new Option(name, String(index)))
}

const hudIds = [
  'yaw-rate', 'target-yaw-rate', 'smoothing-status', 'smoothing-value', 'weapon-hud', 'optic-hud', 'ammo',
  'magazine', 'damage', 'target-context', 'beat-direction', 'accuracy', 'head-rate', 'hits',
  'ttk', 'one-clip', 'smoothing-time', 'spread', 'coverage', 'range-status',
] as const

export class Panel {
  readonly canvas = byId<HTMLCanvasElement>('game')
  readonly settings: Settings
  private readonly controls = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')
  private readonly multiplierFields = document.querySelectorAll<HTMLInputElement>('[data-multiplier]')
  private readonly modeButtons = document.querySelectorAll<HTMLButtonElement>('[data-mode-slot]')
  private readonly groups = document.querySelectorAll<HTMLButtonElement>('[data-group] button')
  private readonly hud = Object.fromEntries(hudIds.map(id => [id, byId(id)])) as Record<typeof hudIds[number], HTMLElement>
  private readonly range = byId('range')
  private readonly launch = byId('launch')
  private readonly beat = byId('beat-hud')
  private readonly beatMeter = byId('beat-meter')
  private readonly motion = document.querySelector<HTMLElement>('.motion-hud')!
  private readonly yawMeter = byId('yaw-meter')
  private readonly ammo = document.querySelector<HTMLElement>('.ammo')!
  private readonly actionStatus = byId('action-status')
  private readonly notice = byId('notice')
  private readonly chart = byId<HTMLCanvasElement>('recoil-chart')
  private readonly chartEmpty = byId('chart-empty')
  private readonly chartCtx = this.chart.getContext('2d')!
  private baseline: readonly ChartPoint[] = []
  private controlled: readonly ChartPoint[] = []
  private controlCount = -1

  constructor(
    private readonly weapons: readonly Weapon[],
    private readonly opticNames: readonly string[],
    private readonly onChange: (settings: Settings, key: keyof Settings) => void,
    onEnter: () => void,
    onReset: () => void,
  ) {
    this.settings = {
      mode: 'recoil', weapon: Math.max(0, weapons.findIndex(weapon => weapon.id === 'r301')),
      optic: 1, distance: 30, dpi: 800, sensitivity: 1.5, fov: 106, multipliers: [1, 1, 1, 1],
      adsMode: 'hold', threshold: 3.75, smoothing: true, relativeTracking: true, recovery: true, guide: true,
      volume: .55, turbo: false, difficulty: 2, armor: 125,
    }

    fillOptions(byId<HTMLSelectElement>('weapon'), weapons.map(weapon => weapon.name))
    fillOptions(byId<HTMLSelectElement>('optic'), opticNames)
    for (const button of this.modeButtons) {
      button.addEventListener('click', () => this.set('mode', modes[Number(button.dataset.modeSlot)]))
    }
    for (const button of this.groups) {
      const key = button.parentElement!.dataset.group as 'armor' | 'distance' | 'difficulty'
      button.addEventListener('click', () => this.set(key, Number(button.dataset.value)))
    }
    for (const field of this.controls) {
      const key = field.dataset.setting as Exclude<keyof Settings, 'mode' | 'multipliers'>
      if (key === 'dpi' && field instanceof HTMLInputElement) {
        field.addEventListener('input', () => {
          if (Number.isFinite(field.valueAsNumber) && field.validity.valid) this.set('dpi', field.valueAsNumber)
        })
      }
      field.addEventListener(field.type === 'range' ? 'input' : 'change', () => {
        if (key === 'adsMode') {
          this.set(key, field.value === 'toggle' ? 'toggle' : 'hold')
        } else if (field instanceof HTMLInputElement && field.type === 'checkbox') {
          this.set(key as 'smoothing' | 'relativeTracking' | 'guide' | 'recovery' | 'turbo', field.checked)
        } else {
          const input = Number(field.value)
          const value = field instanceof HTMLInputElement && field.value
            ? constrain(input, Number(field.min), Number(field.max)) : input
          this.set(key, field.value && Number.isFinite(value) ? value : Number(this.settings[key]))
        }
      })
    }
    for (const field of this.multiplierFields) {
      const updateMultiplier = () => {
        const index = Number(field.dataset.multiplier)
        const multipliers = this.settings.multipliers.slice()
        if (field.value !== '' && Number.isFinite(field.valueAsNumber)) {
          multipliers[index] = constrain(field.valueAsNumber, Number(field.min), Number(field.max))
        }
        this.set('multipliers', multipliers)
      }
      field.addEventListener('change', updateMultiplier)
      field.addEventListener('input', () => {
        if (Number.isFinite(field.valueAsNumber) && field.validity.valid) updateMultiplier()
      })
    }
    byId('enter').addEventListener('click', onEnter)
    byId('reset').addEventListener('click', onReset)
    this.syncControls()
    new ResizeObserver(() => this.drawChart()).observe(this.chart)
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    const previous = this.settings[key]
    this.settings[key] = value
    this.syncControls()
    if (previous !== value) this.onChange(this.settings, key)
  }

  private syncControls() {
    const settings = this.settings
    for (const button of this.modeButtons) {
      button.setAttribute('aria-pressed', String(modes[Number(button.dataset.modeSlot)] === settings.mode))
    }
    for (const button of this.groups) {
      const key = button.parentElement!.dataset.group as 'armor' | 'distance' | 'difficulty'
      button.setAttribute('aria-pressed', String(settings[key] === Number(button.dataset.value)))
    }
    for (const field of this.controls) {
      const key = field.dataset.setting as keyof Settings
      const value = settings[key]
      if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = Boolean(value)
      else field.value = String(value)
      if (field instanceof HTMLInputElement && field.type === 'range') {
        field.style.setProperty('--fill', percent((Number(value) - Number(field.min)) / (Number(field.max) - Number(field.min))))
      }
    }
    for (const field of this.multiplierFields) field.value = String(settings.multipliers[Number(field.dataset.multiplier)])
    const mode = modeInfo[settings.mode]
    text(byId('mode-title'), mode.title)
    text(byId('mode-tag'), mode.tag)
    text(byId('mode-description'), mode.description)
    text(byId('range-tag'), `${settings.distance} M`)
    const values = {
      fov: `${settings.fov}°`,
      sensitivity: settings.sensitivity.toFixed(2),
      threshold: `${settings.threshold.toFixed(2)}°/s`,
      volume: percent(settings.volume),
    }
    for (const output of document.querySelectorAll<HTMLElement>('[data-output]')) {
      const value = values[output.dataset.output as keyof typeof values]
      text(output, value)
    }
    const weapon = this.weapons[settings.weapon]
    text(this.hud['weapon-hud'], weapon.name)
    text(byId('weapon-rpm'), String(weapon.rpm))
    text(byId('weapon-body'), String(weapon.body))
    text(byId('weapon-head'), String(weapon.head))
    byId('turbo-row').hidden = weapon.charge === undefined
    byId('difficulty-row').hidden = settings.mode !== 'tracking' && settings.mode !== 'free'
    const variableOptic = this.opticNames[settings.optic].includes('Variable')
    byId('zoom-shortcut').hidden = !variableOptic
    byId('cm360-alt').hidden = !variableOptic
    text(byId('cm360-ads-label'), variableOptic ? '开镜 2×' : '开镜')
    const hip = 360 * 2.54 / (settings.dpi * settings.sensitivity * .022)
    const ads = (zoom: number) => (hip * zoom / settings.multipliers[zoom < 2 ? 0 : zoom - 1]).toFixed(1)
    text(byId('cm360-hip'), hip.toFixed(1))
    text(byId('cm360-ads'), ads(optics[settings.optic].zoom))
    if (variableOptic) text(byId('cm360-4x'), ads(4))
  }

  update(state: HudState): void {
    if (this.range.classList.contains('is-locked') !== state.locked) {
      const slot = this.range.parentElement!
      if (state.locked) slot.style.minHeight = `${this.range.offsetHeight}px`
      this.range.classList.toggle('is-locked', state.locked)
      if (!state.locked) slot.style.removeProperty('min-height')
    }
    this.launch.hidden = state.locked
    this.actionStatus.hidden = !state.locked || !['换弹中', '蓄力中', '按 R 换弹'].includes(state.status)
    if (!this.actionStatus.hidden) text(this.actionStatus, state.status)
    this.motion.classList.toggle('is-active', state.smoothingActive)
    this.motion.classList.toggle('is-tracking', state.trackingActive)
    this.ammo.classList.toggle('is-low', state.ammo <= Math.max(3, state.magazine * .15))
    const rate = Math.abs(state.yawRate)
    const maxRate = Math.max(10, this.settings.threshold * 2)
    this.yawMeter.style.setProperty('--meter', String(constrain(rate / maxRate, 0, 1)))
    this.yawMeter.style.setProperty('--threshold', String(this.settings.threshold / maxRate))
    this.beat.hidden = !state.beat || !state.locked
    if (state.beat) {
      text(this.hud['beat-direction'], state.beat === 'left' ? '← 向左' : '向右 →')
      this.beatMeter.style.setProperty('--meter', String(constrain(state.beatProgress, 0, 1)))
    }

    const optic = this.opticNames[this.settings.optic]
    const opticHud = optic.includes('Variable')
      ? state.ads > .95 ? `${Math.round(state.zoom)}× AOG` : '2–4× AOG'
      : optic.replace(/ (经典红点|全息)$/, '').replace('x', '×')
    const values = {
      'yaw-rate': rate.toFixed(rate < 100 ? 1 : 0),
      'target-yaw-rate': signedRate(state.targetYawRate),
      'smoothing-status': state.trackingActive ? `跟枪补偿 ${signedRate(state.trackingRate)}°/s`
        : this.settings.smoothing ? state.smoothingActive ? '已触发' : '等待触发' : '已关闭',
      'smoothing-value': percent(state.smoothing),
      'optic-hud': opticHud,
      ammo: String(state.ammo).padStart(2, '0'),
      magazine: `/ ${state.magazine}`,
      damage: String(Math.round(state.damage)),
      'target-context': `${state.lookingAtDistance.toFixed(0)} M`,
      accuracy: state.shots ? percent(state.accuracy) : '—',
      'head-rate': state.hits ? percent(state.headRate) : '—',
      hits: `${state.hits} / ${state.shots} 发`,
      ttk: state.ttk === null ? '—' : state.ttk.toFixed(2),
      'one-clip': state.oneClip === null ? '—' : percent(state.oneClip),
      'smoothing-time': state.shots ? percent(state.smoothingTime) : '—',
      spread: state.spread === null ? '—' : state.spread.toFixed(1),
      coverage: state.shots ? percent(state.shotCoverage) : '—',
      'range-status': state.locked ? state.status : '待命',
    }
    for (const id of Object.keys(values) as (keyof typeof values)[]) text(this.hud[id], values[id])
    byId('ttk-unit').hidden = state.ttk === null
    byId('spread-unit').hidden = state.spread === null
    this.notice.hidden = !state.notice
    if (state.notice) text(this.notice, state.notice)
    if (state.baseline !== this.baseline || state.controlled !== this.controlled || state.controlled.length !== this.controlCount) {
      this.baseline = state.baseline
      this.controlled = state.controlled
      this.controlCount = state.controlled.length
      this.chartEmpty.hidden = this.controlCount > 0
      this.drawChart()
    }
  }

  private drawChart() {
    const { chart, chartCtx: ctx } = this
    const width = chart.clientWidth
    const height = chart.clientHeight
    if (!width || !height) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const pixelsX = Math.round(width * dpr)
    const pixelsY = Math.round(height * dpr)
    if (chart.width !== pixelsX) chart.width = pixelsX
    if (chart.height !== pixelsY) chart.height = pixelsY
    ctx.setTransform(pixelsX / width, 0, 0, pixelsY / height, 0, 0)
    ctx.clearRect(0, 0, width, height)

    let yawLimit = 2
    let pitchLow = -1
    let pitchHigh = 3
    for (const { yaw, pitch } of [...this.baseline, ...this.controlled]) {
      yawLimit = Math.max(yawLimit, Math.ceil(Math.abs(yaw)))
      pitchLow = Math.min(pitchLow, Math.floor(pitch))
      pitchHigh = Math.max(pitchHigh, Math.ceil(pitch))
    }
    const left = 50
    const right = width - 32
    const top = 24
    const bottom = height - 35
    const x = (yaw: number) => left + (yaw / yawLimit + 1) / 2 * (right - left)
    const y = (pitch: number) => bottom - (pitch - pitchLow) / (pitchHigh - pitchLow) * (bottom - top)
    const columns = width < 520 ? 4 : 10
    ctx.font = '10px ui-monospace, monospace'
    ctx.lineWidth = 1
    ctx.fillStyle = '#a0abb6'
    for (let i = 0; i <= columns; i++) {
      const yaw = (2 * i / columns - 1) * yawLimit
      const tick = x(yaw)
      ctx.strokeStyle = i === columns / 2 ? '#485564' : '#2a333d'
      ctx.beginPath()
      ctx.moveTo(tick, top)
      ctx.lineTo(tick, bottom)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillText(`${Number(yaw.toFixed(1))}°`, tick, bottom + 13)
    }
    for (let i = 0; i <= 4; i++) {
      const pitch = pitchLow + i / 4 * (pitchHigh - pitchLow)
      const tick = y(pitch)
      ctx.strokeStyle = '#2a333d'
      ctx.beginPath()
      ctx.moveTo(left, tick)
      ctx.lineTo(right, tick)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(`${Number(pitch.toFixed(1))}°`, left - 8, tick + 3)
    }
    ctx.strokeStyle = '#485564'
    ctx.beginPath()
    ctx.moveTo(left, y(0))
    ctx.lineTo(right, y(0))
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillText('俯仰', 10, 15)
    ctx.textAlign = 'right'
    ctx.fillText('偏航', right, height - 6)

    const plot = (points: readonly ChartPoint[], color: string, dashed: boolean) => {
      if (!points.length) return
      ctx.strokeStyle = ctx.fillStyle = color
      ctx.lineWidth = dashed ? 1.2 : 2
      ctx.lineJoin = ctx.lineCap = 'round'
      ctx.setLineDash(dashed ? [4, 3] : [])
      ctx.beginPath()
      ctx.moveTo(x(points[0].yaw), y(points[0].pitch))
      for (const point of points.slice(1)) ctx.lineTo(x(point.yaw), y(point.pitch))
      ctx.stroke()
      ctx.setLineDash([])
      for (const point of points) {
        ctx.beginPath()
        ctx.arc(x(point.yaw), y(point.pitch), dashed ? 1.3 : 2.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    plot(this.baseline, '#a0adbc', true)
    plot(this.controlled, '#ff6a4a', false)
  }
}
