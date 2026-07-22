import Phaser from 'phaser';
import { dialog, uiGate } from '../systems/context';

export interface InteractableOpts {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 玩家须在此距离内才可交互（点击太远会先走过去） */
  range?: number;
  prompt?: string;
  /** 是否响应 E 键（默认 true；残月角等"只能点击触碰"的目标设为 false） */
  allowKeyboard?: boolean;
  onInteract: () => void;
}

/**
 * 可交互物：不可见的交互热区 + 可选提示。
 * - E 键：与范围内最近的可交互物交互（场景统一调度）。
 * - 鼠标点击：在范围内 → 直接交互；范围外 → 返回 false 由场景执行点击移动。
 */
export class Interactable {
  readonly id: string;
  readonly zone: Phaser.GameObjects.Zone;
  readonly range: number;
  prompt: string;
  enabled = true;
  readonly allowKeyboard: boolean;
  private clickedAt = 0;

  constructor(private scene: Phaser.Scene, opts: InteractableOpts) {
    this.id = opts.id;
    this.range = opts.range ?? 56;
    this.prompt = opts.prompt ?? '';
    this.allowKeyboard = opts.allowKeyboard ?? true;
    this.zone = scene.add.zone(opts.x, opts.y, opts.w, opts.h).setInteractive({ useHandCursor: true });
    this.zone.setData('interactable', this);
    this.zone.on('pointerdown', () => {
      this.clickedAt = performance.now();
      if (uiGate.blocked || uiGate.justClosed || dialog.active) return;
      if (this.enabled && this.inRangeOf(this.playerX, this.playerY)) {
        opts.onInteract();
      }
      // 范围外的点击不拦截：场景在 pointerdown 里做点击移动（借助 clickedAt 判断是否落在热区）
    });
    this.onInteract = opts.onInteract;
  }

  private onInteract: () => void;
  playerX = 0;
  playerY = 0;

  /** 场景每帧同步玩家位置（供点击距离判定） */
  syncPlayer(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
  }

  inRangeOf(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(x, y, this.zone.x, this.zone.y) <= this.range;
  }

  /** 本次 pointerdown 是否落在此热区上（供场景区分"点物"与"点地"） */
  wasClickedRecently(): boolean {
    return performance.now() - this.clickedAt < 80;
  }

  /** E 键交互 */
  interact(): void {
    if (this.enabled) this.onInteract();
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  destroy(): void {
    this.zone.destroy();
  }
}
