/**
 * 调色板工具：把 src/data/palette.json 注入为 CSS 变量（--c-<name>），
 * 并提供 hex → number 的转换给 Phaser 使用。单一数据源，避免双写漂移。
 */
import paletteData from '../data/palette.json';

export interface PaletteColor {
  name: string;
  hex: string;
  usage: string;
}

export const PALETTE: PaletteColor[] = (paletteData as { colors: PaletteColor[] }).colors;

/** name → 0xRRGGBB（Phaser 用） */
export function pal(name: string): number {
  const c = PALETTE.find((x) => x.name === name);
  if (!c) throw new Error(`调色板缺少颜色: ${name}`);
  return parseInt(c.hex.slice(1), 16);
}

/** name → '#rrggbb' 字符串（Phaser Text style 用） */
export function palCss(name: string): string {
  const c = PALETTE.find((x) => x.name === name);
  if (!c) throw new Error(`调色板缺少颜色: ${name}`);
  return c.hex;
}

/** 注入 / 校验 CSS 变量，供 index.html 与未来 DOM UI 使用 */
export function injectPaletteCssVars(): void {
  const root = document.documentElement;
  for (const c of PALETTE) {
    root.style.setProperty(`--c-${c.name}`, c.hex);
  }
}
