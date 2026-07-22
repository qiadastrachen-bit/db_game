/**
 * 分死因演出：程序化 tween，不新增大图。
 * 全部坏结局仍汇入 end_cover_claw；此处只负责场景内 1.2–1.8s 视觉差异。
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export interface DeathFxContext {
  player: Phaser.GameObjects.Sprite;
  moon?: Phaser.GameObjects.Image | null;
  rabbit?: Phaser.GameObjects.Sprite | null;
  well?: Phaser.GameObjects.Image | null;
  mushrooms?: Phaser.GameObjects.Image[];
  clawAt?: { x: number; y: number } | null;
  sobNear?: Phaser.GameObjects.Image | null;
  signpost?: Phaser.GameObjects.Image | null;
}

const DEPTH = 90;
const DURATION = 1600;

export function playDeathFx(
  scene: Phaser.Scene,
  ruleId: string,
  ctx: DeathFxContext,
  onDone: () => void,
): void {
  let settled = false;
  const veil = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080610, 0)
    .setDepth(DEPTH + 5);

  const finish = (): void => {
    if (settled) return;
    settled = true;
    scene.tweens.add({
      targets: veil,
      alpha: 0.94,
      duration: 400,
      onComplete: () => onDone(),
    });
  };

  scene.cameras.main.shake(280, 0.01);

  switch (ruleId) {
    case 'cover_midnight_grass':
      playGrassSink(scene, ctx, finish);
      break;
    case 'cover_no_moon':
      playMoonSwallow(scene, ctx, finish);
      break;
    case 'cover_rabbit_freeze':
      playInkSlash(scene, ctx, finish);
      break;
    case 'cover_no_signpost':
      playSignFlatten(scene, ctx, finish);
      break;
    case 'cover_watch_step':
      playClawStamp(scene, ctx, finish);
      break;
    case 'cover_no_well':
      playWellPull(scene, ctx, finish);
      break;
    case 'cover_no_mushroom':
      playMushroomSpore(scene, ctx, finish);
      break;
    default:
      scene.tweens.add({ targets: ctx.player, alpha: 0, duration: 900, onComplete: finish });
      break;
  }

  // 兜底：确保总会进入结算
  scene.time.delayedCall(DURATION + 400, finish);
}

function playGrassSink(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  p.setTint(0x6a7a68);
  if (ctx.sobNear) {
    scene.tweens.add({
      targets: ctx.sobNear,
      angle: 8,
      duration: 90,
      yoyo: true,
      repeat: 8,
    });
  }
  scene.tweens.add({
    targets: p,
    scaleY: 0.05,
    y: p.y + 14,
    alpha: 0.15,
    duration: 1200,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}

function playMoonSwallow(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  const moon = ctx.moon;
  if (moon) {
    scene.tweens.add({
      targets: moon,
      scale: (moon.scaleX || 1) * 4.5,
      alpha: 1,
      x: p.x,
      y: p.y,
      duration: 1100,
      ease: 'Cubic.easeIn',
    });
  }
  // 撕页黄楔（扩大的扇形光）
  const wedge = scene.add.graphics().setDepth(DEPTH);
  scene.tweens.addCounter({
    from: 10,
    to: 100,
    duration: 1100,
    onUpdate: (tw) => {
      const r = Number(tw.getValue() ?? 10);
      const a = 1 - (r - 10) / 90;
      wedge.clear();
      wedge.fillStyle(0xf8eeb8, 0.55 * Math.max(0, a));
      wedge.slice(p.x, p.y, r, Phaser.Math.DegToRad(-30), Phaser.Math.DegToRad(60), false);
      wedge.fillPath();
    },
  });
  scene.tweens.add({
    targets: p,
    alpha: 0,
    scale: 0.2,
    duration: 1000,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}

function playInkSlash(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  p.anims?.stop();
  // 墨线
  const line = scene.add.graphics().setDepth(DEPTH);
  line.lineStyle(2, 0x1a1220, 1);
  line.lineBetween(p.x - 40, p.y - 20, p.x - 40, p.y - 20);
  let t = 0;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 450,
    onUpdate: (tw) => {
      t = Number(tw.getValue() ?? 0);
      line.clear();
      line.lineStyle(2, 0xd4b86a, 1);
      line.lineBetween(p.x - 36, p.y - 18, p.x - 36 + 72 * t, p.y - 18 + 36 * t);
    },
  });
  if (ctx.rabbit) {
    scene.tweens.add({ targets: ctx.rabbit, alpha: 0.3, duration: 600 });
  }
  scene.time.delayedCall(500, () => {
    const claw = scene.add.image(p.x, p.y, 'claw-sil').setDepth(DEPTH).setScale(0.3).setAlpha(0);
    p.setVisible(false);
    scene.tweens.add({
      targets: claw,
      scale: 1.1,
      alpha: 0.95,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: done,
    });
  });
}

function playSignFlatten(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  if (ctx.signpost) {
    scene.tweens.add({
      targets: ctx.signpost,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 800,
      yoyo: true,
    });
  }
  // 字迹粒子（小矩形冒向角色）
  for (let i = 0; i < 8; i++) {
    const speck = scene.add
      .rectangle(140 + (i % 3) * 4, 150 + Math.floor(i / 3) * 4, 3, 2, 0xf8eeb8, 0.9)
      .setDepth(DEPTH);
    scene.tweens.add({
      targets: speck,
      x: p.x + (i - 4) * 3,
      y: p.y - 4,
      alpha: 0,
      duration: 900 + i * 40,
      ease: 'Cubic.easeIn',
    });
  }
  scene.tweens.add({
    targets: p,
    scaleY: 0.08,
    scaleX: 1.6,
    alpha: 0.2,
    duration: 1100,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}

function playClawStamp(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  const cx = ctx.clawAt?.x ?? p.x;
  const cy = ctx.clawAt?.y ?? p.y;
  const stamp = scene.add.image(cx, cy, 'claw-mark').setDepth(DEPTH).setScale(0.6).setAlpha(0.5);
  scene.tweens.add({
    targets: stamp,
    scale: 2.8,
    alpha: 1,
    y: cy - 8,
    duration: 700,
    ease: 'Back.easeIn',
  });
  scene.tweens.add({
    targets: p,
    alpha: 0,
    scale: 0.4,
    duration: 900,
    delay: 200,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}

function playWellPull(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  const well = ctx.well;
  const tx = well?.x ?? 448;
  const ty = well?.y ?? 96;
  // 井口圆洞扩张
  const hole = scene.add.graphics().setDepth(DEPTH - 1);
  scene.tweens.addCounter({
    from: 6,
    to: 55,
    duration: 1000,
    onUpdate: (tw) => {
      const r = Number(tw.getValue() ?? 6);
      hole.clear();
      hole.fillStyle(0x050308, 0.92);
      hole.fillCircle(tx, ty, r);
    },
  });
  // 纸屑
  for (let i = 0; i < 6; i++) {
    const scrap = scene.add
      .rectangle(p.x + (i - 3) * 6, p.y - 10, 4, 3, 0xf8eeb8, 0.8)
      .setDepth(DEPTH);
    scene.tweens.add({
      targets: scrap,
      x: tx + (i - 3) * 2,
      y: ty + 4,
      alpha: 0,
      angle: 90,
      duration: 1000,
      delay: i * 50,
    });
  }
  scene.tweens.add({
    targets: p,
    x: tx,
    y: ty,
    scale: 0.15,
    alpha: 0,
    duration: 1100,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}

function playMushroomSpore(scene: Phaser.Scene, ctx: DeathFxContext, done: () => void): void {
  const p = ctx.player;
  const mush = ctx.mushrooms?.[0];
  if (mush) {
    scene.tweens.add({
      targets: mush,
      scale: mush.scaleX * 1.8,
      duration: 600,
      yoyo: true,
    });
  }
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const spore = scene.add.circle(p.x, p.y - 6, 1.5, 0xe8d4e0, 1).setDepth(DEPTH);
    scene.tweens.add({
      targets: spore,
      x: p.x + Math.cos(ang) * 36,
      y: p.y + Math.sin(ang) * 28,
      alpha: 0,
      duration: 1000,
      delay: i * 30,
    });
  }
  scene.tweens.add({
    targets: p,
    alpha: 0,
    scale: 0.3,
    duration: 1000,
    ease: 'Cubic.easeIn',
    onComplete: done,
  });
}
