const shotProfiles = [
  { cut: 1420, body: 158, peak: .78, tail: .115, type: 'triangle', energy: 0 },
  { cut: 940, body: 113, peak: .93, tail: .17, type: 'triangle', energy: 0 },
  { cut: 2430, body: 213, peak: .66, tail: .082, type: 'triangle', energy: 0 },
  { cut: 3200, body: 565, peak: .56, tail: .1, type: 'sine', energy: .16 },
  { cut: 1900, body: 388, peak: .84, tail: .14, type: 'sawtooth', energy: .16 },
  { cut: 3100, body: 735, peak: .63, tail: .084, type: 'triangle', energy: .22 },
  { cut: 1210, body: 132, peak: .90, tail: .135, type: 'triangle', energy: 0 },
  { cut: 2680, body: 182, peak: .73, tail: .072, type: 'triangle', energy: 0 },
  { cut: 1580, body: 283, peak: .76, tail: .113, type: 'sawtooth', energy: .19 },
] as const

export class RangeAudio {
  private context?: AudioContext
  private master?: GainNode
  private noise?: AudioBuffer
  private charge?: OscillatorNode
  private level = .55

  unlock() {
    try {
      if (!this.context) {
        const context = new AudioContext()
        this.context = context
        this.master = context.createGain()
        this.master.gain.value = this.level * .34
        const limit = context.createDynamicsCompressor()
        limit.threshold.value = -15
        this.master.connect(limit).connect(context.destination)
        this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .32), context.sampleRate)
        const samples = this.noise.getChannelData(0)
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
      }
      void this.context.resume().catch(() => { /* Another gesture can resume audio. */ })
    } catch {
      // The training loop stays usable if Web Audio is unavailable.
    }
  }

  set volume(value: number) {
    this.level = Math.max(0, Math.min(1, value))
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.level * .34, this.context.currentTime, .018)
  }

  private burst(cutoff: number, gain: number, duration: number, delay = 0) {
    const ac = this.context
    if (!ac || !this.master || !this.noise || this.level <= 0 || ac.state !== 'running') return
    const src = ac.createBufferSource()
    src.buffer = this.noise
    const low = ac.createBiquadFilter()
    low.frequency.value = cutoff
    low.Q.value = .8
    const envelope = ac.createGain()
    const t = ac.currentTime + delay
    envelope.gain.setValueAtTime(gain, t)
    envelope.gain.exponentialRampToValueAtTime(.001, t + duration)
    src.connect(low).connect(envelope).connect(this.master)
    src.start(t, Math.random() * .09)
    src.stop(t + duration)
  }

  private tone(from: number, to: number, gain: number, duration: number,
    type: OscillatorType = 'sine', delay = 0) {
    const ac = this.context
    if (!ac || !this.master || this.level <= 0 || ac.state !== 'running') return
    const osc = ac.createOscillator()
    const envelope = ac.createGain()
    const t = ac.currentTime + delay
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + duration)
    envelope.gain.setValueAtTime(.001, t)
    envelope.gain.exponentialRampToValueAtTime(gain, t + .004)
    envelope.gain.exponentialRampToValueAtTime(.001, t + duration)
    osc.connect(envelope).connect(this.master)
    osc.start(t)
    osc.stop(t + duration)
    return osc
  }

  fire(weapon: number) {
    const profile = shotProfiles[weapon]
    if (!profile) return
    const { cut, body, peak, tail, type, energy } = profile
    this.stopCharge()
    this.burst(cut, peak, tail)
    this.burst(cut * 2.9, peak * .26, .025)
    this.tone(body, body * .32, peak * .58, tail, type)
    if (energy > 0) this.tone(body * 2.1, body * .7, energy, tail * .86)
  }

  startCharge() {
    this.stopCharge()
    const tone = this.tone(115, 960, .26, .46, 'triangle')
    this.charge = tone
    if (tone) tone.onended = () => { if (this.charge === tone) this.charge = undefined }
  }

  stopCharge() {
    this.charge?.stop()
    this.charge = undefined
  }

  hit(shield: boolean, head: boolean, broken: boolean) {
    if (broken) {
      this.burst(4900, .47, .14)
      this.tone(2350, 520, .25, .135, 'triangle')
      this.tone(1380, 285, .13, .16, 'sine', .025)
    } else if (shield) {
      this.tone(head ? 1650 : 1170, 560, .27, .075, 'sine')
      this.burst(3100, .17, .045)
    } else {
      this.tone(head ? 670 : 190, 95, .3, .057, 'triangle')
      this.burst(560, .22, .08)
    }
  }

  reload(duration: number) {
    this.burst(2450, .31, .075)
    this.tone(520, 135, .22, .072, 'triangle')
    this.burst(3060, .37, .076, duration * .52)
    this.tone(760, 230, .22, .067, 'triangle', duration * .78)
  }

  ready() { this.burst(4100, .25, .05) }
  empty() { this.tone(500, 125, .26, .042, 'triangle') }
  clear() {
    this.stopCharge()
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {})
  }
}
