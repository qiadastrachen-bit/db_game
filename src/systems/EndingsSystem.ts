/**
 * Endings 系统：结局目录来自 src/data/endings.zh.json；
 * 解锁记录写入 flags（随存档）+ 全局图鉴（跨存档，供结局画廊）。
 */
import Phaser from 'phaser';
import endingsData from '../data/endings.zh.json';
import type { FlagsSystem } from './FlagsSystem';
import type { SaveSystem } from './SaveSystem';

export interface Ending {
  id: string;
  title: string;
  realm: string;
  type: 'bad' | 'pass';
  banner: string;
  fadeMessage: string;
  description: string;
  hint: string;
}

export class EndingsSystem {
  readonly events = new Phaser.Events.EventEmitter();
  private endings: Ending[] = (endingsData as unknown as { endings: Ending[] }).endings;

  constructor(
    private flags: FlagsSystem,
    private saves: SaveSystem,
  ) {}

  all(): Ending[] {
    return this.endings;
  }

  get(id: string): Ending | undefined {
    return this.endings.find((e) => e.id === id);
  }

  isUnlocked(id: string): boolean {
    return this.flags.endingsUnlocked().includes(id);
  }

  /** 解锁并全局持久化；返回是否首次解锁 */
  unlock(id: string): boolean {
    const first = this.flags.unlockEnding(id);
    const g = this.saves.loadGallery();
    if (!g.endingsUnlocked.includes(id)) {
      g.endingsUnlocked.push(id);
      this.saves.saveGallery(g);
    }
    if (first) this.events.emit('unlocked', id);
    return first;
  }

  /**
   * 从全局图鉴恢复已解锁结局（开始新游戏/读档时调用）。
   * 律令已读只信本档 flags，不把跨档图鉴知识写入当前局——避免早期存档瞬间按「已阅」结算致死。
   */
  seedFromGallery(): void {
    const g = this.saves.loadGallery();
    for (const id of g.endingsUnlocked) this.flags.unlockEnding(id);
  }
}
