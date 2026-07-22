/**
 * Dialog 系统：中等叙事文本框的队列与状态管理；渲染在 UIScene（打字机效果）。
 * 文本全部来自 src/data/dialogs.zh.json 等 JSON，场景只引用键名。
 */
import Phaser from 'phaser';
import dialogsData from '../data/dialogs.zh.json';

export interface DialogLine {
  speaker: string;
  text: string;
}

type DialogBook = Record<string, DialogLine[]>;

export class DialogSystem {
  readonly events = new Phaser.Events.EventEmitter();
  private book = dialogsData as unknown as DialogBook;
  private queue: DialogLine[] = [];
  private pending: { key: string; onDone?: () => void }[] = [];
  private onDone: (() => void) | null = null;
  active = false;

  /** 取某段对话的副本（不播放） */
  lines(key: string): DialogLine[] {
    return (this.book[key] ?? []).map((l) => ({ ...l }));
  }

  /** 播放一段对话；已有对话进行中则排队，禁止重入覆盖 */
  start(key: string, onDone?: () => void): void {
    if (this.active) {
      this.pending.push({ key, onDone });
      return;
    }
    this.begin(key, onDone);
  }

  /** 场景离场时强制清空（防止 active 残留导致世界点击永久失效） */
  reset(): void {
    this.queue = [];
    this.pending = [];
    this.onDone = null;
    this.active = false;
  }

  /** 推进一行；返回 false 表示对话已结束 */
  next(): boolean {
    if (!this.active) return false;
    this.queue.shift();
    if (this.queue.length === 0) {
      this.active = false;
      this.events.emit('end');
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
      this.flushPending();
      return false;
    }
    this.emitCurrent();
    return true;
  }

  /** 跳过当前整段；排队中的下一段仍会接着播放 */
  skip(): void {
    if (!this.active) return;
    this.queue = [];
    this.active = false;
    this.events.emit('end');
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
    this.flushPending();
  }

  private begin(key: string, onDone?: () => void): void {
    const lines = this.lines(key);
    if (lines.length === 0) {
      onDone?.();
      this.flushPending();
      return;
    }
    this.queue = lines;
    this.onDone = onDone ?? null;
    this.active = true;
    this.events.emit('start');
    this.emitCurrent();
  }

  private flushPending(): void {
    const next = this.pending.shift();
    if (next) this.begin(next.key, next.onDone);
  }

  private emitCurrent(): void {
    this.events.emit('line', this.queue[0], this.queue.length);
  }
}
