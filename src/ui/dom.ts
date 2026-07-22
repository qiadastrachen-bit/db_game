/**
 * DOMUI：DOM 文字覆盖层（根治 Phaser 文字采样问题）。
 * - 覆盖层为 480×270 逻辑坐标系，整体 transform: scale(s) 随 canvas 整数倍放大；
 *   文字是矢量 DOM，任意缩放下都清晰。
 * - 两层：sceneLayer（各场景文本/面板，场景 create 时清空重建）、
 *   hudLayer（封面之野 UI：提示条/对话框/经卷/暂停/Toast）。
 * - pointer-events 默认 none；交互控件（按钮/面板/对话框/遮罩）单独开启 auto。
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { palCss } from '../systems/Palette';

export interface TextOpts {
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  width?: number; // 设置后启用换行（word-break: break-all，CJK 安全）
  lineHeight?: number;
  letterSpacing?: number;
  bold?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export interface ButtonOpts {
  height?: number;
  fontSize?: number;
  selected?: boolean;
  gold?: boolean;
}

export interface TypewriterHandle {
  skip: () => void;
  cancel: () => void;
  readonly done: boolean;
}

class DOMUIImpl {
  private overlay!: HTMLElement;
  private sceneLayer!: HTMLElement;
  private hudLayer!: HTMLElement;
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private inited = false;

  init(): void {
    if (this.inited) return;
    this.overlay = document.getElementById('ui-overlay')!;
    this.sceneLayer = document.createElement('div');
    this.sceneLayer.id = 'layer-scene';
    this.hudLayer = document.createElement('div');
    this.hudLayer.id = 'layer-hud';
    this.overlay.append(this.sceneLayer, this.hudLayer);
    this.inited = true;
  }

  /** 按 canvas 实际显示尺寸同步覆盖层缩放（整数倍，逻辑 480×270 → CSS px） */
  syncLayout(): void {
    if (!this.inited) return;
    const canvas = document.querySelector<HTMLCanvasElement>('#game-root canvas');
    const stage = document.getElementById('stage');
    if (!canvas || !stage) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    stage.style.width = `${rect.width}px`;
    stage.style.height = `${rect.height}px`;
    this.overlay.style.transform = `scale(${rect.width / GAME_WIDTH})`;
  }

  clearScene(): void {
    this.sceneLayer.replaceChildren();
  }

  clearHud(): void {
    this.hudLayer.replaceChildren();
    this.toastEl = null;
    window.clearTimeout(this.toastTimer);
  }

  get scene(): HTMLElement {
    return this.sceneLayer;
  }

  get hud(): HTMLElement {
    return this.hudLayer;
  }

  // ------------------------------------------------------------ 基础图元
  text(parent: HTMLElement, x: number, y: number, content: string, o: TextOpts = {}): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'ui-text' + (o.interactive ? ' interactive' : '');
    el.textContent = content;
    const size = o.size ?? 10;
    el.style.fontSize = `${size}px`;
    el.style.color = o.color ?? palCss('pale');
    el.style.lineHeight = String(o.lineHeight ?? 1.45);
    if (o.letterSpacing) el.style.letterSpacing = `${o.letterSpacing}px`;
    if (o.bold) el.style.fontWeight = '700';
    if (o.width) {
      el.style.width = `${o.width}px`;
      if (o.align === 'center') el.style.left = `${x - o.width / 2}px`;
      else if (o.align === 'right') el.style.left = `${x - o.width}px`;
      else el.style.left = `${x}px`;
      el.style.textAlign = o.align ?? 'left';
    } else {
      el.style.left = `${x}px`;
      if (o.align === 'center') {
        el.style.transform = 'translateX(-50%)';
        el.style.textAlign = 'center';
      } else if (o.align === 'right') {
        el.style.transform = 'translateX(-100%)';
        el.style.textAlign = 'right';
      }
    }
    el.style.top = `${y}px`;
    if (o.interactive && o.onClick) el.addEventListener('click', o.onClick);
    parent.appendChild(el);
    return el;
  }

  button(
    parent: HTMLElement,
    x: number,
    y: number,
    w: number,
    label: string,
    onClick: () => void,
    o: ButtonOpts = {},
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'ui-btn' + (o.selected ? ' selected' : '') + (o.gold ? ' gold' : '');
    b.textContent = label;
    const h = o.height ?? 20;
    b.style.left = `${x - w / 2}px`;
    b.style.top = `${y - h / 2}px`;
    b.style.width = `${w}px`;
    b.style.height = `${h}px`;
    b.style.fontSize = `${o.fontSize ?? 10}px`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    parent.appendChild(b);
    return b;
  }

  panel(parent: HTMLElement, x: number, y: number, w: number, h: number): HTMLDivElement {
    const p = document.createElement('div');
    p.className = 'ui-panel';
    p.style.left = `${x - w / 2}px`;
    p.style.top = `${y - h / 2}px`;
    p.style.width = `${w}px`;
    p.style.height = `${h}px`;
    parent.appendChild(p);
    return p;
  }

  /** 全屏遮罩（拦截点击；clear=true 透明，用于"点击任意处继续"） */
  veil(parent: HTMLElement, opts: { clear?: boolean; onClick?: () => void } = {}): HTMLDivElement {
    const v = document.createElement('div');
    v.className = 'ui-veil' + (opts.clear ? ' clear' : '');
    if (opts.onClick) v.addEventListener('click', opts.onClick);
    parent.appendChild(v);
    return v;
  }

  slider(
    parent: HTMLElement,
    x: number,
    y: number,
    label: string,
    get: () => number,
    set: (v: number) => void,
  ): void {
    this.text(parent, x - 118, y - 7, label, { size: 10, width: 60 });
    const s = document.createElement('input');
    s.type = 'range';
    s.className = 'ui-slider';
    s.min = '0';
    s.max = '100';
    s.value = String(Math.round(get() * 100));
    s.style.left = `${x - 50}px`;
    s.style.top = `${y - 4}px`;
    s.style.width = '100px';
    s.addEventListener('input', () => set(Number(s.value) / 100));
    parent.appendChild(s);
    const val = this.text(parent, x + 56, y - 7, `${Math.round(get() * 100)}`, { size: 9, color: palCss('paper-dim'), width: 26 });
    s.addEventListener('input', () => {
      val.textContent = s.value;
    });
  }

  // ------------------------------------------------------------ 打字机
  /**
   * 在 el 内打字机输出 text；点击/确认时调 skip() 立即补全。
   * 打字中末尾有闪烁光标 ▍。
   */
  typewriter(
    el: HTMLElement,
    text: string,
    opts: { cps?: number; onTick?: () => void; onDone?: () => void } = {},
  ): TypewriterHandle {
    const cps = opts.cps ?? 28;
    let i = 0;
    let finished = false;
    const cursor = document.createElement('span');
    cursor.className = 'ui-cursor';
    cursor.textContent = '▍';
    el.textContent = '';
    el.appendChild(cursor);
    const timer = window.setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      el.appendChild(cursor);
      if (opts.onTick && i % 3 === 0) opts.onTick();
      if (i >= text.length) finish();
    }, 1000 / cps);
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      el.textContent = text;
      opts.onDone?.();
    };
    return {
      skip: finish,
      cancel: () => {
        window.clearInterval(timer);
        finished = true;
      },
      get done() {
        return finished;
      },
    };
  }

  // ------------------------------------------------------------ Toast
  toast(msg: string): void {
    if (this.toastEl) {
      this.toastEl.remove();
      this.toastEl = null;
      window.clearTimeout(this.toastTimer);
    }
    const t = document.createElement('div');
    t.className = 'ui-toast';
    t.textContent = msg;
    t.style.fontSize = '10px';
    t.style.padding = '4px 10px';
    const w = msg.length * 11 + 24;
    t.style.left = `${GAME_WIDTH / 2 - w / 2}px`;
    t.style.top = '24px';
    t.style.width = `${w}px`;
    t.style.opacity = '0';
    this.hudLayer.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = '1';
    });
    this.toastTimer = window.setTimeout(() => {
      t.style.opacity = '0';
      window.setTimeout(() => t.remove(), 300);
    }, 1800);
    this.toastEl = t;
  }
}

export const domUI = new DOMUIImpl();

// 供场景使用的便捷常量
export const UI_COLORS = {
  pale: palCss('pale'),
  dim: palCss('paper-dim'),
  glow: palCss('glow'),
  gold: palCss('gold'),
  violet: palCss('violet'),
  rust: palCss('rust-red'),
  outline: palCss('outline'),
};

export { GAME_WIDTH as UI_W, GAME_HEIGHT as UI_H };
