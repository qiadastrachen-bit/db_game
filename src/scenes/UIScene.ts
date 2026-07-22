import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { audio, i18n, dialog, rules, uiGate, flags, saves } from '../systems/context';
import { pagesHudVars } from '../systems/Pages';
import { ALL_SLOTS, QUICK_SLOT } from '../systems/SaveSystem';
import type { Rule } from '../systems/RulesSystem';
import type { DialogLine } from '../systems/DialogSystem';
import { domUI, UI_COLORS, type TypewriterHandle } from '../ui/dom';

type ModalName = 'dialog' | 'scroll' | 'codex' | 'pause' | 'settings' | 'saveSlots' | 'loadSlots' | null;

/**
 * UIScene：封面之野的 UI 层逻辑（键盘路由/模态状态机/系统事件接线）。
 * 全部视觉渲染走 DOM 覆盖层（hudLayer），画布内无任何文字。
 * 负责：底部提示条、对话框（DOM 打字机）、律令经卷、律令图鉴（J）、
 * 暂停菜单（Esc）、读/存档面板、Toast。E/点击 语义按当前模态路由。
 */
export class UIScene extends Phaser.Scene {
  private modal: ModalName = null;
  private modalStack: ModalName[] = [];

  // 对话
  private dialogTextEl: HTMLDivElement | null = null;
  private typewriter: TypewriterHandle | null = null;

  // 经卷
  private scrollQueue: Rule[] = [];
  private currentScrollRule: Rule | null = null;

  // 面板根（每打开一个模态面板就在 hud 上挂一个容器，关闭时移除）
  private panelRoot: HTMLDivElement | null = null;
  private pagesEl: HTMLDivElement | null = null;

  constructor() {
    super('UIScene');
  }

