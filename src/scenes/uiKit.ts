import Phaser from 'phaser';

/** 共享文本样式（纸页/墨痕/月白基调，禁止大面积渐变） */
export function textStyle(opts: {
  size?: number;
  color?: string;
  align?: string;
  lineSpacing?: number;
}): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Noto Sans SC", "Microsoft YaHei", monospace',
    fontSize: `${opts.size ?? 10}px`,
    color: opts.color ?? '#e8e0d4',
    align: opts.align ?? 'left',
    lineSpacing: opts.lineSpacing ?? 4,
  };
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  selected?: boolean;
}

/** 绘本风文字按钮：边框 1px outline，悬停/选中时月白高亮 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 132;
  const h = opts.height ?? 20;
  const c = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const draw = (hover: boolean, selected: boolean) => {
    bg.clear();
    bg.fillStyle(selected || hover ? 0x1a1224 : 0x16101f, 0.92);
    bg.fillRect(-w / 2, -h / 2, w, h);
    bg.lineStyle(1, selected ? 0xd4b86a : hover ? 0xf8eeb8 : 0x3d2f4a, 1);
    bg.strokeRect(-w / 2, -h / 2, w, h);
  };
  draw(false, opts.selected ?? false);

  const txt = scene.add
    .text(0, 0, label, textStyle({ size: opts.fontSize ?? 10, align: 'center' }))
    .setOrigin(0.5);

  c.add([bg, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true, opts.selected ?? false));
  c.on('pointerout', () => draw(false, opts.selected ?? false));
  c.on('pointerdown', () => onClick());

  (c as Phaser.GameObjects.Container & { setSelected?: (s: boolean) => void }).setSelected = (
    s: boolean,
  ) => draw(false, s);
  return c;
}

export interface SliderOpts {
  width?: number;
  steps?: number;
}

/** 音量滑条：←/→ 或点击调整；返回刷新函数以便外部同步 */
export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  get: () => number,
  set: (v: number) => void,
  opts: SliderOpts = {},
): { container: Phaser.GameObjects.Container; refresh: () => void } {
  const w = opts.width ?? 120;
  const steps = opts.steps ?? 10;
  const c = scene.add.container(x, y);

  const name = scene.add.text(-w / 2 - 56, 0, label, textStyle({ size: 10 })).setOrigin(0, 0.5);
  const track = scene.add.graphics();
  const valueTxt = scene.add
    .text(w / 2 + 8, 0, '', textStyle({ size: 9, color: '#b8b0a2' }))
    .setOrigin(0, 0.5);

  const draw = () => {
    const v = get();
    track.clear();
    track.fillStyle(0x16101f, 0.95);
    track.fillRect(-w / 2, -4, w, 8);
    track.lineStyle(1, 0x3d2f4a, 1);
    track.strokeRect(-w / 2, -4, w, 8);
    track.fillStyle(0xd4b86a, 1);
    track.fillRect(-w / 2 + 1, -3, Math.round((w - 2) * v), 6);
    valueTxt.setText(`${Math.round(v * 100)}`);
  };
  draw();

  c.add([name, track, valueTxt]);
  c.setSize(w + 130, 16);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const localX = p.x - x;
    const v = Phaser.Math.Clamp((localX + w / 2) / w, 0, 1);
    set(Math.round(v * steps) / steps);
    draw();
  });

  return { container: c, refresh: draw };
}

/** 面板外框：纸页暗底 + 1px 描边 + 顶部金色刻度线 */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x0e0a14, 0.94);
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1, 0x3d2f4a, 1);
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1, 0xd4b86a, 0.8);
  g.lineBetween(x - w / 2 + 6, y - h / 2 + 4, x + w / 2 - 6, y - h / 2 + 4);
  g.lineBetween(x - w / 2 + 6, y + h / 2 - 4, x + w / 2 - 6, y + h / 2 - 4);
  return g;
}
