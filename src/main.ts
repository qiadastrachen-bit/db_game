import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PrologueScene } from './scenes/PrologueScene';
import { CoverFieldScene } from './scenes/CoverFieldScene';
import { UIScene } from './scenes/UIScene';
import { EndingScene } from './scenes/EndingScene';
import { StaffScene } from './scenes/StaffScene';
import { WellDiveScene } from './scenes/WellDiveScene';
import { domUI } from './ui/dom';

/**
 * 逻辑分辨率 480×270；canvas CSS 尺寸由 applyIntegerZoom 锁定为整数倍（×1/×2/×3）。
 * 渲染策略（验收红线）：
 *  - 图像素材纹理：BootScene 统一 setFilter(NEAREST) → 像素边锐利；
 *  - 文字：全部走 DOM 覆盖层（src/ui/dom.ts，霞鹜文楷矢量渲染），
 *    Phaser 画布内不允许任何 add.text；
 *  - canvas 不用 CSS pixelated（整数倍下等价，非整数会切碎）。
 * UI 层（UIScene）与场景层（CoverFieldScene 等）分离，并行运行。
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0e0a14',
  antialias: true, // 全局默认 LINEAR；图像素材在 BootScene 单独改 NEAREST
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE, // 整数倍缩放由 applyIntegerZoom 手动控制
    autoCenter: Phaser.Scale.NO_CENTER, // 居中由 index.html 的 flex 布局负责
  },
  scene: [BootScene, MenuScene, PrologueScene, CoverFieldScene, WellDiveScene, UIScene, EndingScene, StaffScene],
};

const game = new Phaser.Game(config);

// DOM 文字覆盖层初始化
domUI.init();

/** 整数倍放大：优先 ×3，其次 ×2，屏幕太小退到 ×1；同步 DOM 覆盖层缩放 */
function applyIntegerZoom(): void {
  const zx = window.innerWidth / GAME_WIDTH;
  const zy = window.innerHeight / GAME_HEIGHT;
  const z = Math.max(1, Math.min(3, Math.floor(Math.min(zx, zy))));
  game.scale.setZoom(z);
  domUI.syncLayout();
}

window.addEventListener('resize', applyIntegerZoom);
applyIntegerZoom();
// canvas 首帧后再同步一次（确保 getBoundingClientRect 有效）
requestAnimationFrame(() => domUI.syncLayout());

export default game;
