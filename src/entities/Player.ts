import Phaser from 'phaser';
import { HERO_SCALE } from '../config';

/**
 * 主角：点击地面移动 + 方向键 / WASD 移动。
 * 移动状态对外只读（moving），供"兔子凝视时禁止移动"等律令判定。
 * 快速存档改绑 Q，避免与 S（下）冲突。
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  speed = 72; // 逻辑像素/秒
  moving = false;
  private target: { x: number; y: number } | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private stepTimer = 0;
  onStep: (() => void) | null = null;

  /** 活动范围（封面之野的原野区域，天空与 UI 条除外） */
  bounds = new Phaser.Geom.Rectangle(10, 60, 460, 200);

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.sprite(x, y, 'hero', 0).setScale(HERO_SCALE).setDepth(10);
    this.sprite.play('hero-idle');
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  setTarget(x: number, y: number): void {
    this.target = {
      x: Phaser.Math.Clamp(x, this.bounds.left, this.bounds.right),
      y: Phaser.Math.Clamp(y, this.bounds.top, this.bounds.bottom),
    };
  }

  stop(): void {
    this.target = null;
    this.moving = false;
    if (this.sprite.anims.currentAnim?.key !== 'hero-idle') this.sprite.play('hero-idle');
  }

  teleport(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.stop();
  }

  update(deltaMs: number, inputBlocked: boolean): void {
    if (inputBlocked) {
      if (this.moving) this.stop();
      return;
    }

    // 键盘优先：方向键或 WASD 任一按下即取消点击目标
    let dx = 0;
    let dy = 0;
    if (this.cursors.left?.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right?.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up?.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down?.isDown || this.wasd.down.isDown) dy += 1;

    const dt = deltaMs / 1000;
    if (dx !== 0 || dy !== 0) {
      this.target = null;
      const len = Math.hypot(dx, dy);
      this.move((dx / len) * this.speed * dt, (dy / len) * this.speed * dt);
    } else if (this.target) {
      const tx = this.target.x - this.sprite.x;
      const ty = this.target.y - this.sprite.y;
      const dist = Math.hypot(tx, ty);
      const step = this.speed * dt;
      if (dist <= Math.max(1.5, step)) {
        this.sprite.setPosition(this.target.x, this.target.y);
        this.stop();
        return;
      }
      this.move((tx / dist) * step, (ty / dist) * step);
    } else {
      if (this.moving) this.stop();
      return;
    }

    // 移动中：动画、朝向、脚步声
    if (!this.moving) {
      this.moving = true;
      this.sprite.play('hero-walk');
    }
    if (dx !== 0 || this.target) {
      const faceX = dx !== 0 ? dx : (this.target?.x ?? this.sprite.x) - this.sprite.x;
      if (faceX !== 0) this.sprite.setFlipX(faceX < 0);
    }
    this.stepTimer += deltaMs;
    if (this.stepTimer >= 260) {
      this.stepTimer = 0;
      this.onStep?.();
    }
  }

  private move(mx: number, my: number): void {
    const b = this.bounds;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x + mx, b.left, b.right);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y + my, b.top, b.bottom);
  }
}
