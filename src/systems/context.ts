/**
 * 系统装配：全部系统为模块级单例，由 BootScene 的 wireSystems(game) 挂到 game.events。
 * UI 阻塞计数：经卷弹窗 / 对话 / 暂停菜单 / 图鉴打开时阻塞世界输入与事件计时。
 */
import Phaser from 'phaser';
import { FlagsSystem } from './FlagsSystem';
import { SaveSystem } from './SaveSystem';
import { I18nSystem } from './I18nSystem';
import { AudioSystem } from './AudioSystem';
import { RulesSystem } from './RulesSystem';
import { DialogSystem } from './DialogSystem';
import { EndingsSystem } from './EndingsSystem';

export const flags = new FlagsSystem();
export const saves = new SaveSystem();
export const i18n = new I18nSystem();
export const audio = new AudioSystem(saves);
export const rules = new RulesSystem(flags, saves);
export const dialog = new DialogSystem();
export const endings = new EndingsSystem(flags, saves);

/** UI 阻塞计数：>0 时世界暂停响应移动与计时事件 */
export const uiGate = {
  count: 0,
  /** 上次关闭阻塞的时间戳：防止"UI 关闭的同一帧点击穿透到世界层"（场景输入派发有先后） */
  lastClosedAt: 0,
  open(): void {
    this.count++;
  },
  close(): void {
    this.count = Math.max(0, this.count - 1);
    this.lastClosedAt = performance.now();
  },
  /** 场景切换时强制清零（UIScene 被 stop 时模态析构不走 close，必须显式复位） */
  reset(): void {
    this.count = 0;
  },
  get blocked(): boolean {
    return this.count > 0;
  },
  /** 刚关闭的极短窗口内的点击同样视为 UI 点击（世界层应忽略） */
  get justClosed(): boolean {
    return this.lastClosedAt > 0 && performance.now() - this.lastClosedAt < 150;
  },
};

/** 把需要游戏事件总线的系统接到 game.events 上（Boot 时调用一次） */
export function wireSystems(game: Phaser.Game): void {
  rules.events.on('scroll', (rule: unknown) => game.events.emit('rule:scroll', rule));
  rules.events.on('broken', (rule: unknown) => game.events.emit('rule:broken', rule));
  dialog.events.on('start', () => game.events.emit('dialog:start'));
  dialog.events.on('line', (line: unknown, remaining: number) => game.events.emit('dialog:line', line, remaining));
  dialog.events.on('end', () => game.events.emit('dialog:end'));

  // 首次任意交互解锁 Web Audio
  const unlock = () => audio.ensureInit();
  game.events.on(Phaser.Core.Events.FOCUS, unlock);
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}
