import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HERO_FRAME_W, HERO_FRAME_H } from '../config';
import { ASSETS } from '../assets';
import { pal, injectPaletteCssVars } from '../systems/Palette';
import { wireSystems } from '../systems/context';

/**
 * Boot：加载素材、生成程序化占位纹理（指示牌/兔子/爪印/残月角/噪点等，
 * 详见 assets/README.md 占位清单）、注入调色板 CSS 变量，然后进入 Menu。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // 真实素材
    this.load.spritesheet('hero', ASSETS.heroSheet, {
      frameWidth: HERO_FRAME_W,
      frameHeight: HERO_FRAME_H,
    });
    this.load.spritesheet('tiles', ASSETS.tileset, { frameWidth: 64, frameHeight: 64 });
    this.load.image('prop-wheat', ASSETS.props.wheat);
    this.load.image('prop-well', ASSETS.props.well);
    this.load.image('prop-mushroom', ASSETS.props.mushroom);
    this.load.image('prop-moon', ASSETS.props.moon);
    this.load.image('prop-mirror', ASSETS.props.mirror);
    for (const [key, url] of Object.entries(ASSETS.banners)) {
      this.load.image(`banner-${key}`, url);
    }
  }

  create(): void {
    wireSystems(this.game);
    injectPaletteCssVars();
    this.makePlaceholderTextures();
    this.applyNearestFilter();
    this.makeAnimations();

    const tip = document.getElementById('loading-tip');
    if (tip) tip.remove();

    this.scene.start('MenuScene');
  }

  /**
   * 纹理过滤分离（验收红线）：
   * 全部图像类纹理（图集/精灵/道具/横幅/程序化像素纹理）→ NEAREST，保持像素边锐利；
   * 文字纹理由 Phaser 在运行时创建，保持全局默认 LINEAR，非整数缩放下平滑。
   * 注意 config 里已关闭 pixelArt 全局模式（antialias: true）。
   */
  private applyNearestFilter(): void {
    const keys = [
      'hero',
      'tiles',
      'prop-wheat',
      'prop-well',
      'prop-mushroom',
      'prop-moon',
      'prop-mirror',
      ...Object.keys(ASSETS.banners).map((k) => `banner-${k}`),
      // 程序化占位纹理
      'rabbit',
      'signpost',
      'claw-mark',
      'claw-sil',
      'moon-frag',
      'star',
      'noise',
      'page-rift',
      'scrap-page',
      'well-spike',
      'save-book',
    ];
    for (const key of keys) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  // ------------------------------------------------------------------
  // 程序化占位纹理（素材缺口，替换路径见 assets/README.md）
  // ------------------------------------------------------------------
  private makePlaceholderTextures(): void {
    const outline = pal('outline');
    const pale = pal('pale');
    const glow = pal('glow');
    const ink = pal('ink');
    const rust = pal('rust-red');
    const shadow = pal('shadow');
    const mist = pal('mist');

    // —— 兔子（占位）：32×20 两帧，帧 0 眨眼 / 帧 1 凝视不眨 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      for (const offsetX of [0, 32]) {
        // 身体
        g.fillStyle(outline, 1);
        g.fillEllipse(offsetX + 15, 13, 22, 13);
        g.fillStyle(pale, 1);
        g.fillEllipse(offsetX + 15, 13, 20, 11);
        // 头
        g.fillStyle(outline, 1);
        g.fillCircle(offsetX + 24, 9, 6);
        g.fillStyle(pale, 1);
        g.fillCircle(offsetX + 24, 9, 5);
        // 耳朵
        g.fillStyle(outline, 1);
        g.fillRect(offsetX + 20, 0, 3, 6);
        g.fillRect(offsetX + 25, 0, 3, 6);
        g.fillStyle(pale, 1);
        g.fillRect(offsetX + 21, 1, 1, 4);
        g.fillRect(offsetX + 26, 1, 1, 4);
        // 尾
        g.fillStyle(glow, 1);
        g.fillCircle(offsetX + 5, 12, 2);
        // 眼睛
        if (offsetX === 0) {
          // 眨眼：一条闭眼线
          g.fillStyle(ink, 1);
          g.fillRect(offsetX + 25, 8, 3, 1);
        } else {
          // 凝视：月白圆瞳 + 墨心
          g.fillStyle(glow, 1);
          g.fillCircle(offsetX + 26, 8, 2);
          g.fillStyle(ink, 1);
          g.fillCircle(offsetX + 26, 8, 1);
        }
      }
      g.generateTexture('rabbit', 64, 20);
      g.destroy();
      const tex = this.textures.get('rabbit');
      tex.add(0, 0, 0, 0, 32, 20);
      tex.add(1, 0, 32, 0, 32, 20);
    }

    // —— 指示牌（占位）：20×28 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(outline, 1);
      g.fillRect(8, 10, 4, 18); // 立柱
      g.fillStyle(pal('violet'), 1);
      g.fillRect(9, 10, 2, 18);
      g.fillStyle(outline, 1);
      g.fillRect(1, 1, 18, 11); // 牌面
      g.fillStyle(pale, 1);
      g.fillRect(2, 2, 16, 9);
      // 牌上墨迹（不可读的字——看了就违规）
      g.fillStyle(ink, 1);
      g.fillRect(4, 4, 12, 1);
      g.fillRect(4, 6, 9, 1);
      g.fillRect(4, 8, 11, 1);
      g.generateTexture('signpost', 20, 28);
      g.destroy();
    }

    // —— 爪印花纹（占位）：16×16 路面爪形划痕 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(rust, 0.85);
      // 三道斜划痕
      for (let i = 0; i < 3; i++) {
        g.fillRect(3 + i * 4, 3, 2, 10);
      }
      g.fillRect(2, 4, 2, 6);
      g.generateTexture('claw-mark', 16, 16);
      g.destroy();
    }

    // —— 大爪印剪影（占位）：64×64，结局画廊锁定占位 + 坏结局静帧 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(shadow, 1);
      g.fillEllipse(32, 42, 26, 20); // 掌垫
      for (const [tx, ty] of [
        [18, 22],
        [28, 16],
        [38, 16],
        [48, 22],
      ] as const) {
        g.fillEllipse(tx, ty, 10, 12); // 趾垫
      }
      // 爪尖
      g.fillTriangle(16, 12, 20, 12, 18, 4);
      g.fillTriangle(26, 7, 30, 7, 28, 1);
      g.fillTriangle(36, 7, 40, 7, 38, 1);
      g.fillTriangle(46, 12, 50, 12, 48, 4);
      g.generateTexture('claw-sil', 64, 64);
      g.destroy();
    }

    // —— 残月角（占位）：36×36，夜空缺角的碎片，边缘参差 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(glow, 1);
      // fillSlice 不在 Graphics 类型内：用扇形多边形（fillPoints）视觉等效实现
      const fan: Phaser.Types.Math.Vector2Like[] = [{ x: 18, y: 18 }];
      for (let a = -140; a <= 40; a += 10) {
        const rad = Phaser.Math.DegToRad(a);
        fan.push({ x: 18 + Math.cos(rad) * 15, y: 18 + Math.sin(rad) * 15 });
      }
      g.fillPoints(fan, true);
      // 撕裂边缘的参差
      g.fillStyle(pal('bg-deep'), 1);
      g.fillTriangle(18, 18, 30, 4, 34, 12);
      g.fillTriangle(18, 18, 33, 22, 26, 30);
      // 微光描边
      g.lineStyle(1, mist, 0.7);
      g.strokeCircle(18, 18, 15);
      g.generateTexture('moon-frag', 36, 36);
      g.destroy();
    }

    // —— 星星（占位）：2×2 月白点 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(glow, 1);
      g.fillRect(0, 0, 2, 2);
      g.generateTexture('star', 2, 2);
      g.destroy();
    }

    // —— 纸纹噪点（占位）：64×64 稀疏墨点，低透明度平铺为后处理质感 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(shadow, 1);
      const rnd = new Phaser.Math.RandomDataGenerator(['sdt']);
      for (let i = 0; i < 70; i++) {
        g.fillRect(rnd.between(0, 63), rnd.between(0, 63), 1, 1);
      }
      g.generateTexture('noise', 64, 64);
      g.destroy();
    }

    // —— 通行终点标记（占位）：16×24 卷起的页缝 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(glow, 1);
      g.fillRect(6, 0, 4, 24);
      g.fillStyle(pal('gold'), 1);
      g.fillRect(7, 0, 2, 24);
      g.generateTexture('page-rift', 16, 24);
      g.destroy();
    }

    // —— 散落纸页（占位）：10×12 折角纸片 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(glow, 1);
      g.fillRect(1, 1, 8, 10);
      g.fillStyle(pal('gold'), 1);
      g.fillTriangle(9, 1, 9, 4, 6, 1);
      g.lineStyle(1, outline, 1);
      g.strokeRect(1, 1, 8, 10);
      g.generateTexture('scrap-page', 10, 12);
      g.destroy();
    }

    // —— 井底尖刺（占位） ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(rust, 1);
      g.fillTriangle(0, 8, 4, 0, 8, 8);
      g.generateTexture('well-spike', 8, 8);
      g.destroy();
    }

    // —— 纸页记事（占位）：存档点小本 ——
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(glow, 1);
      g.fillRect(2, 1, 10, 14);
      g.fillStyle(pal('gold'), 1);
      g.fillRect(2, 1, 3, 14);
      g.lineStyle(1, outline, 1);
      g.strokeRect(2, 1, 10, 14);
      g.fillStyle(ink, 1);
      g.fillRect(7, 4, 3, 1);
      g.fillRect(7, 7, 3, 1);
      g.fillRect(7, 10, 2, 1);
      g.generateTexture('save-book', 14, 16);
      g.destroy();
    }
  }

  private makeAnimations(): void {
    // 主角（hero-sheet.json：行 0 idle×4 / 行 1 walk×8，每行 8 列）
    this.anims.create({
      key: 'hero-idle',
      frames: this.anims.generateFrameNumbers('hero', { frames: [0, 1, 2, 3] }),
      frameRate: 5,
      repeat: -1,
    });
    this.anims.create({
      key: 'hero-walk',
      frames: this.anims.generateFrameNumbers('hero', { frames: [8, 9, 10, 11, 12, 13, 14, 15] }),
      frameRate: 10,
      repeat: -1,
    });
    // 兔子
    this.anims.create({
      key: 'rabbit-blink',
      frames: [{ key: 'rabbit', frame: 0 }],
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: 'rabbit-stare',
      frames: [{ key: 'rabbit', frame: 1 }],
      frameRate: 1,
      repeat: -1,
    });
  }
}
