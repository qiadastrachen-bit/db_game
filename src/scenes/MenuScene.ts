import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { ASSETS } from '../assets';
import { audio, i18n, flags, saves, rules, endings } from '../systems/context';
import { ALL_SLOTS, QUICK_SLOT, type SaveData } from '../systems/SaveSystem';
import { domUI, UI_COLORS } from '../ui/dom';

type PanelName = 'none' | 'load' | 'gallery' | 'settings';

/**
 * Menu：标题「碎梦童话」+ 开始 / 读档 / 图鉴 / 设置 / 制作名单。
 * 背景（横幅/压暗/噪点）留在 Phaser 画布；全部文字与交互面板走 DOM 覆盖层。
 * 图鉴面板含 结局画廊（未解锁显示爪印剪影）与 律令图鉴 两页签。
 */
export class MenuScene extends Phaser.Scene {
  private openPanel: PanelName = 'none';

  constructor() {
    super('MenuScene');
  }

  create(): void {
    audio.startBgm('menu');
    this.buildBackdrop();
    this.buildMenuDOM();
    this.openPanel = 'none';

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.closePanel()) audio.playSfx('cancel');
    });
  }

  // ---------------------------------------------------------------- 背景（画布层）
  private buildBackdrop(): void {
    const banner = this.add
      .image(GAME_WIDTH / 2, 0, 'banner-cover')
      .setOrigin(0.5, 0)
      .setScale(0.3)
      .setAlpha(0.55);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 75, GAME_WIDTH, 150, 0x0e0a14, 1);
    this.add.rectangle(GAME_WIDTH / 2, 60, GAME_WIDTH, 120, 0x0e0a14, 0.35);
    banner.setDepth(-2);
    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'noise')
      .setAlpha(0.06)
      .setDepth(5);
  }

  // ---------------------------------------------------------------- 标题与主菜单（DOM）
  private buildMenuDOM(): void {
    const L = domUI.scene;
    domUI.clearScene();

    domUI.text(L, GAME_WIDTH / 2, 42, i18n.t('app.title'), {
      size: 34,
      color: UI_COLORS.glow,
      align: 'center',
      letterSpacing: 8,
    });
    domUI.text(L, GAME_WIDTH / 2, 84, i18n.t('app.subtitle'), {
      size: 10,
      color: UI_COLORS.dim,
      align: 'center',
    });
    // 金色页线
    const rule = document.createElement('div');
    rule.style.cssText = `position:absolute;left:${GAME_WIDTH / 2 - 90}px;top:98px;width:180px;height:1px;background:${UI_COLORS.gold};`;
    L.appendChild(rule);

    const defs: { label: string; fn: () => void }[] = [
      { label: i18n.t('menu.start'), fn: () => this.startNewGame() },
      { label: i18n.t('menu.continue'), fn: () => this.showPanel('load') },
      { label: i18n.t('menu.gallery'), fn: () => this.showPanel('gallery') },
      { label: i18n.t('menu.settings'), fn: () => this.showPanel('settings') },
      { label: i18n.t('menu.staff'), fn: () => this.scene.start('StaffScene') },
    ];
    defs.forEach((d, i) => {
      domUI.button(L, GAME_WIDTH / 2, 118 + i * 27, 132, d.label, () => {
        audio.playSfx('ui');
        d.fn();
      });
    });

    domUI.text(L, GAME_WIDTH / 2, GAME_HEIGHT - 14, i18n.t('app.credit'), {
      size: 8,
      color: UI_COLORS.dim,
      align: 'center',
    });
  }

  // ---------------------------------------------------------------- 开始 / 读档
  private startNewGame(): void {
    flags.resetRun();
    rules.resetEncountered();
    endings.seedFromGallery(); // 图鉴跨档保留结局解锁；律令已读只信本档
    flags.setChapter('prologue');
    audio.playSfx('confirm');
    this.cameras.main.fadeOut(600, 8, 6, 16);
    this.time.delayedCall(620, () => {
      domUI.clearScene();
      this.scene.start('PrologueScene');
    });
  }

  private loadSave(data: SaveData): void {
    flags.restore(data.flags);
    rules.resetEncountered();
    endings.seedFromGallery();
    audio.playSfx('confirm');
    this.cameras.main.fadeOut(500, 8, 6, 16);
    this.time.delayedCall(520, () => {
      domUI.clearScene();
      this.scene.start(data.scene, { restore: data });
    });
  }

  // ---------------------------------------------------------------- 面板通用（DOM）
  private showPanel(name: PanelName): void {
    this.openPanel = name;
    this.buildMenuDOM();
    if (name === 'load') this.renderLoadPanel();
    else if (name === 'gallery') this.rebuildGallery('endings');
    else if (name === 'settings') this.renderSettingsPanel();
  }

  private closePanel(): boolean {
    if (this.openPanel === 'none') return false;
    this.openPanel = 'none';
    this.buildMenuDOM();
    return true;
  }

  /** 面板骨架：遮罩 + 面板 + 标题 + ✕ 关闭 + Esc 提示；返回内容容器 */
  private panelShell(title: string, w: number, h: number): HTMLElement {
    const L = domUI.scene;
    domUI.veil(L); // 拦截点击（防止穿透到画布）
    const panel = domUI.panel(L, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 12, title, { size: 14, color: UI_COLORS.glow, align: 'center' });
    const close = domUI.text(panel, w - 10, 8, i18n.t('menu.close'), {
      size: 9,
      color: UI_COLORS.dim,
      align: 'right',
      interactive: true,
      onClick: () => {
        audio.playSfx('cancel');
        this.closePanel();
      },
    });
    close.addEventListener('mouseenter', () => (close.style.color = UI_COLORS.glow));
    close.addEventListener('mouseleave', () => (close.style.color = UI_COLORS.dim));
    domUI.text(panel, w / 2, h - 16, i18n.t('menu.escBack'), { size: 8, color: UI_COLORS.violet, align: 'center' });
    return panel;
  }

  // ---------------------------------------------------------------- 读档面板
  private renderLoadPanel(): void {
    const panel = this.panelShell(i18n.t('menu.continue'), 400, 216);
    const slots = saves.list();
    let anySave = false;
    slots.forEach((data, i) => {
      const slot = ALL_SLOTS[i];
      const y = 52 + i * 30;
      const name = slot === QUICK_SLOT ? i18n.t('menu.quickSlot') : i18n.t('menu.slot', { n: slot });
      if (!data) {
        domUI.text(panel, 200, y, `${name} · ${i18n.t('menu.emptySlot')}`, {
          size: 10,
          color: UI_COLORS.violet,
          align: 'center',
        });
        return;
      }
      anySave = true;
      const when = new Date(data.savedAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      domUI.button(panel, 200, y + 6, 300, `${name} · ${data.label || i18n.t('hud.chapter')} · ${when}`, () => this.loadSave(data), {
        height: 22,
      });
    });
    if (!anySave) {
      domUI.text(panel, 200, 168, i18n.t('menu.noSave'), { size: 9, color: UI_COLORS.dim, align: 'center' });
    }
  }

  // ---------------------------------------------------------------- 图鉴面板
  private rebuildGallery(tab: 'endings' | 'rules'): void {
    this.buildMenuDOM();
    const panel = this.panelShell(i18n.t('menu.gallery'), 420, 226);
    domUI.button(panel, 130, 40, 120, i18n.t('gallery.endings'), () => {
      audio.playSfx('ui');
      this.rebuildGallery('endings');
    }, { height: 18, fontSize: 9, selected: tab === 'endings' });
    domUI.button(panel, 290, 40, 120, i18n.t('gallery.rules'), () => {
      audio.playSfx('ui');
      this.rebuildGallery('rules');
    }, { height: 18, fontSize: 9, selected: tab === 'rules' });
    if (tab === 'endings') this.renderEndingsGallery(panel);
    else this.renderRulesCodex(panel);
  }

  private renderEndingsGallery(panel: HTMLElement): void {
    const gallery = saves.loadGallery();
    const all = endings.all();
    const unlocked = all.filter((e) => gallery.endingsUnlocked.includes(e.id));
    domUI.text(panel, 210, 58, i18n.t('gallery.unlockedCount', { a: unlocked.length, b: all.length }), {
      size: 9,
      color: UI_COLORS.dim,
      align: 'center',
    });
    all.forEach((e, i) => {
      const x = 105 + i * 210;
      const isOpen = gallery.endingsUnlocked.includes(e.id);
      if (isOpen) {
        const img = document.createElement('img');
        img.src = (ASSETS.banners as Record<string, string>)[e.banner] ?? '';
        img.style.cssText = `position:absolute;left:${x - 80}px;top:70px;width:160px;image-rendering:pixelated;`;
        panel.appendChild(img);
        domUI.text(panel, x, 116, e.title, { size: 11, color: UI_COLORS.glow, align: 'center' });
        domUI.text(panel, x, 130, e.description, { size: 8, color: UI_COLORS.pale, align: 'center', width: 190 });
        domUI.text(panel, x, 196, `「${e.fadeMessage}」`, { size: 8, color: UI_COLORS.gold, align: 'center' });
      } else {
        // 未解锁：爪印剪影占位（复用画布内程序化纹理 → base64）
        const img = document.createElement('img');
        img.src = this.textures.getBase64('claw-sil');
        img.style.cssText = `position:absolute;left:${x - 28}px;top:66px;width:56px;image-rendering:pixelated;opacity:.8;`;
        panel.appendChild(img);
        domUI.text(panel, x, 128, i18n.t('gallery.locked'), { size: 11, color: UI_COLORS.violet, align: 'center' });
        domUI.text(panel, x, 146, i18n.t('gallery.lockedDesc'), { size: 8, color: UI_COLORS.violet, align: 'center' });
        domUI.text(panel, x, 164, e.hint, { size: 8, color: UI_COLORS.outline, align: 'center', width: 190 });
      }
    });
  }

  private renderRulesCodex(panel: HTMLElement): void {
    const gallery = saves.loadGallery();
    const main = rules.mainByRealm('cover_field');
    const footnotes = rules.footnotesByRealm('cover_field');
    const all = [...main, ...footnotes];
    const read = all.filter((r) => gallery.rulesRead.includes(r.id));
    domUI.text(panel, 210, 56, i18n.t('gallery.ruleCount', { a: read.length, b: all.length }), {
      size: 9,
      color: UI_COLORS.dim,
      align: 'center',
    });
    let y = 72;
    domUI.text(panel, 30, y, i18n.t('gallery.mainRules'), { size: 8, color: UI_COLORS.gold });
    y += 14;
    main.forEach((r, i) => {
      const isRead = gallery.rulesRead.includes(r.id);
      if (isRead) {
        domUI.text(panel, 30, y, `${i + 1}. ${r.title}`, { size: 8, color: UI_COLORS.pale, width: 360 });
      } else {
        domUI.text(panel, 30, y, `${i + 1}. ${i18n.t('gallery.ruleUnread')}`, { size: 8, color: UI_COLORS.violet });
      }
      y += 15;
    });
    y += 4;
    domUI.text(panel, 30, y, i18n.t('gallery.footnotes'), { size: 8, color: UI_COLORS.gold });
    y += 14;
    footnotes.forEach((r) => {
      const isRead = gallery.rulesRead.includes(r.id);
      if (isRead) {
        domUI.text(panel, 30, y, `※ ${r.title}`, { size: 8, color: UI_COLORS.pale, width: 360 });
      } else {
        domUI.text(panel, 30, y, `※ ${i18n.t('gallery.ruleUnread')}`, { size: 8, color: UI_COLORS.violet });
      }
      y += 15;
    });
  }

  // ---------------------------------------------------------------- 设置面板
  private renderSettingsPanel(): void {
    const panel = this.panelShell(i18n.t('settings.title'), 320, 180);
    const kinds = [
      { key: 'master' as const, label: i18n.t('settings.master') },
      { key: 'bgm' as const, label: i18n.t('settings.bgm') },
      { key: 'sfx' as const, label: i18n.t('settings.sfx') },
    ];
    kinds.forEach((k, i) => {
      domUI.slider(panel, 178, 56 + i * 32, k.label, () => audio.getVolume(k.key), (v) => audio.setVolume(k.key, v));
    });
    domUI.text(panel, 160, 158, i18n.t('settings.hint'), { size: 8, color: UI_COLORS.dim, align: 'center' });
  }
}
