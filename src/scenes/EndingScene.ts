import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { audio, i18n, endings } from '../systems/context';
import { domUI, UI_COLORS } from '../ui/dom';

/**
 * Ending：结局结算页。
 * 横幅/爪印静帧/页缝光柱/噪点留在 Phaser 画布；全部文字与按钮走 DOM。
 * 坏结局 end_cover_claw：爪印静帧（无血腥）+ 「你的存在不再归属于活物。」
 * 通行结局 end_cover_pass：页缝预告（下一境「林间残页」）。
 * 进入即解锁并记入结局画廊。
 */
export class EndingScene extends Phaser.Scene {
  private endingId = 'end_cover_claw';

  constructor() {
    super('EndingScene');
  }

  init(data: { endingId?: string }): void {
    this.endingId = data?.endingId ?? 'end_cover_claw';
  }

  create(): void {
    const ending = endings.get(this.endingId);
    const isBad = ending?.type !== 'pass';
    endings.unlock(this.endingId);
    audio.startBgm('ending');
    audio.playSfx('unlock');

    // ---- 画布层：氛围 ----
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080610);
    if (ending) {
      this.add
        .image(GAME_WIDTH / 2, 0, `banner-${ending.banner}`)
        .setOrigin(0.5, 0)
        .setScale(0.3)
        .setAlpha(isBad ? 0.35 : 0.6);
      this.add.rectangle(GAME_WIDTH / 2, 60, GAME_WIDTH, 120, 0x080610, 0.4);
    }
    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'noise')
      .setAlpha(0.08)
      .setDepth(1);

    if (isBad) {
      const claw = this.add.image(GAME_WIDTH / 2, 152, 'claw-sil').setScale(2.4).setAlpha(0).setDepth(2);
      this.tweens.add({
        targets: claw,
        scale: 0.9,
        alpha: 0.95,
        duration: 700,
        ease: 'Cubic.easeIn',
        onComplete: () => this.cameras.main.shake(180, 0.008),
      });
    } else {
      const rift = this.add.image(GAME_WIDTH / 2, 152, 'page-rift').setScale(1.6).setDepth(2);
      this.tweens.add({ targets: rift, alpha: 0.5, duration: 1100, yoyo: true, repeat: -1 });
    }

    // ---- DOM 层：全部文字与按钮 ----
    const L = domUI.scene;
    domUI.clearScene();
    domUI.text(L, GAME_WIDTH / 2, 84, isBad ? i18n.t('ending.bad') : i18n.t('ending.pass'), {
      size: 11,
      color: isBad ? UI_COLORS.rust : UI_COLORS.gold,
      align: 'center',
      letterSpacing: 6,
    });
    domUI.text(L, GAME_WIDTH / 2, 104, ending?.title ?? this.endingId, {
      size: 20,
      color: UI_COLORS.glow,
      align: 'center',
      letterSpacing: 4,
    });
    domUI.text(L, GAME_WIDTH / 2, 190, `「${ending?.fadeMessage ?? ''}」`, {
      size: 12,
      color: UI_COLORS.pale,
      align: 'center',
    });
    domUI.text(L, GAME_WIDTH / 2, 212, ending?.description ?? '', {
      size: 8,
      color: UI_COLORS.dim,
      align: 'center',
      width: 400,
      lineHeight: 1.5,
    });
    domUI.text(L, GAME_WIDTH / 2, 244, `· ${i18n.t('ending.recorded')} ·`, {
      size: 8,
      color: UI_COLORS.gold,
      align: 'center',
    });
    domUI.button(L, GAME_WIDTH / 2 - 80, 262, 130, i18n.t('ending.toMenu'), () => {
      audio.playSfx('ui');
      this.scene.start('MenuScene');
    }, { height: 16, fontSize: 9 });
    domUI.button(L, GAME_WIDTH / 2 + 80, 262, 130, i18n.t('ending.staff'), () => {
      audio.playSfx('ui');
      this.scene.start('StaffScene');
    }, { height: 16, fontSize: 9 });

    this.cameras.main.fadeIn(isBad ? 0 : 900, 8, 6, 16);
  }
}
