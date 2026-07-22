/**
 * Audio 系统：Web Audio 全程序化占位音频（无音频文件）。
 * BGM：低频氛围 loop（双失谐正弦 + 低通噪声垫 + 缓慢 LFO 呼吸）。
 * SFX：经卷展开 / 违反律令低音 / 脚步声 / UI 确认 / 结局解锁 / 午夜降临。
 * 音量：主音量 + BGM/SFX 分轨，持久化在 SaveSystem 设置里。
 * 替换真实音频的方式见 assets/audio/README.md。
 */
import { SaveSystem } from './SaveSystem';

export type SfxName = 'scroll' | 'break' | 'step' | 'ui' | 'confirm' | 'cancel' | 'unlock' | 'midnight';
export type BgmKind = 'menu' | 'field' | 'ending';

export class AudioSystem {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private bgmBus!: GainNode;
  private sfxBus!: GainNode;
  private bgmNodes: AudioNode[] = [];
  private bgmTimers: number[] = [];
  private currentBgm: BgmKind | null = null;
  private vol = { master: 0.8, bgm: 0.7, sfx: 0.8 };
  private lastStep = 0;

  constructor(private saves: SaveSystem) {
    this.vol = saves.loadSettings();
  }

  /** 浏览器要求用户手势后才能出声；在首次 pointerdown/keydown 时调用 */
  ensureInit(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.connect(this.ac.destination);
    this.bgmBus = this.ac.createGain();
    this.bgmBus.connect(this.master);
    this.sfxBus = this.ac.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    if (this.currentBgm) this.startBgm(this.currentBgm); // 手势前请求的 BGM 补播
  }

  get ready(): boolean {
    return this.ac !== null;
  }

  // ---- 音量 ----
  setVolume(kind: 'master' | 'bgm' | 'sfx', v: number): void {
    this.vol[kind] = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.saves.saveSettings(this.vol);
  }
  getVolume(kind: 'master' | 'bgm' | 'sfx'): number {
    return this.vol[kind];
  }
  private applyVolumes(): void {
    if (!this.ac) return;
    this.master.gain.value = this.vol.master;
    this.bgmBus.gain.value = this.vol.bgm * 0.5;
    this.sfxBus.gain.value = this.vol.sfx;
  }

  // ---- BGM ----
  startBgm(kind: BgmKind): void {
    this.currentBgm = kind;
    if (!this.ac) return; // 等待首次手势
    this.stopBgmNodes();
    const ac = this.ac;

    // 低频氛围 loop：两个失谐低频正弦
    const baseFreq = kind === 'menu' ? 65.4 : kind === 'field' ? 55.0 : 49.0; // C2 / A1 / G1
    const gains = kind === 'ending' ? 0.05 : 0.07;
    for (const detune of [0, 7]) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      osc.detune.value = detune;
      const g = ac.createGain();
      g.gain.value = gains;
      osc.connect(g).connect(this.bgmBus);
      osc.start();
      this.bgmNodes.push(osc, g);
    }
    // 五度泛音，极轻
    const fifth = ac.createOscillator();
    fifth.type = 'triangle';
    fifth.frequency.value = baseFreq * 1.5;
    const fg = ac.createGain();
    fg.gain.value = 0.02;
    fifth.connect(fg).connect(this.bgmBus);
    fifth.start();
    this.bgmNodes.push(fifth, fg);

    // 噪声垫：循环噪声 → 低通 → 慢 LFO 呼吸
    const noise = this.makeNoiseSource();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'field' ? 320 : 220;
    const ng = ac.createGain();
    ng.gain.value = 0.035;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(ng.gain);
    noise.connect(lp).connect(ng).connect(this.bgmBus);
    noise.start();
    lfo.start();
    this.bgmNodes.push(noise, lp, ng, lfo, lfoGain);

    // 封面之野：偶发远处"哽咽"音簇（低音量下行三音）
    if (kind === 'field') {
      const sob = () => {
        if (!this.ac) return;
        const t0 = ac.currentTime;
        [220, 196, 174.6].forEach((f, i) => {
          const o = ac.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t0 + i * 0.28);
          const g = ac.createGain();
          g.gain.setValueAtTime(0, t0 + i * 0.28);
          g.gain.linearRampToValueAtTime(0.018, t0 + i * 0.28 + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.5);
          o.connect(g).connect(this.bgmBus);
          o.start(t0 + i * 0.28);
          o.stop(t0 + i * 0.28 + 0.55);
        });
        this.bgmTimers.push(window.setTimeout(sob, 9000 + Math.random() * 9000));
      };
      this.bgmTimers.push(window.setTimeout(sob, 6000));
    }
  }

  stopBgm(): void {
    this.currentBgm = null;
    this.stopBgmNodes();
  }

  private stopBgmNodes(): void {
    for (const t of this.bgmTimers) window.clearTimeout(t);
    this.bgmTimers = [];
    for (const n of this.bgmNodes) {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) n.stop();
      } catch {
        /* 已停止 */
      }
      n.disconnect();
    }
    this.bgmNodes = [];
  }

  private makeNoiseSource(): AudioBufferSourceNode {
    const ac = this.ac!;
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  // ---- SFX ----
  playSfx(name: SfxName): void {
    if (!this.ac) return;
    if (name === 'step') {
      const now = performance.now();
      if (now - this.lastStep < 180) return; // 脚步声节流
      this.lastStep = now;
    }
    switch (name) {
      case 'scroll':
        this.noiseBurst(0.28, 900, 2600, 0.12); // 经卷展开：纸面摩擦
        this.blip(523, 0.1, 'triangle', 0.05, 0.05);
        break;
      case 'break':
        this.pitchDrop(110, 38, 0.9, 0.3); // 违反律令：低音下坠
        this.noiseBurst(0.5, 80, 300, 0.18);
        break;
      case 'step':
        this.noiseBurst(0.05, 500, 1200, 0.05);
        break;
      case 'ui':
        this.blip(660, 0.06, 'square', 0.035);
        break;
      case 'confirm':
        this.blip(523, 0.08, 'triangle', 0.05);
        this.blip(784, 0.12, 'triangle', 0.05, 0.07);
        break;
      case 'cancel':
        this.blip(392, 0.08, 'triangle', 0.05);
        this.blip(261, 0.12, 'triangle', 0.05, 0.07);
        break;
      case 'unlock':
        [392, 523, 659, 784].forEach((f, i) => this.blip(f, 0.16, 'triangle', 0.05, i * 0.09));
        break;
      case 'midnight':
        this.pitchDrop(220, 55, 2.2, 0.12);
        this.noiseBurst(1.6, 100, 500, 0.06);
        break;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    const ac = this.ac!;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private pitchDrop(from: number, to: number, dur: number, gain: number): void {
    const ac = this.ac!;
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, fLow: number, fHigh: number, gain: number): void {
    const ac = this.ac!;
    const t0 = ac.currentTime;
    const src = this.makeNoiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fHigh, t0);
    bp.frequency.exponentialRampToValueAtTime(fLow, t0 + dur);
    bp.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }
}
