/**
 * Flags 系统：键值状态存储，全游戏唯一事实来源。
 * 预置键：chapter / isMidnight / brokeRule_<id> / rulesRead[] / endingsUnlocked[]。
 * 运行态存内存，由 SaveSystem 序列化；结局与图鉴另由 GalleryStorage 全局持久化。
 */
import Phaser from 'phaser';

export type FlagValue = boolean | number | string | string[];

export class FlagsSystem {
  readonly events = new Phaser.Events.EventEmitter();
  private data = new Map<string, FlagValue>();

  get<T extends FlagValue>(key: string, fallback: T): T {
    const v = this.data.get(key);
    return (v === undefined ? fallback : v) as T;
  }

  set(key: string, value: FlagValue): void {
    this.data.set(key, value);
    this.events.emit('changed', key, value);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  // ---- 章节与午夜 ----
  get chapter(): string {
    return this.get<string>('chapter', '');
  }
  setChapter(id: string): void {
    this.set('chapter', id);
  }
  get isMidnight(): boolean {
    return this.get<boolean>('isMidnight', false);
  }
  setMidnight(v: boolean): void {
    this.set('isMidnight', v);
  }

  // ---- 违反记录 ----
  markRuleBroken(ruleId: string): void {
    this.set(`brokeRule_${ruleId}`, true);
  }
  isRuleBroken(ruleId: string): boolean {
    return this.get<boolean>(`brokeRule_${ruleId}`, false);
  }

  // ---- 律令图鉴（已读） ----
  rulesRead(): string[] {
    return this.get<string[]>('rulesRead', []);
  }
  markRuleRead(ruleId: string): void {
    const arr = this.rulesRead();
    if (!arr.includes(ruleId)) {
      this.set('rulesRead', [...arr, ruleId]);
    }
  }
  hasReadRule(ruleId: string): boolean {
    return this.rulesRead().includes(ruleId);
  }

  // ---- 结局解锁 ----
  endingsUnlocked(): string[] {
    return this.get<string[]>('endingsUnlocked', []);
  }
  unlockEnding(endingId: string): boolean {
    const arr = this.endingsUnlocked();
    if (arr.includes(endingId)) return false;
    this.set('endingsUnlocked', [...arr, endingId]);
    return true;
  }

  // ---- 序列化（存档用） ----
  serialize(): Record<string, FlagValue> {
    const out: Record<string, FlagValue> = {};
    for (const [k, v] of this.data) out[k] = Array.isArray(v) ? [...v] : v;
    return out;
  }

  restore(obj: Record<string, FlagValue>): void {
    this.data.clear();
    for (const [k, v] of Object.entries(obj)) this.data.set(k, v);
    this.events.emit('restored');
  }

  /** 开始新的一轮翻阅：清空运行态，但保留全局图鉴（由调用方重新播种） */
  resetRun(): void {
    this.data.clear();
    this.events.emit('restored');
  }
}
