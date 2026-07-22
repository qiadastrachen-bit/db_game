/**
 * Save 系统：localStorage 持久化。
 * 1 个快速存档位（S 键）+ 3 个手动存档位，共 4 页。
 * 存档内容：chapter / flags 全量 / playerPosition / scene / savedAt。
 * 图鉴（结局、律令）另行全局持久化，跨档共享——见 loadGallery/saveGallery。
 */
import { LS_PREFIX } from '../config';
import type { FlagValue } from './FlagsSystem';

export interface SaveData {
  version: 1;
  slot: number; // 0=快速存档，1-3=手动档位
  label: string;
  scene: string; // 场景 key，如 'CoverFieldScene'
  chapter: string;
  flags: Record<string, FlagValue>;
  playerPosition: { x: number; y: number };
  savedAt: number; // epoch ms
}

export interface GalleryData {
  endingsUnlocked: string[];
  rulesRead: string[];
}

const SAVE_KEY = (slot: number) => `${LS_PREFIX}save_${slot}`;
const GALLERY_KEY = `${LS_PREFIX}gallery_v1`;
const SETTINGS_KEY = `${LS_PREFIX}settings_v1`;

export const QUICK_SLOT = 0;
export const MANUAL_SLOTS = [1, 2, 3] as const;
export const ALL_SLOTS = [0, 1, 2, 3] as const;

export class SaveSystem {
  save(slot: number, data: Omit<SaveData, 'slot' | 'version' | 'savedAt'>): boolean {
    try {
      const full: SaveData = { ...data, version: 1, slot, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY(slot), JSON.stringify(full));
      return true;
    } catch (e) {
      console.warn('[SaveSystem] 存档失败', e);
      return false;
    }
  }

  load(slot: number): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY(slot));
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      if (d.version !== 1) return null;
      return d;
    } catch {
      return null;
    }
  }

  list(): (SaveData | null)[] {
    return ALL_SLOTS.map((s) => this.load(s));
  }

  clear(slot: number): void {
    localStorage.removeItem(SAVE_KEY(slot));
  }

  hasAnySave(): boolean {
    return ALL_SLOTS.some((s) => this.load(s) !== null);
  }

  // ---- 图鉴全局持久化（结局画廊 + 律令图鉴，跨存档共享） ----
  loadGallery(): GalleryData {
    try {
      const raw = localStorage.getItem(GALLERY_KEY);
      if (!raw) return { endingsUnlocked: [], rulesRead: [] };
      const d = JSON.parse(raw) as Partial<GalleryData>;
      return {
        endingsUnlocked: Array.isArray(d.endingsUnlocked) ? d.endingsUnlocked : [],
        rulesRead: Array.isArray(d.rulesRead) ? d.rulesRead : [],
      };
    } catch {
      return { endingsUnlocked: [], rulesRead: [] };
    }
  }

  saveGallery(g: GalleryData): void {
    try {
      localStorage.setItem(GALLERY_KEY, JSON.stringify(g));
    } catch (e) {
      console.warn('[SaveSystem] 图鉴写入失败', e);
    }
  }

  // ---- 设置（音量等） ----
  loadSettings(): { master: number; bgm: number; sfx: number } {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<{ master: number; bgm: number; sfx: number }>;
        return {
          master: typeof d.master === 'number' ? d.master : 0.8,
          bgm: typeof d.bgm === 'number' ? d.bgm : 0.7,
          sfx: typeof d.sfx === 'number' ? d.sfx : 0.8,
        };
      }
    } catch {
      /* 忽略 */
    }
    return { master: 0.8, bgm: 0.7, sfx: 0.8 };
  }

  saveSettings(s: { master: number; bgm: number; sfx: number }): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* 忽略 */
    }
  }
}
