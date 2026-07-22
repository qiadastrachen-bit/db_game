import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE } from '../config';
import { audio, dialog, endings, flags, i18n, rules, saves, uiGate } from '../systems/context';
import { QUICK_SLOT, type SaveData } from '../systems/SaveSystem';
import { playDeathFx } from '../systems/DeathFX';
import {
  COVER_PAGES,
  PAGE_NEED,
  hasPickedPage,
  pageCount,
  pagesReady,
  pickPage,
} from '../systems/Pages';
import { Player } from '../entities/Player';
import { Rabbit } from '../entities/Rabbit';
import { Interactable } from '../entities/Interactable';
import { domUI, UI_COLORS } from '../ui/dom';
import type { UIScene } from './UIScene';

interface Patch {
  x: number;
  y: number;
  r: number;
  sprite: Phaser.GameObjects.Image;
}

interface FieldPage {
  id: string;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
}

/**
 * 封面之野（硬惩罚模式）· 第一期核心可玩场景。
 * 五条明文律令 + 两条页边注脚（井 / 斑点蕈），全部 JSON 驱动。
 * 拾页 ×3（原野 2 + 井底 1）满才能过页缝；E 听井 = 死，走入井心 = 小游戏。
 */
export class CoverFieldScene extends Phaser.Scene {
  private player!: Player;
  private rabbit!: Rabbit;
  private interactables: Interactable[] = [];
  private sobPatches: Patch[] = [];
  private clawMarks: { x: number; y: number; r: number }[] = [];
  private midnightOverlay!: Phaser.GameObjects.Rectangle;
  private endingStarted = false;
  private midnightStarted = false;
  private restoreData: SaveData | null = null;
  private wellToast: string | null = null;
  private exitHintShown = false;
  private exitNeedShown = false;
  private readonly STARE_GRACE_MS = 450;
  private readonly EXIT = { x: 464, yMin: 168, yMax: 208 };
  private qKey!: Phaser.Input.Keyboard.Key;
  private pendingIntro = new Set<string>();

  private moonSprite: Phaser.GameObjects.Image | null = null;
  private wellSprite: Phaser.GameObjects.Image | null = null;
  private signpostSprite: Phaser.GameObjects.Image | null = null;
  private mushroomSprites: Phaser.GameObjects.Image[] = [];
  private fieldPages: FieldPage[] = [];
  private lastClawAt: { x: number; y: number } | null = null;
  private lastSobNear: Phaser.GameObjects.Image | null = null;
  /** 已阅指示牌后，贴身凝视累计毫秒（站太久 = 看了） */
  private signpostGazeMs = 0;
  private readonly SIGNPOST_NEAR = 44;
  private readonly SIGNPOST_GAZE_MS = 900;
  private mushroomTearCd = 0;
  /** 站在井心累计毫秒 → 坠入小游戏 */
  private wellDiveMs = 0;
  private readonly WELL_DIVE_MS = 420;
  private diving = false;

  constructor() {
    super('CoverFieldScene');
  }

  init(data: { restore?: SaveData; wellToast?: string }): void {
    this.restoreData = data?.restore ?? null;
    this.wellToast = data?.wellToast ?? null;
    this.endingStarted = false;
    this.midnightStarted = false;
    this.exitHintShown = false;
    this.exitNeedShown = false;
    this.sobPatches = [];
    this.clawMarks = [];
    this.interactables = [];
    this.fieldPages = [];
    this.pendingIntro.clear();
    this.moonSprite = null;
    this.wellSprite = null;
    this.signpostSprite = null;
    this.mushroomSprites = [];
    this.lastClawAt = null;
    this.lastSobNear = null;
    this.signpostGazeMs = 0;
    this.mushroomTearCd = 0;
    this.wellDiveMs = 0;
    this.diving = false;
  }

