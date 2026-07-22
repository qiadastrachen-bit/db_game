import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { audio, i18n, flags } from '../systems/context';
import prologueData from '../data/prologue.zh.json';
import { domUI, UI_COLORS, type TypewriterHandle } from '../ui/dom';

interface PrologueScreen {
  text: string;
  banner?: string;
  confirm?: string;
}

/**
 * 序章 · 塑界之书：逐屏打字机展示创作者原文。
 * 纸页底/外框/横幅留在 Phaser 画布；文字、进度、提示、「翻开」契约按钮走 DOM。
 * E / 点击 / 空格 翻页；Esc 跳过序章。最后一屏出现「翻 开」按钮。
 */
export class PrologueScene extends Phaser.Scene {
  private screens = (prologueData as unknown as { screens: PrologueScreen[] }).screens;
  private page = 0;
  private textEl: HTMLDivElement | null = null;
  private hintEl: HTMLDivElement | null = null;
  private progressEl: HTMLDivElement | null = null;
  private bannerObj: Phaser.GameObjects.Image | null = null;
  private typewriter: TypewriterHandle | null = null;
  private fullText = '';
  private confirmShown = false;

  constructor() {
    super('PrologueScene');
  }

  create(): void {
    flags.setChapter('prologue');
    audio.startBgm('menu');

    // 画布层：墨域底色 + 纸页 + 外框
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0e0a14);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 48, GAME_HEIGHT - 40, 0x16101f);
    const frame = this.add.graphics();
    frame.lineStyle(1, 0x3d2f4a);
    frame.strokeRect(24, 20, GAME_WIDTH - 48, GAME_HEIGHT - 40);
    frame.lineStyle(1, 0xd4b86a, 0.5);
    frame.strokeRect(28, 24, GAME_WIDTH - 56, GAME_HEIGHT - 48);

    // DOM 层：叙事文本 + 提示 + 进度
    const L = domUI.scene;
    domUI.clearScene();
    this.textEl = domUI.text(L, GAME_WIDTH / 2, 58, '', {
      size: 12,
      color: UI_COLORS.pale,
      align: 'center',
      width: GAME_WIDTH - 120,
      lineHeight: 1.8,
    });
    this.hintEl = domUI.text(L, GAME_WIDTH - 40, GAME_HEIGHT - 32, i18n.t('prologue.next'), {
      size: 8,
      color: UI_COLORS.dim,
      align: 'right',
    });
    domUI.text(L, 40, GAME_HEIGHT - 32, i18n.t('prologue.skip'), { size: 8, color: UI_COLORS.violet });
    this.progressEl = domUI.text(L, GAME_WIDTH / 2, GAME_HEIGHT - 32, '', {
      size: 8,
      color: UI_COLORS.violet,
      align: 'center',
    });

    // 点击任意处翻页（DOM 透明遮罩，避免穿透到画布）
    domUI.veil(L, { clear: true, onClick: () => this.advance() });

    this.input.keyboard!.on('keydown-E', () => this.advance());
    this.input.keyboard!.on('keydown-SPACE', () => this.advance());
    this.input.keyboard!.on('keydown-ENTER', () => this.advance());
    this.input.keyboard!.on('keydown-ESC', () => this.finish());

    this.cameras.main.fadeIn(600, 8, 6, 16);
    this.showPage(0);
  }

  private showPage(idx: number): void {
    this.page = idx;
    const s = this.screens[idx];
    this.confirmShown = false;
    this.progressEl?.replaceChildren();
    if (this.progressEl) {
      this.progressEl.textContent = i18n.t('prologue.progress', { a: idx + 1, b: this.screens.length });
    }

    // 背景横幅（可选，极淡，画布层）
    if (this.bannerObj) {
      this.tweens.add({ targets: this.bannerObj, alpha: 0, duration: 300, onComplete: () => this.bannerObj?.destroy() });
      this.bannerObj = null;
    }
    if (s.banner) {
      this.bannerObj = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, `banner-${s.banner}`)
        .setScale(0.32)
        .setAlpha(0)
        .setDepth(-1);
      this.tweens.add({ targets: this.bannerObj, alpha: 0.16, duration: 600 });
    }

    // DOM 打字机
    this.fullText = s.text;
    this.typewriter?.cancel();
    if (this.textEl) {
      this.typewriter = domUI.typewriter(this.textEl, this.fullText, {
        cps: 24,
        onTick: () => audio.playSfx('step'), // 轻微纸面沙声
        onDone: () => this.onTypeDone(s),
      });
    }
  }

  private onTypeDone(s: PrologueScreen): void {
    if (s.confirm) this.showConfirm(s.confirm);
  }

  /** 最后一屏：绘本末页的「翻开」按钮 = 存在性契约（DOM 按钮） */
  private showConfirm(label: string): void {
    if (this.confirmShown) return;
    this.confirmShown = true;
    const b = domUI.button(domUI.scene, GAME_WIDTH / 2, GAME_HEIGHT - 66, 140, label, () => {
      audio.playSfx('scroll');
      this.finish();
    }, { height: 32, fontSize: 16, gold: true });
    b.style.letterSpacing = '6px';
    b.style.opacity = '0';
    b.style.transition = 'opacity .5s';
    requestAnimationFrame(() => (b.style.opacity = '1'));
  }

  private advance(): void {
    if (this.typewriter && !this.typewriter.done) {
      // 第一次点击：补全当前页
      this.typewriter.skip();
      return;
    }
    if (this.page >= this.screens.length - 1) return; // 最后一页只能点「翻开」
    audio.playSfx('ui');
    this.showPage(this.page + 1);
  }

  private finish(): void {
    this.typewriter?.cancel();
    this.input.keyboard!.removeAllListeners();
    this.cameras.main.fadeOut(700, 8, 6, 16);
    this.time.delayedCall(720, () => {
      domUI.clearScene();
      this.scene.start('CoverFieldScene');
    });
  }
}
