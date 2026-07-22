/**
 * 井底短关（森林冰火人味 · 单人简化）：
 * 墨水坑 / 余烬台双危害、踩踏开关开门、移动平台。
 * 失败 → 吐回封面；成功 → 井底残页。手动 AABB。
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HERO_SCALE } from '../config';
import { audio, dialog, flags, i18n, saves, uiGate } from '../systems/context';
import { COVER_PAGES, PAGE_NEED, pageCount, pickPage } from '../systems/Pages';
import { QUICK_SLOT, type SaveData } from '../systems/SaveSystem';
import { domUI } from '../ui/dom';

interface Plat {
  x: number;
  y: number;
  w: number;
  h: number;
  rect: Phaser.GameObjects.Rectangle;
  /** 移动平台参数 */
  move?: { x0: number; x1: number; speed: number; dir: number };
}

interface Hazard {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ink' | 'ember';
  rect: Phaser.GameObjects.Rectangle;
}

interface Spike {
  x: number;
  y: number;
  active: boolean;
  sprite: Phaser.GameObjects.Image;
}

export interface WellDiveData {
  returnSave: Omit<SaveData, 'slot' | 'version' | 'savedAt'>;
}

export class WellDiveScene extends Phaser.Scene {
  private returnSave!: Omit<SaveData, 'slot' | 'version' | 'savedAt'>;
  private hero!: Phaser.GameObjects.Sprite;
  private vx = 0;
  private vy = 0;
  private onGround = false;
  private finished = false;
  private plats: Plat[] = [];
  private hazards: Hazard[] = [];
  private spikes: Spike[] = [];
  private switchZone!: { x: number; y: number; w: number; h: number; lit: Phaser.GameObjects.Rectangle };
  private gate!: Plat;
  private gateOpen = false;
  private goal!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jumpAlt: Phaser.Input.Keyboard.Key;
  };
  private readonly GRAV = 540;
  private readonly SPEED = 86;
  private readonly JUMP = 200;
  private readonly HW = 6;
  private readonly HH = 10;

  constructor() {
    super('WellDiveScene');
  }

  init(data: WellDiveData): void {
    this.returnSave = data.returnSave;
    this.finished = false;
    this.vx = 0;
    this.vy = 0;
    this.gateOpen = false;
    this.plats = [];
    this.hazards = [];
    this.spikes = [];
  }

  create(): void {
    uiGate.reset();
    dialog.reset();
    domUI.clearScene();
    domUI.clearHud();
    audio.playSfx('midnight');

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1018);
    this.add.rectangle(14, GAME_HEIGHT / 2, 28, GAME_HEIGHT, 0x05080c, 0.95);
    this.add.rectangle(GAME_WIDTH - 14, GAME_HEIGHT / 2, 28, GAME_HEIGHT, 0x05080c, 0.95);

    this.goal = this.add.image(452, 188, 'scrap-page').setScale(1.4).setDepth(5);
    this.buildLevel();

    this.hero = this.add.sprite(36, 50, 'hero', 0).setScale(HERO_SCALE).setDepth(10);
    this.hero.play('hero-idle');

    this.tweens.add({ targets: this.goal, y: 182, duration: 700, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jumpAlt: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    this.cameras.main.fadeIn(450, 8, 6, 16);
  }

  private buildLevel(): void {
    const ink = 0x2a2235;
    const addPlat = (x: number, y: number, w: number, h = 8, color = ink): Plat => {
      const rect = this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setDepth(2);
      rect.setStrokeStyle(1, 0x4a6a8a, 0.75);
      const p: Plat = { x, y, w, h, rect };
      this.plats.push(p);
      return p;
    };
    const addHazard = (x: number, y: number, w: number, h: number, kind: 'ink' | 'ember'): void => {
      const color = kind === 'ink' ? 0x3a5a7a : 0xb05030;
      const rect = this.add.rectangle(x, y, w, h, color, 0.85).setOrigin(0, 0).setDepth(1);
      this.hazards.push({ x, y, w, h, kind, rect });
    };
    const addSpike = (x: number, y: number): void => {
      const sprite = this.add.image(x + 4, y + 4, 'well-spike').setDepth(3);
      this.spikes.push({ x, y, active: true, sprite });
    };

    // —— 第 1 段：教学跳过墨水 ——
    addPlat(20, 72, 50);
    addHazard(78, 78, 36, 10, 'ink'); // 墨水坑
    addPlat(120, 72, 40);

    // —— 开关台 + 尖刺走廊 ——
    addPlat(175, 100, 48);
    const swLit = this.add.rectangle(190, 94, 14, 4, 0x666680).setOrigin(0, 0).setDepth(4);
    this.switchZone = { x: 190, y: 90, w: 14, h: 10, lit: swLit };
    addSpike(230, 112);
    addSpike(242, 112);
    addPlat(225, 120, 48);

    // —— 移动平台横跨缺口 ——
    const mover = addPlat(285, 130, 36, 8, 0x3d4a5a);
    mover.move = { x0: 270, x1: 340, speed: 38, dir: 1 };
    addHazard(280, 170, 70, 12, 'ink');

    // —— 第 2 段：余烬坑 → 短右台（可从右缘落下）→ 正下方终点 ——
    addPlat(350, 148, 40);
    addHazard(394, 156, 30, 12, 'ember');
    addPlat(428, 148, 22);

    // 保留字段以兼容开关逻辑；不可见、不碰撞
    const gateRect = this.add.rectangle(0, 0, 1, 1, 0x000000, 0).setOrigin(0, 0);
    this.gate = { x: 0, y: 0, w: 1, h: 1, rect: gateRect };

    // —— 终点台：略偏右，从短台右缘落下即可落到纸页上 ——
    addPlat(438, 208, 28);
    addHazard(20, 246, 180, 14, 'ink');
    addHazard(210, 246, 160, 14, 'ember');
    addHazard(380, 246, 90, 14, 'ink');
  }

  private setGateOpen(open: boolean): void {
    if (this.gateOpen === open) return;
    this.gateOpen = open;
    if (open) {
      audio.playSfx('confirm');
      this.switchZone.lit.setFillStyle(0xd4b86a, 1);
      for (const s of this.spikes) {
        s.active = false;
        this.tweens.add({ targets: s.sprite, alpha: 0.15, y: s.y + 10, duration: 280 });
      }
      this.gate.rect.destroy();
    }
  }

  update(_t: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 32) / 1000;

    // 移动平台
    for (const p of this.plats) {
      if (!p.move) continue;
      p.x += p.move.dir * p.move.speed * dt;
      if (p.x <= p.move.x0) {
        p.x = p.move.x0;
        p.move.dir = 1;
      } else if (p.x + p.w >= p.move.x1) {
        p.x = p.move.x1 - p.w;
        p.move.dir = -1;
      }
      p.rect.x = p.x;
      p.rect.y = p.y;
    }

    let move = 0;
    if (this.cursors.left?.isDown || this.wasd.left.isDown) move -= 1;
    if (this.cursors.right?.isDown || this.wasd.right.isDown) move += 1;
    this.vx = move * this.SPEED;

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.jumpAlt);
    if (jumpPressed && this.onGround) {
      this.vy = -this.JUMP;
      this.onGround = false;
      audio.playSfx('step');
    }

    this.vy += this.GRAV * dt;
    if (this.vy > 300) this.vy = 300;

    // 站在移动平台上时随平台平移（沿用上一帧着地状态）
    const carry = this.onGround ? this.findGroundPlat() : null;
    const carryDx = carry?.move ? carry.move.dir * carry.move.speed * dt : 0;

    this.moveAxis(this.vx * dt + carryDx, 0);
    this.onGround = false;
    this.moveAxis(0, this.vy * dt);

    if (this.vx !== 0) {
      this.hero.setFlipX(this.vx < 0);
      if (this.hero.anims.currentAnim?.key !== 'hero-walk') this.hero.play('hero-walk');
    } else if (this.onGround && this.hero.anims.currentAnim?.key !== 'hero-idle') {
      this.hero.play('hero-idle');
    }

    // 开关
    const sw = this.switchZone;
    if (
      !this.gateOpen &&
      this.overlaps(this.hero.x, this.hero.y, this.HW, this.HH, sw.x + sw.w / 2, sw.y + sw.h / 2, sw.w / 2, sw.h / 2)
    ) {
      this.setGateOpen(true);
    }

    if (this.hero.y > GAME_HEIGHT + 24) {
      this.fail();
      return;
    }
    for (const h of this.hazards) {
      if (
        this.overlaps(this.hero.x, this.hero.y, this.HW, this.HH, h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2)
      ) {
        this.fail();
        return;
      }
    }
    for (const s of this.spikes) {
      if (!s.active) continue;
      if (this.overlaps(this.hero.x, this.hero.y, this.HW, this.HH, s.x + 4, s.y + 4, 4, 4)) {
        this.fail();
        return;
      }
    }
    if (this.overlaps(this.hero.x, this.hero.y, this.HW, this.HH, this.goal.x, this.goal.y, 8, 8)) {
      this.win();
    }
  }

  private findGroundPlat(): Plat | null {
    const hx = this.hero.x;
    const hy = this.hero.y;
    for (const p of this.plats) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      if (this.overlaps(hx, hy + 1, this.HW, this.HH, cx, cy, p.w / 2, p.h / 2 + 1)) {
        if (hy + this.HH <= p.y + 3) return p;
      }
    }
    return null;
  }

  private moveAxis(dx: number, dy: number): void {
    this.hero.x += dx;
    this.hero.y += dy;
    const hx = this.hero.x;
    const hy = this.hero.y;
    for (const p of this.plats) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      if (!this.overlaps(hx, hy, this.HW, this.HH, cx, cy, p.w / 2, p.h / 2)) continue;
      if (dy > 0) {
        this.hero.y = p.y - this.HH;
        this.vy = 0;
        this.onGround = true;
      } else if (dy < 0) {
        this.hero.y = p.y + p.h + this.HH;
        this.vy = 0;
      } else if (dx !== 0) {
        if (dx > 0) this.hero.x = p.x - this.HW;
        else this.hero.x = p.x + p.w + this.HW;
        this.vx = 0;
      }
    }
    this.hero.x = Phaser.Math.Clamp(this.hero.x, 18, GAME_WIDTH - 18);
  }

  private overlaps(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ): boolean {
    return Math.abs(ax - bx) < aw + bw && Math.abs(ay - by) < ah + bh;
  }

  private win(): void {
    if (this.finished) return;
    this.finished = true;
    audio.playSfx('confirm');
    const fresh = pickPage(COVER_PAGES.well);
    this.cameras.main.fadeOut(600, 8, 6, 16);
    this.time.delayedCall(650, () => this.leave(true, fresh));
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    audio.playSfx('cancel');
    this.cameras.main.shake(200, 0.01);
    this.cameras.main.fadeOut(500, 8, 6, 16);
    this.time.delayedCall(550, () => this.leave(false, false));
  }

  private leave(won: boolean, picked: boolean): void {
    domUI.clearHud();
    domUI.clearScene();
    const save = {
      ...this.returnSave,
      flags: flags.serialize(),
      playerPosition: { x: 430, y: 130 },
    };
    saves.save(QUICK_SLOT, save);
    this.scene.start('CoverFieldScene', {
      restore: { ...save, slot: QUICK_SLOT, version: 1 as const, savedAt: Date.now() },
      wellToast: won
        ? picked
          ? i18n.t('hud.wellPagePicked', { a: pageCount(), b: PAGE_NEED })
          : undefined
        : i18n.t('hud.wellEject'),
    });
  }
}