  create(): void {
    domUI.clearScene(); // 清掉序章/菜单残留 DOM，避免挡住点地移动
    dialog.reset();
    uiGate.reset(); // 进入场景前强制清空 UI 阻塞（防上一轮残留）
    flags.setChapter('cover_field');
    audio.startBgm('field');

    this.buildSky();
    this.buildGround();
    this.buildProps();
    this.buildSavePoints();
    this.buildFieldPages();
    this.buildExit();

    // 主角
    this.player = new Player(this, 60, 184);
    this.player.onStep = () => audio.playSfx('step');

    // Q 快速存档（S 留给 WASD 下移；双场景并行时 JustDown 轮询更可靠）
    this.qKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // 兔子 NPC
    this.rabbit = new Rabbit(this);
    this.events.on('rabbit:stareStart', this.onStareStart, this);
    this.events.on('rabbit:stareEnd', this.onStareEnd, this);

    // UI 层
    this.scene.launch('UIScene');
    this.uiScene().events.on('shutdown', this.onUIShutdown, this);
    this.refreshPagesHud();

    // UI 事件
    const ge = this.game.events;
    ge.on('ui:interact', this.onEInteract, this);
    ge.on('ui:quicksave', this.onQuickSave, this);
    ge.on('ui:saveSlot', this.onSaveSlot, this);
    ge.on('ui:loadSlot', this.onLoadSlot, this);
    ge.on('ui:toMenu', this.onToMenu, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      ge.off('ui:interact', this.onEInteract, this);
      ge.off('ui:quicksave', this.onQuickSave, this);
      ge.off('ui:saveSlot', this.onSaveSlot, this);
      ge.off('ui:loadSlot', this.onLoadSlot, this);
      ge.off('ui:toMenu', this.onToMenu, this);
      this.events.off('rabbit:stareStart', this.onStareStart, this);
      this.events.off('rabbit:stareEnd', this.onStareEnd, this);
      this.rabbit.vanish();
      dialog.reset();
      domUI.clearScene();
    });

