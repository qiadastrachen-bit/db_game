import Phaser from 'phaser';

export type RabbitState = 'hidden' | 'appearing' | 'staring' | 'leaving';

/**
 * 兔子 NPC：瑞比安放在原野上的句读。
 * 周期性出现 → 眼睑静止不眨（staring）数秒 → 眨眼离开。
 * staring 期间玩家移动 = 违反律令（由 CoverFieldScene 判定，含反应宽限）。
 * 计时由场景 update 驱动；UI 阻塞时计时暂停。
 * appear/leave 的 tween 在阻塞期间仍可跑完视觉，但 stareStart 延迟到解除阻塞后，避免对话重入锁死 UI。
 */
export class Rabbit {
  readonly sprite: Phaser.GameObjects.Sprite;
  state: RabbitState = 'hidden';
  /** 凝视开始至今的毫秒数（供宽限判定） */
  stareElapsed = 0;

  private appearIn = 6000; // 距下次出现的毫秒数
  private stareDuration = 3400;
  private events: Phaser.Events.EventEmitter;
  private pendingStare = false;
  private activeTween: Phaser.Tweens.Tween | null = null;

  /** 可能的出现位置（田埂/草丛边，远离出生点） */
  private spots = [
    { x: 210, y: 150 },
    { x: 300, y: 130 },
    { x: 360, y: 176 },
    { x: 250, y: 224 },
    { x: 150, y: 130 },
  ];

  constructor(private scene: Phaser.Scene) {
    this.events = scene.events;
    this.sprite = scene.add
      .sprite(-100, -100, 'rabbit', 0)
      .setDepth(9)
      .setVisible(false)
      .setAlpha(0);
  }

  get isStaring(): boolean {
    return this.state === 'staring';
  }

  /** 调度首次出现 */
  schedule(firstDelayMs: number): void {
    this.appearIn = firstDelayMs;
  }

  /** 立即消失（读档恢复/离开场景时清理） */
  vanish(): void {
    this.activeTween?.stop();
    this.activeTween = null;
    this.pendingStare = false;
    this.state = 'hidden';
    this.sprite.setVisible(false).setAlpha(0);
  }

  update(deltaMs: number, blocked: boolean, playerX: number): void {
    if (blocked) return;

    // appear tween 可能在阻塞期间跑完：解除阻塞后再进入凝视并发事件
    if (this.pendingStare) {
      this.pendingStare = false;
      this.startStare();
      return;
    }

    switch (this.state) {
      case 'hidden':
        this.appearIn -= deltaMs;
        if (this.appearIn <= 0) this.appear(playerX);
        break;
      case 'staring':
        this.stareElapsed += deltaMs;
        if (this.stareElapsed >= this.stareDuration) this.leave();
        break;
      default:
        break;
    }
  }

  private appear(playerX: number): void {
    // 选一个不压在玩家身上的出现点
    const candidates = this.spots.filter((s) => Math.abs(s.x - playerX) > 40);
    const spot = Phaser.Utils.Array.GetRandom(candidates.length ? candidates : this.spots);
    this.sprite.setPosition(spot.x, spot.y).setVisible(true);
    this.sprite.setFlipX(spot.x > playerX); // 面向玩家方向
    this.sprite.play('rabbit-blink');
    this.state = 'appearing';
    this.pendingStare = false;
    this.activeTween?.stop();
    this.activeTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 420,
      onComplete: () => {
        this.activeTween = null;
        this.pendingStare = true;
      },
    });
  }

  private startStare(): void {
    // 仅从 appearing 进入；vanish 后忽略迟到的 pendingStare
    if (this.state !== 'appearing' || !this.sprite.visible) return;
    this.state = 'staring';
    this.stareElapsed = 0;
    this.sprite.play('rabbit-stare'); // 眼睑静止不眨
    this.events.emit('rabbit:stareStart');
  }

  private leave(): void {
    this.state = 'leaving';
    this.sprite.play('rabbit-blink'); // 眨眼 → 安全信号
    this.events.emit('rabbit:stareEnd');
    this.activeTween?.stop();
    this.activeTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 500,
      delay: 350,
      onComplete: () => {
        this.activeTween = null;
        this.state = 'hidden';
        this.sprite.setVisible(false);
        this.appearIn = 11000 + Math.random() * 9000; // 下一次出现
      },
    });
  }
}
