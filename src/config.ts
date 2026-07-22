/** 全局常量：逻辑分辨率 480×270，整数倍放大由 main.ts 控制 */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/** 逻辑地块尺寸（tileset 源图为 64px/块 = 16px × 4 倍渲染） */
export const TILE = 16;

/** 主角精灵表源帧尺寸（192×256 = 48×64 × 4 倍渲染） */
export const HERO_FRAME_W = 192;
export const HERO_FRAME_H = 256;
/** 主角在场景中的显示缩放：192×256 × 0.125 = 24×32 逻辑像素 */
export const HERO_SCALE = 0.125;

/** localStorage 键前缀 */
export const LS_PREFIX = 'sdt_';