    // 点击地面移动 / 点击物体交互
    // 三重防穿透：① uiGate.blocked（对话/经卷/面板打开中）② uiGate.justClosed
    // （UI 关闭的同一帧点击，场景输入派发有先后）③ dialog.active（对话系统双保险）
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (uiGate.blocked || uiGate.justClosed || dialog.active || this.endingStarted) return;
      for (const it of this.interactables) {
        if (it.wasClickedRecently()) {
          if (!it.inRangeOf(this.player.x, this.player.y) && it.range < 9000) {
            // 远处点击：先走过去（再次点击/E 才交互）
            this.player.setTarget(it.zone.x, it.zone.y + 14);
          }
          return;
        }
      }
      this.player.setTarget(p.worldX, p.worldY);
    });

    // 读档恢复 or 序章后开场
    if (this.restoreData) {
      this.player.teleport(this.restoreData.playerPosition.x, this.restoreData.playerPosition.y);
      this.exitHintShown = flags.get<boolean>('exitHintShown', false);
      if (flags.isMidnight) {
        this.midnightStarted = true; // 避免午夜流程重播
        this.applyMidnightVisuals(true);
      }
      this.rabbit.schedule(4000);
      if (this.wellToast) {
        this.time.delayedCall(200, () => this.uiToast(this.wellToast!));
      } else {
        this.uiToast(i18n.t('hud.restored'));
      }
    } else {
      this.cameras.main.fadeIn(800, 8, 6, 16);
      this.time.delayedCall(400, () => {
        dialog.start('cover_intro', () => this.rabbit.schedule(6000));
      });
    }
  }

  // ---------------------------------------------------------------- 场景搭建
  private buildSky(): void {
    this.add.rectangle(GAME_WIDTH / 2, 28, GAME_WIDTH, 56, 0x0e0a14).setDepth(-1);
    const rnd = new Phaser.Math.RandomDataGenerator(['cover-sky']);
    for (let i = 0; i < 26; i++) {
      this.add
        .image(rnd.between(6, GAME_WIDTH - 6), rnd.between(4, 50), 'star')
        .setAlpha(0.25 + rnd.frac() * 0.5);
    }
    // 残月角：夜空缺的那一角（点击 = 触碰/托举 = 违规）
    this.moonSprite = this.add.image(430, 26, 'moon-frag').setDepth(1);
    this.tweens.add({ targets: this.moonSprite, y: 22, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.moonSprite, alpha: 0.75, duration: 1300, yoyo: true, repeat: -1 });
    this.interactables.push(
      new Interactable(this, {
        id: 'moon_fragment',
        x: 430,
        y: 26,
        w: 44,
        h: 44,
        range: 99999, // 任何距离的点击都视为"伸手触碰"
        allowKeyboard: false,
        onInteract: () => this.tryViolate('cover_no_moon'),
      }),
    );
  }

  private buildGround(): void {
    // tileset 帧：0 草 1 土 2 石 3 荆棘（源图 64px/块，0.25 缩放为 16 逻辑像素）
    for (let ty = 0; ty < 13; ty++) {
      for (let tx = 0; tx < 30; tx++) {
        const x = tx * TILE + TILE / 2;
        const y = 56 + ty * TILE + TILE / 2;
        let frame = 0;
        if (ty === 0 || ty === 12) frame = 3; // 上下荆棘边界
        else if (ty >= 7 && ty <= 9) frame = 1; // 小路（y 168..216）
        const t = this.add.image(x, y, 'tiles', frame).setScale(0.25).setDepth(0);
        // 苔色变化，避免大面积单调（不用渐变）
        if (frame === 0 && (tx * 7 + ty * 13) % 5 === 0) t.setTint(0x9fb39a);
        if (frame === 0 && (tx * 3 + ty * 11) % 7 === 0) t.setTint(0x8a9a88);
      }
    }
    // 井边石地
    for (const [sx, sy] of [
      [424, 96],
      [440, 96],
      [424, 112],
      [456, 112],
    ] as const) {
      this.add.image(sx, sy, 'tiles', 2).setScale(0.25).setDepth(0);
    }
  }

  private buildProps(): void {
    // 说话之井（页边注脚 · 俯身倾听 = 违规）
    this.wellSprite = this.add.image(448, 96, 'prop-well').setScale(0.5).setDepth(2);
    this.interactables.push(
      new Interactable(this, {
        id: 'speaking_well',
        x: 448,
        y: 96,
        w: 36,
        h: 40,
        range: 48,
        onInteract: () => this.onWellInteract(),
      }),
    );

    // 斑点蕈（页边注脚 · 午夜后采/踩 = 违规；白昼可学不可死）
    for (const [mx, my, sc] of [
      [70, 232, 0.25],
      [420, 228, 0.2],
    ] as const) {
      const sprite = this.add.image(mx, my, 'prop-mushroom').setScale(sc).setDepth(2);
      this.mushroomSprites.push(sprite);
      this.interactables.push(
        new Interactable(this, {
          id: `spot_mushroom_${mx}`,
          x: mx,
          y: my,
          w: 22,
          h: 22,
          range: 40,
          onInteract: () => this.onMushroomInteract(sprite),
        }),
      );
    }

    // 指示牌：看了就违规（E / 点击）
    this.signpostSprite = this.add.image(140, 162, 'signpost').setDepth(3);
    this.interactables.push(
      new Interactable(this, {
        id: 'signpost',
        x: 140,
        y: 162,
        w: 26,
        h: 34,
        range: 52,
        onInteract: () => this.tryViolate('cover_no_signpost'),
      }),
    );

    // 哽咽植被（麦浪外观；午夜转为灰绿并哽咽）
    for (const [px, py] of [
      [236, 128],
      [310, 226],
      [172, 224],
    ] as const) {
      const sprite = this.add.image(px, py, 'prop-wheat').setScale(0.4).setDepth(2).setTint(0xd4b86a).setAlpha(0.9);
      this.sobPatches.push({ x: px, y: py, r: 16, sprite });
    }

    // 路面爪印（踩上 = 违规）
    for (const [cx, cy] of [
      [252, 184],
      [330, 192],
      [395, 180],
    ] as const) {
      this.add.image(cx, cy, 'claw-mark').setDepth(1).setAlpha(0.9);
      this.clawMarks.push({ x: cx, y: cy, r: 9 });
    }
  }

  /** 魔女之家式「纸页记事」：正式档 1–3 仅在此写入；Q 仍可随时快存 */
  private buildSavePoints(): void {
    const spots: { x: number; y: number }[] = [
      { x: 88, y: 176 }, // 开场小路旁
      { x: 400, y: 128 }, // 井台附近
    ];
    for (const s of spots) {
      const book = this.add.image(s.x, s.y, 'save-book').setDepth(4);
      this.tweens.add({
        targets: book,
        alpha: 0.7,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
      // DOM 小标签
      domUI.text(domUI.scene, s.x, s.y - 16, i18n.t('hud.savePoint'), {
        size: 7,
        color: UI_COLORS.gold,
        align: 'center',
      });
      this.interactables.push(
        new Interactable(this, {
          id: `save_book_${s.x}`,
          x: s.x,
          y: s.y,
          w: 20,
          h: 22,
          range: 36,
          onInteract: () => this.openSaveDesk(),
        }),
      );
    }
  }

  private openSaveDesk(): void {
    if (this.endingStarted || uiGate.blocked) return;
    audio.playSfx('ui');
    this.uiScene().showSaveDesk();
  }

  private buildExit(): void {
    const rift = this.add.image(474, 184, 'page-rift').setDepth(2);
    this.tweens.add({ targets: rift, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    // 页缝标签走 DOM（画布禁止 add.text）
    domUI.text(domUI.scene, 474, 162, i18n.t('hud.pageRift'), {
      size: 8,
      color: UI_COLORS.glow,
      align: 'center',
    }).style.opacity = '0.85';
  }

  /** 原野散落纸页 ×2（井底第 3 片由小游戏给予） */
  private buildFieldPages(): void {
    const spots: { id: string; x: number; y: number }[] = [
      { id: COVER_PAGES.fieldA, x: 98, y: 132 },
      { id: COVER_PAGES.fieldB, x: 278, y: 214 },
    ];
    for (const s of spots) {
      if (hasPickedPage(s.id)) continue;
      const sprite = this.add.image(s.x, s.y, 'scrap-page').setDepth(4).setScale(1.2);
      this.tweens.add({
        targets: sprite,
        y: s.y - 3,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.fieldPages.push({ id: s.id, x: s.x, y: s.y, sprite });
    }
  }

  private tryPickFieldPages(px: number, py: number): void {
    for (let i = this.fieldPages.length - 1; i >= 0; i--) {
      const p = this.fieldPages[i];
      if (Phaser.Math.Distance.Between(px, py, p.x, p.y) > 16) continue;
      if (!pickPage(p.id)) continue;
      p.sprite.destroy();
      this.fieldPages.splice(i, 1);
      audio.playSfx('confirm');
      this.refreshPagesHud();
      this.uiToast(i18n.t('hud.pagePicked', { a: pageCount(), b: PAGE_NEED }));
    }
  }

  private refreshPagesHud(): void {
    // UIScene.launch 可能同帧稍后才 create；延迟一拍确保监听已挂上
    this.time.delayedCall(0, () => {
      this.game.events.emit('pages:changed');
    });
  }

  /** 走入井心 → 井底小游戏（E 倾听仍是致死注脚） */
  private tryWellDive(delta: number, px: number, py: number): void {
    if (this.diving || this.endingStarted) return;
    const d = Phaser.Math.Distance.Between(px, py, 448, 96);
    if (d <= 16) {
      this.wellDiveMs += delta;
      if (this.wellDiveMs >= this.WELL_DIVE_MS) {
        this.enterWellDive();
      }
    } else {
      this.wellDiveMs = 0;
    }
  }

  private enterWellDive(): void {
    if (this.diving || this.endingStarted) return;
    this.diving = true;
    this.player.stop();
    audio.playSfx('scroll');
    const returnSave = this.buildSave(i18n.t('menu.quickSlot'));
    this.cameras.main.fadeOut(500, 5, 8, 12);
    this.time.delayedCall(520, () => {
      dialog.reset();
      uiGate.reset();
      this.scene.stop('UIScene');
      this.scene.start('WellDiveScene', { returnSave });
    });
  }

  // ---------------------------------------------------------------- 午夜
  private startMidnight(): void {
    if (this.midnightStarted) return;
    this.midnightStarted = true;
    flags.setMidnight(true);
    audio.playSfx('midnight');
    this.applyMidnightVisuals(false);
    dialog.start('midnight_falls', () => rules.encounter('cover_midnight_grass'));
  }

  private applyMidnightVisuals(instant: boolean): void {
    if (!this.midnightOverlay) {
      this.midnightOverlay = this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0e0a14, 0)
        .setDepth(15);
    }
    if (instant) {
      this.midnightOverlay.setAlpha(0.42);
    } else {
      this.tweens.add({ targets: this.midnightOverlay, alpha: 0.42, duration: 2600 });
    }
    for (const p of this.sobPatches) {
      p.sprite.clearTint();
      p.sprite.setTint(0x6a7a68); // 哽咽灰绿
      this.tweens.add({ targets: p.sprite, angle: 3.5, duration: 170, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: p.sprite, alpha: 1, duration: 400 });
    }
    // 斑点蕈午夜苏醒（微颤 + 偏冷色）
    for (const m of this.mushroomSprites) {
      m.clearTint();
      m.setTint(0xc8a0b8);
      this.tweens.add({ targets: m, angle: 2.5, duration: 220, yoyo: true, repeat: -1 });
    }
  }

  // ---------------------------------------------------------------- 律令判定
  /**
   * 公平性：律令未录入图鉴前，危险动作只弹经卷不结算。
   * 指示牌/残月角：先播旁白再弹经卷。
   */
  private tryViolate(ruleId: string): void {
    if (this.endingStarted) return;
    if (!flags.hasReadRule(ruleId)) {
      this.introduceRuleSafe(ruleId);
      return;
    }
    this.doViolation(ruleId);
  }

  /**
   * 安全引入未读律：可选旁白后弹经卷。
   * pendingIntro 防止旁白期间每帧重复 dialog.start。
   */
  private introduceRuleSafe(ruleId: string): void {
    if (this.endingStarted || flags.hasReadRule(ruleId) || rules.wasEncountered(ruleId)) return;
    if (this.pendingIntro.has(ruleId) || dialog.active || uiGate.blocked) return;

    const whisperMap: Record<string, string> = {
      cover_no_signpost: 'signpost_whisper',
      cover_no_moon: 'moon_whisper',
      cover_no_well: 'well_whisper',
      cover_no_mushroom: 'mushroom_whisper',
    };
    const whisper = whisperMap[ruleId] ?? null;

    if (whisper) {
      this.pendingIntro.add(ruleId);
      dialog.start(whisper, () => {
        this.pendingIntro.delete(ruleId);
        rules.encounter(ruleId);
      });
    } else {
      rules.encounter(ruleId);
    }
  }

  private onWellInteract(): void {
    if (this.endingStarted) return;
    if (!flags.hasReadRule('cover_no_well')) {
      this.introduceRuleSafe('cover_no_well');
      return;
    }
    this.doViolation('cover_no_well');
  }

  private onMushroomInteract(sprite: Phaser.GameObjects.Image): void {
    if (this.endingStarted) return;
    if (!flags.hasReadRule('cover_no_mushroom')) {
      this.introduceRuleSafe('cover_no_mushroom');
      return;
    }
    if (!flags.isMidnight) {
      if (!dialog.active && !uiGate.blocked) dialog.start('mushroom_day');
      return;
    }
    this.lastSobNear = sprite;
    this.doViolation('cover_no_mushroom');
  }

  private doViolation(ruleId: string): void {
    if (this.endingStarted) return;
    this.endingStarted = true;
    this.player.stop();
    audio.playSfx('break');
    const onBreak = rules.break(ruleId);
    playDeathFx(
      this,
      ruleId,
      {
        player: this.player.sprite,
        moon: this.moonSprite,
        rabbit: this.rabbit.sprite,
        well: this.wellSprite,
        mushrooms: this.mushroomSprites,
        clawAt: this.lastClawAt,
        sobNear: this.lastSobNear,
        signpost: this.signpostSprite,
      },
      () => {
        dialog.reset();
        uiGate.reset();
        this.scene.stop('UIScene');
        this.scene.start('EndingScene', { endingId: onBreak?.outcomeId ?? 'end_cover_claw' });
      },
    );
  }

  private doPass(): void {
    if (this.endingStarted) return;
    if (!pagesReady()) {
      if (!this.exitNeedShown && !dialog.active) {
        this.exitNeedShown = true;
        dialog.start('exit_need_pages');
      }
      // 顶回一点，避免卡在出口
      this.player.teleport(Math.min(this.player.x, this.EXIT.x - 12), this.player.y);
      return;
    }
    this.endingStarted = true;
    this.player.stop();
    audio.playSfx('confirm');
    endings.unlock('end_cover_pass');
    dialog.start('pass_teaser', () => {
      this.cameras.main.fadeOut(1400, 248, 238, 184);
      this.time.delayedCall(1500, () => {
        dialog.reset();
        uiGate.reset();
        this.scene.stop('UIScene');
        this.scene.start('EndingScene', { endingId: 'end_cover_pass' });
      });
    });
  }

  // ---------------------------------------------------------------- 兔子事件
  private onStareStart(): void {
    if (this.endingStarted) return;
    audio.playSfx('ui');
    if (!flags.hasReadRule('cover_rabbit_freeze')) {
      dialog.start('rabbit_first', () => rules.encounter('cover_rabbit_freeze'));
    }
  }

  private onStareEnd(): void {
    if (this.endingStarted) return;
    audio.playSfx('step');
  }

  // ---------------------------------------------------------------- 存档 / 导航
  /** E 键交互：找距离玩家最近且在交互半径内的可交互物并触发（残月角等 allowKeyboard=false 的不响应） */
  private onEInteract(): void {
    if (uiGate.blocked || dialog.active || this.endingStarted) return;
    let best: Interactable | null = null;
    let bestDist = Number.MAX_VALUE;
    for (const it of this.interactables) {
      if (!it.enabled || !it.allowKeyboard) continue;
      if (!it.inRangeOf(this.player.x, this.player.y)) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.zone.x, it.zone.y);
      if (d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    best?.interact();
  }
  private buildSave(label: string): Omit<SaveData, 'slot' | 'version' | 'savedAt'> {
    return {
      label,
      scene: 'CoverFieldScene',
      chapter: flags.chapter,
      flags: flags.serialize(),
      playerPosition: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
    };
  }

  private onQuickSave(): void {
    const ok = saves.save(QUICK_SLOT, this.buildSave(i18n.t('menu.quickSlot')));
    this.uiToast(ok ? i18n.t('hud.quickSaved') : i18n.t('hud.saveFailed'));
    if (ok) audio.playSfx('confirm');
    else audio.playSfx('cancel');
  }

  private onSaveSlot(slot: number): void {
    const ok = saves.save(slot, this.buildSave(i18n.t('menu.slot', { n: slot })));
    this.uiToast(ok ? i18n.t('hud.saved') : i18n.t('hud.saveFailed'));
    if (ok) audio.playSfx('confirm');
  }

  /** 游戏内读档：恢复 flags 后按存档记录的场景重启（UIScene 一并重建） */
  private onLoadSlot(slot: number): void {
    const data = saves.load(slot);
    if (!data) {
      this.uiToast(i18n.t('hud.emptySlotToast'));
      audio.playSfx('cancel');
      return;
    }
    dialog.reset();
    uiGate.reset();
    flags.restore(data.flags);
    rules.resetEncountered();
    endings.seedFromGallery();
    audio.playSfx('confirm');
    this.scene.stop('UIScene');
    this.cameras.main.fadeOut(400, 8, 6, 16);
    this.time.delayedCall(420, () => this.scene.start(data.scene, { restore: data }));
  }

  private onToMenu(): void {
    dialog.reset();
    uiGate.reset();
    this.scene.stop('UIScene');
    this.cameras.main.fadeOut(500, 8, 6, 16);
    this.time.delayedCall(520, () => {
      domUI.clearScene();
      this.scene.start('MenuScene');
    });
  }

  private uiScene(): UIScene {
    return this.scene.get('UIScene') as UIScene;
  }

  private uiToast(msg: string): void {
    this.uiScene().showToast(msg);
  }

  private onUIShutdown(): void {
    /* UIScene 被停止时无需额外处理（由本场景统一 stop/start） */
  }

  // ---------------------------------------------------------------- 主循环
  update(_time: number, delta: number): void {
    if (this.endingStarted) return;
    const blocked = uiGate.blocked;

    // Q 快速存档（模态打开时不触发）
    if (!blocked && Phaser.Input.Keyboard.JustDown(this.qKey)) this.onQuickSave();

    this.player.update(delta, blocked);
    this.rabbit.update(delta, blocked, this.player.x);
    for (const it of this.interactables) it.syncPlayer(this.player.x, this.player.y);
    if (blocked) return;

    const px = this.player.x;
    const py = this.player.y;

    // —— 拾取原野纸页 ——
    this.tryPickFieldPages(px, py);

    // —— 走入井心：坠入小游戏 ——
    this.tryWellDive(delta, px, py);

    // —— 触发：午夜 ——
    if (!this.midnightStarted && px >= 240) this.startMidnight();

    // —— 律令 1：午夜踩哽咽植被 ——
    if (flags.isMidnight) {
      for (const patch of this.sobPatches) {
        if (Phaser.Math.Distance.Between(px, py, patch.x, patch.y) <= patch.r) {
          this.lastSobNear = patch.sprite;
          if (flags.hasReadRule('cover_midnight_grass')) {
            this.doViolation('cover_midnight_grass');
          } else {
            this.introduceRuleSafe('cover_midnight_grass');
            this.player.stop();
            // 把玩家推出草丛（弹经卷期间不产生威胁）
            const ang = Phaser.Math.Angle.Between(patch.x, patch.y, px, py);
            this.player.teleport(
              patch.x + Math.cos(ang) * (patch.r + 4),
              patch.y + Math.sin(ang) * (patch.r + 4),
            );
          }
          return;
        }
      }

      // —— 注脚：午夜踩斑点蕈 ——
      for (const m of this.mushroomSprites) {
        if (Phaser.Math.Distance.Between(px, py, m.x, m.y) <= 12) {
          this.lastSobNear = m;
          if (flags.hasReadRule('cover_no_mushroom')) {
            this.doViolation('cover_no_mushroom');
          } else {
            this.introduceRuleSafe('cover_no_mushroom');
            this.player.stop();
            const ang = Phaser.Math.Angle.Between(m.x, m.y, px, py);
            this.player.teleport(m.x + Math.cos(ang) * 16, m.y + Math.sin(ang) * 16);
          }
          return;
        }
      }
    }

    // —— 律令 5：踩路面爪印（靠近时先弹经卷） ——
    for (const c of this.clawMarks) {
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d <= 40 && !flags.hasReadRule('cover_watch_step')) this.introduceRuleSafe('cover_watch_step');
      if (d <= c.r) {
        this.lastClawAt = { x: c.x, y: c.y };
        if (flags.hasReadRule('cover_watch_step')) {
          this.doViolation('cover_watch_step');
        } else {
          this.introduceRuleSafe('cover_watch_step');
          this.player.stop();
          const ang = Phaser.Math.Angle.Between(c.x, c.y, px, py);
          this.player.teleport(c.x + Math.cos(ang) * (c.r + 3), c.y + Math.sin(ang) * (c.r + 3));
        }
        return;
      }
    }

    // —— 律令 4：靠近指示牌 ——
    // 未读：旁白+经卷；已读且贴身凝视过久 = 「看了」→ 违规（站一块不能毫无反应）
    const signDist = Phaser.Math.Distance.Between(px, py, 140, 162);
    if (signDist <= 72) this.introduceRuleSafe('cover_no_signpost');
    if (signDist <= this.SIGNPOST_NEAR && flags.hasReadRule('cover_no_signpost')) {
      this.signpostGazeMs += delta;
      if (this.signpostGazeMs >= this.SIGNPOST_GAZE_MS) {
        this.doViolation('cover_no_signpost');
        return;
      }
    } else {
      this.signpostGazeMs = 0;
    }

    // —— 注脚：靠近井先旁白/经卷 ——
    if (Phaser.Math.Distance.Between(px, py, 448, 96) <= 56) this.introduceRuleSafe('cover_no_well');

    // —— 注脚：靠近蕈（昼夜皆可学；仅午夜致死见上） + 近旁掉泪 ——
    this.updateMushroomPresence(delta, px, py);

    // —— 律令 2：走近右半场先弹经卷（残月角） ——
    if (px >= 320) this.introduceRuleSafe('cover_no_moon');

    // —— 律令 3：兔子凝视时移动（含反应宽限） ——
    if (this.rabbit.isStaring && this.rabbit.stareElapsed > this.STARE_GRACE_MS && this.player.moving) {
      if (flags.hasReadRule('cover_rabbit_freeze')) {
        this.doViolation('cover_rabbit_freeze');
        return;
      }
      // 规则未读时宽限：onStareStart 已弹经卷
    }

    // —— 页缝出口：需凑齐纸页 ——
    if (px < this.EXIT.x - 24) this.exitNeedShown = false;
    if (px >= 400 && !this.exitHintShown && !dialog.active) {
      this.exitHintShown = true;
      flags.set('exitHintShown', true);
      dialog.start('exit_near');
    }
    if (px >= this.EXIT.x && py >= this.EXIT.yMin && py <= this.EXIT.yMax) {
      this.doPass();
    }
  }

  /** 靠近斑点蕈：引入注脚 + 滴泪氛围（午夜泪更密、偏灰绿） */
  private updateMushroomPresence(delta: number, px: number, py: number): void {
    let nearest: Phaser.GameObjects.Image | null = null;
    let nearestD = 40;
    for (const m of this.mushroomSprites) {
      const d = Phaser.Math.Distance.Between(px, py, m.x, m.y);
      if (d <= 40) {
        this.introduceRuleSafe('cover_no_mushroom');
        if (d < nearestD) {
          nearestD = d;
          nearest = m;
        }
      }
    }
    if (!nearest) {
      this.mushroomTearCd = Math.min(this.mushroomTearCd, 180);
      return;
    }
    this.mushroomTearCd -= delta;
    if (this.mushroomTearCd > 0) return;
    this.mushroomTearCd = flags.isMidnight ? 220 + Math.random() * 160 : 420 + Math.random() * 280;
    this.spawnMushroomTear(nearest.x, nearest.y - 5);
  }

  private spawnMushroomTear(x: number, y: number): void {
    const color = flags.isMidnight ? 0x8a9a88 : 0xa8c8e8;
    const tear = this.add
      .circle(x + (Math.random() * 5 - 2.5), y, 1.15, color, 0.95)
      .setDepth(12);
    this.tweens.add({
      targets: tear,
      y: y + 12 + Math.random() * 10,
      alpha: 0,
      scaleX: 0.35,
      scaleY: 0.7,
      duration: 680,
      ease: 'Sine.easeIn',
      onComplete: () => tear.destroy(),
    });
  }
}
