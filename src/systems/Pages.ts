/**
 * 拾页：各期通用的「收集闸」约定。
 * flags.pickedPages: string[] —— 已拾取的纸页 id；满 NEED 才能通行页缝。
 */
import { flags } from './context';

export const PAGE_NEED = 3;

/** 封面之野纸页 id（原野 2 + 井底 1） */
export const COVER_PAGES = {
  fieldA: 'cover_field_a',
  fieldB: 'cover_field_b',
  well: 'cover_well_scrap',
} as const;

export function getPickedPages(): string[] {
  return flags.get<string[]>('pickedPages', []);
}

export function hasPickedPage(id: string): boolean {
  return getPickedPages().includes(id);
}

/** @returns true 表示本次新拾取 */
export function pickPage(id: string): boolean {
  const arr = getPickedPages();
  if (arr.includes(id)) return false;
  flags.set('pickedPages', [...arr, id]);
  return true;
}

export function pageCount(): number {
  return getPickedPages().length;
}

export function pagesReady(): boolean {
  return pageCount() >= PAGE_NEED;
}

/** HUD 插值：a/b 计数 + marks 三格（野·野·井） */
export function pagesHudVars(): { a: number; b: number; marks: string } {
  const slot = (id: string) => (hasPickedPage(id) ? '▣' : '▢');
  return {
    a: pageCount(),
    b: PAGE_NEED,
    marks: `${slot(COVER_PAGES.fieldA)}${slot(COVER_PAGES.fieldB)}${slot(COVER_PAGES.well)}`,
  };
}
