import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { audio, i18n } from '../systems/context';
import { domUI, UI_COLORS } from '../ui/dom';

/**
 * Staff：制作名单页骨架（第一期）。
 * 背景/噪点在画布；全部文字与按钮走 DOM。
 */
export class StaffScene extends Phaser.Scene {
  constructor() {
    super('StaffScene');
  }

  create(): void {
    audio.startBgm('menu');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0e0a14);
    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'noise')
      .setAlpha(0.06);

    const L = domUI.scene;
    domUI.clearScene();

    domUI.text(L, GAME_WIDTH / 2, 40, i18n.t('staff.title'), {
      size: 18,
      color: UI_COLORS.glow,
      align: 'center',
      letterSpacing: 6,
    });
    const rule = document.createElement('div');
    rule.style.cssText = `position:absolute;left:${GAME_WIDTH / 2 - 70}px;top:64px;width:140px;height:1px;background:${UI_COLORS.gold};`;
    L.appendChild(rule);

    const lines: [string, string][] = [
      [i18n.t('staff.role_author'), i18n.t('staff.author')],
      [i18n.t('staff.role_dev'), i18n.t('staff.dev')],
      ['', i18n.t('staff.engine')],
    ];
    lines.forEach(([role, name], i) => {
      const y = 86 + i * 36;
      if (role) {
        domUI.text(L, GAME_WIDTH / 2, y, role, { size: 9, color: UI_COLORS.dim, align: 'center' });
      }
      domUI.text(L, GAME_WIDTH / 2, y + 14, name, { size: 11, color: UI_COLORS.pale, align: 'center' });
    });

    domUI.text(L, GAME_WIDTH / 2, 208, i18n.t('staff.thanks'), { size: 9, color: UI_COLORS.gold, align: 'center' });
    domUI.button(L, GAME_WIDTH / 2, 242, 130, i18n.t('staff.back'), () => {
      audio.playSfx('ui');
      this.scene.start('MenuScene');
    }, { height: 18, fontSize: 9 });

    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MenuScene'));
    this.cameras.main.fadeIn(500, 8, 6, 16);
  }
}