  create(): void {
    domUI.clearHud();

    // 底部提示条（常驻）
    const bar = document.createElement('div');
    bar.style.cssText = `position:absolute;left:0;top:${GAME_HEIGHT - 18}px;width:${GAME_WIDTH}px;height:18px;background:rgba(14,10,20,.85);pointer-events:none;`;
    domUI.hud.appendChild(bar);
    domUI.text(domUI.hud, GAME_WIDTH / 2, GAME_HEIGHT - 15, i18n.t('hud.keys'), {
      size: 8,
      color: UI_COLORS.dim,
      align: 'center',
    });

    // 拾页计数（左上）：按 flags 实况初始化，避免写死 0/3
    const pv = pagesHudVars();
    this.pagesEl = domUI.text(domUI.hud, 10, 8, i18n.t('hud.pages', pv), {
      size: 9,
      color: UI_COLORS.gold,
    });
    this.pagesEl.title = i18n.t('hud.pagesLegend');

    // 系统事件 → UI
    const ge = this.game.events;
    ge.on('dialog:start', this.onDialogStart, this);
    ge.on('dialog:line', this.onDialogLine, this);
    ge.on('dialog:end', this.onDialogEnd, this);
    ge.on('rule:scroll', this.onRuleScroll, this);
    ge.on('pages:changed', this.onPagesChanged, this);

    // 键盘路由（S 快速存档由 CoverFieldScene 用 JustDown 轮询处理，不走这里）
    const kb = this.input.keyboard!;
    kb.on('keydown-E', () => this.onConfirmKey());
    kb.on('keydown-SPACE', () => this.onConfirmKey());
    kb.on('keydown-ENTER', () => this.onConfirmKey());
    kb.on('keydown-ESC', () => this.onEscapeKey());
    kb.on('keydown-J', () => this.onCodexKey());

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      ge.off('dialog:start', this.onDialogStart, this);
      ge.off('dialog:line', this.onDialogLine, this);
      ge.off('dialog:end', this.onDialogEnd, this);
      ge.off('rule:scroll', this.onRuleScroll, this);
      ge.off('pages:changed', this.onPagesChanged, this);
      this.typewriter?.cancel();
      this.pagesEl = null;
      domUI.clearHud();
    });
  }

  private onPagesChanged(): void {
    if (!this.pagesEl) return;
    const pv = pagesHudVars();
    this.pagesEl.textContent = i18n.t('hud.pages', pv);
  }

  // ---------------------------------------------------------------- 模态管理
  private openModal(name: Exclude<ModalName, null>): void {
    // 经卷被其它模态挤掉时回滚 encounter，避免本局该律永久卡在「未读且不可再弹」
    if (this.modal === 'scroll' && name !== 'scroll') {
      this.abortCurrentScroll();
    }
    if (this.modal === null) uiGate.open();
    else this.modalStack.push(this.modal);
    this.modal = name;
  }

  private closeModal(): ModalName {
    const prev = this.modalStack.pop() ?? null;
    this.modal = prev;
    if (this.modal === null) uiGate.close();
    return this.modal;
  }

  /** 经卷未确认被强制关闭：回滚 encounter，稍后可再弹 */
  private abortCurrentScroll(): void {
    if (!this.currentScrollRule) return;
    rules.releaseEncounter(this.currentScrollRule.id);
    // 从队列里去掉同一条，避免立刻再弹同一未读律造成循环
    const id = this.currentScrollRule.id;
    this.scrollQueue = this.scrollQueue.filter((r) => r.id !== id);
    this.currentScrollRule = null;
  }

  /** 新建模态容器（先清掉旧的） */
  private newPanelRoot(): HTMLDivElement {
    this.panelRoot?.remove();
    const root = document.createElement('div');
    domUI.hud.appendChild(root);
    this.panelRoot = root;
    return root;
  }

  private removePanelRoot(): void {
    this.panelRoot?.remove();
    this.panelRoot = null;
  }

  // ---------------------------------------------------------------- 对话（DOM 打字机）
  private onDialogStart(): void {
    // 对话不得叠在经卷/暂停等面板上拆掉未确认经卷或留下幽灵栈
    if (this.modal === 'scroll') {
      this.abortCurrentScroll();
      this.removePanelRoot();
      this.closeModal();
    } else if (this.modal !== null && this.modal !== 'dialog') {
      this.removePanelRoot();
      while (this.modal !== null) this.closeModal();
    }
    this.openModal('dialog');
    const root = this.newPanelRoot();
    // 透明全屏遮罩：点击任意处继续对话（同时拦截画布点击）
    domUI.veil(root, { clear: true, onClick: () => this.advanceDialog() });

    const h = 62;
    const box = document.createElement('div');
    box.className = 'ui-dialog';
    box.style.cssText += `left:${GAME_WIDTH / 2 - 190}px;top:${GAME_HEIGHT - 18 - h}px;width:380px;height:${h}px;`;
    box.addEventListener('click', () => this.advanceDialog());
    root.appendChild(box);

    this.dialogTextEl = domUI.text(box as unknown as HTMLElement, 10, 8, '', {
      size: 10,
      color: UI_COLORS.pale,
      width: 360,
      lineHeight: 1.5,
    });
    const nextHint = domUI.text(box as unknown as HTMLElement, 372, h - 14, i18n.t('dialog.next'), {
      size: 7,
      color: UI_COLORS.dim,
      align: 'right',
      width: 100,
    });
    nextHint.style.whiteSpace = 'nowrap';
    nextHint.style.wordBreak = 'keep-all';
  }

  private onDialogLine(line: DialogLine): void {
    if (!this.dialogTextEl) return;
    const full = (line.speaker ? `${line.speaker}：` : '') + line.text;
    this.typewriter?.cancel();
    this.typewriter = domUI.typewriter(this.dialogTextEl, full, { cps: 30 });
  }

  private advanceDialog(): void {
    if (this.modal !== 'dialog') return;
    if (this.typewriter && !this.typewriter.done) {
      this.typewriter.skip();
      return;
    }
    audio.playSfx('ui');
    dialog.next();
  }

  private onDialogEnd(): void {
    this.typewriter?.cancel();
    this.typewriter = null;
    this.dialogTextEl = null;
    this.removePanelRoot();
    this.closeModal();
    this.flushScrollQueue();
  }

  // ---------------------------------------------------------------- 律令经卷弹窗
  private onRuleScroll(rule: Rule): void {
    this.scrollQueue.push(rule);
    this.flushScrollQueue();
  }

  private flushScrollQueue(): void {
    if (this.modal !== null || this.scrollQueue.length === 0) return;
    const rule = this.scrollQueue.shift()!;
    this.showScroll(rule);
  }

  private showScroll(rule: Rule): void {
    this.openModal('scroll');
    this.currentScrollRule = rule;
    audio.playSfx('scroll');
    const page = rules.pageOf(rule.id);
    const total = rules.groupTotal(rule.id);
    const kickerKey = rule.footnote ? 'ruleScroll.footnoteKicker' : 'ruleScroll.kicker';
    const hardKey = rule.footnote ? 'ruleScroll.footnoteHard' : 'ruleScroll.severityHard';

    const root = this.newPanelRoot();
    domUI.veil(root, { onClick: () => this.confirmScroll() }); // 点击任意处确认
    const w = 380;
    const h = 168;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 14, `${i18n.t(kickerKey, { n: page })} · ${i18n.t('hud.chapter')} ${page}/${total}`, {
      size: 9,
      color: UI_COLORS.gold,
      align: 'center',
    });
    domUI.text(panel, w / 2, 34, rule.title, { size: 11, color: UI_COLORS.glow, align: 'center', width: 350, lineHeight: 1.5 });
    domUI.text(panel, w / 2, 70, rule.body, { size: 9, color: UI_COLORS.pale, align: 'center', width: 330, lineHeight: 1.5 });
    if (rule.severity === 'hard') {
      domUI.text(panel, w / 2, 128, `—— ${i18n.t(hardKey)} ——`, {
        size: 8,
        color: UI_COLORS.rust,
        align: 'center',
      });
    }
    domUI.text(panel, w / 2, 146, i18n.t('ruleScroll.confirm'), { size: 9, color: UI_COLORS.gold, align: 'center' });
  }

  private confirmScroll(): void {
    if (this.modal !== 'scroll' || !this.currentScrollRule) return;
    rules.confirmRead(this.currentScrollRule.id);
    this.currentScrollRule = null;
    audio.playSfx('confirm');
    this.removePanelRoot();
    this.closeModal();
    this.flushScrollQueue();
  }

  // ---------------------------------------------------------------- 按键路由
  private onConfirmKey(): void {
    if (this.modal === 'dialog') this.advanceDialog();
    else if (this.modal === 'scroll') this.confirmScroll();
    else if (this.modal === null) this.game.events.emit('ui:interact'); // 世界层 E 交互
  }

  private onEscapeKey(): void {
    if (this.modal === 'dialog') {
      dialog.skip();
      return;
    }
    if (this.modal === 'scroll') return; // 经卷必须确认，不可跳过
    if (this.modal === 'codex' || this.modal === 'settings' || this.modal === 'saveSlots' || this.modal === 'loadSlots') {
      audio.playSfx('cancel');
      this.removePanelRoot();
      const now = this.closeModal();
      // 设置/存档子面板来自暂停菜单时返回暂停菜单
      if (now === 'pause') this.showPausePanel();
      return;
    }
    if (this.modal === 'pause') {
      audio.playSfx('cancel');
      this.removePanelRoot();
      this.closeModal();
      return;
    }
    // 无模态 → 打开暂停菜单
    this.openModal('pause');
    audio.playSfx('ui');
    this.showPausePanel();
  }

  private onCodexKey(): void {
    if (this.modal === 'codex') {
      audio.playSfx('cancel');
      this.removePanelRoot();
      this.closeModal();
      return;
    }
    if (this.modal !== null) return;
    this.openModal('codex');
    audio.playSfx('scroll');
    this.showCodexPanel();
  }

  // ---------------------------------------------------------------- 暂停菜单
  private showPausePanel(): void {
    const root = this.newPanelRoot();
    domUI.veil(root);
    const w = 260;
    const h = 200;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 14, i18n.t('pause.title'), { size: 13, color: UI_COLORS.glow, align: 'center' });
    const defs: { label: string; fn: () => void }[] = [
      {
        label: i18n.t('pause.resume'),
        fn: () => {
          audio.playSfx('confirm');
          this.removePanelRoot();
          this.closeModal();
        },
      },
      {
        label: i18n.t('pause.load'),
        fn: () => {
          audio.playSfx('ui');
          this.openModal('loadSlots');
          this.showLoadSlotsPanel();
        },
      },
      {
        label: i18n.t('pause.settings'),
        fn: () => {
          audio.playSfx('ui');
          this.openModal('settings');
          this.showSettingsPanel();
        },
      },
      {
        label: i18n.t('pause.toMenu'),
        fn: () => {
          audio.playSfx('cancel');
          this.removePanelRoot();
          while (this.modal !== null) this.closeModal();
          this.game.events.emit('ui:toMenu');
        },
      },
    ];
    defs.forEach((d, i) => domUI.button(panel, w / 2, 42 + i * 28, 190, d.label, d.fn, { height: 20 }));
    domUI.text(panel, w / 2, h - 28, i18n.t('pause.saveAtPoint'), {
      size: 7,
      color: UI_COLORS.dim,
      align: 'center',
      width: 240,
    });
    domUI.text(panel, w / 2, h - 12, i18n.t('menu.escBack'), { size: 8, color: UI_COLORS.violet, align: 'center' });
  }

  /** 纸页记事：魔女之家式正式存档台（档位 1–3 写入 + 读档） */
  showSaveDesk(): void {
    this.removePanelRoot();
    while (this.modal !== null) this.closeModal();
    this.openModal('saveSlots');
    audio.playSfx('scroll');
    this.renderSaveDesk();
  }

  private renderSaveDesk(): void {
    const root = this.newPanelRoot();
    domUI.veil(root);
    const w = 300;
    const h = 210;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 10, i18n.t('pause.deskTitle'), { size: 13, color: UI_COLORS.glow, align: 'center' });
    domUI.text(panel, w / 2, 28, i18n.t('hud.savePointHint'), {
      size: 7,
      color: UI_COLORS.dim,
      align: 'center',
      width: 280,
    });
    [1, 2, 3].forEach((slot, i) => {
      domUI.button(panel, w / 2, 54 + i * 26, 200, i18n.t('pause.writeSlot', { n: slot }), () => {
        this.game.events.emit('ui:saveSlot', slot);
        this.removePanelRoot();
        while (this.modal !== null) this.closeModal();
      }, { height: 20 });
    });
    domUI.button(panel, w / 2, 140, 200, i18n.t('pause.deskLoad'), () => {
      audio.playSfx('ui');
      this.openModal('loadSlots');
      this.showLoadSlotsPanel();
    }, { height: 20 });
    domUI.text(panel, w / 2, h - 14, i18n.t('menu.escBack'), { size: 8, color: UI_COLORS.violet, align: 'center' });
  }

  private showSaveSlotsPanel(): void {
    // 兼容旧路径：统一走记事台样式
    this.renderSaveDesk();
  }

  /** 游戏内读档面板：列出 快速存档 + 档位 1-3，空档置灰不可点 */
  private showLoadSlotsPanel(): void {
    const root = this.newPanelRoot();
    domUI.veil(root);
    const w = 300;
    const h = 180;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 10, i18n.t('pause.load'), { size: 12, color: UI_COLORS.glow, align: 'center' });
    const slots = saves.list();
    let anySave = false;
    slots.forEach((data, i) => {
      const slot = ALL_SLOTS[i];
      const y = 40 + i * 28;
      const name = slot === QUICK_SLOT ? i18n.t('menu.quickSlot') : i18n.t('menu.slot', { n: slot });
      if (!data) {
        domUI.text(panel, w / 2, y, `${name} · ${i18n.t('menu.emptySlot')}`, {
          size: 9,
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
      domUI.button(panel, w / 2, y + 8, 240, `${name} · ${when}`, () => {
        audio.playSfx('confirm');
        this.removePanelRoot();
        while (this.modal !== null) this.closeModal();
        this.game.events.emit('ui:loadSlot', slot);
      }, { height: 20, fontSize: 9 });
    });
    if (!anySave) {
      domUI.text(panel, w / 2, 152, i18n.t('menu.noSave'), { size: 8, color: UI_COLORS.dim, align: 'center' });
    }
    domUI.text(panel, w / 2, h - 14, i18n.t('menu.escBack'), { size: 8, color: UI_COLORS.violet, align: 'center' });
  }

  private showSettingsPanel(): void {
    const root = this.newPanelRoot();
    domUI.veil(root);
    const w = 260;
    const h = 160;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h);
    domUI.text(panel, w / 2, 12, i18n.t('settings.title'), { size: 12, color: UI_COLORS.glow, align: 'center' });
    const kinds = [
      { key: 'master' as const, label: i18n.t('settings.master') },
      { key: 'bgm' as const, label: i18n.t('settings.bgm') },
      { key: 'sfx' as const, label: i18n.t('settings.sfx') },
    ];
    kinds.forEach((k, i) => {
      domUI.slider(panel, 148, 46 + i * 28, k.label, () => audio.getVolume(k.key), (v) => audio.setVolume(k.key, v));
    });
    domUI.text(panel, w / 2, h - 14, i18n.t('settings.hint'), { size: 8, color: UI_COLORS.dim, align: 'center' });
  }

  // ---------------------------------------------------------------- 律令图鉴（J）
  private showCodexPanel(): void {
    const root = this.newPanelRoot();
    domUI.veil(root);
    const w = 420;
    const h = 230;
    const panel = domUI.panel(root, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 4, w, h);
    const main = rules.mainByRealm('cover_field');
    const footnotes = rules.footnotesByRealm('cover_field');
    const all = [...main, ...footnotes];
    const read = all.filter((r) => flags.hasReadRule(r.id));
    domUI.text(panel, w / 2, 10, `${i18n.t('gallery.rules')} · ${i18n.t('gallery.ruleCount', { a: read.length, b: all.length })}`, {
      size: 11,
      color: UI_COLORS.glow,
      align: 'center',
    });

    let y = 28;
    domUI.text(panel, 24, y, i18n.t('gallery.mainRules'), { size: 8, color: UI_COLORS.gold });
    y += 14;
    main.forEach((r, i) => {
      if (flags.hasReadRule(r.id)) {
        domUI.text(panel, 24, y, `${i + 1}. ${r.title}`, { size: 8, color: UI_COLORS.pale, width: 380 });
      } else {
        domUI.text(panel, 24, y, `${i + 1}. ${i18n.t('gallery.ruleUnread')}`, { size: 8, color: UI_COLORS.violet });
      }
      y += 16;
    });

    y += 4;
    domUI.text(panel, 24, y, i18n.t('gallery.footnotes'), { size: 8, color: UI_COLORS.gold });
    y += 14;
    footnotes.forEach((r, i) => {
      if (flags.hasReadRule(r.id)) {
        domUI.text(panel, 24, y, `※ ${r.title}`, { size: 8, color: UI_COLORS.pale, width: 380 });
      } else {
        domUI.text(panel, 24, y, `※ ${i18n.t('gallery.ruleUnread')}`, { size: 8, color: UI_COLORS.violet });
      }
      y += 16;
    });

    domUI.text(panel, w / 2, h - 14, i18n.t('hud.codexClose'), { size: 8, color: UI_COLORS.dim, align: 'center' });
  }

  // ---------------------------------------------------------------- Toast
  showToast(msg: string): void {
    domUI.toast(msg);
  }
}
