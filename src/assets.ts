/**
 * 静态资源清单：统一以 ?url 导入，Vite 构建时会拷贝进 dist 并返回最终 URL，
 * 保证 dist/ 可独立静态部署。Phaser 通过 ASSETS 中的 URL 加载。
 */
import tilesetUrl from '../assets/tilesets/tileset.png?url';
import heroSheetUrl from '../assets/sprites/hero-sheet.png?url';
import propMirrorUrl from '../assets/objects/mirror.png?url';
import propMoonUrl from '../assets/objects/moon.png?url';
import propMushroomUrl from '../assets/objects/mushroom.png?url';
import propWellUrl from '../assets/objects/well.png?url';
import propWheatUrl from '../assets/objects/wheat.png?url';
import bannerCoverUrl from '../assets/banners/cover.png?url';
import bannerDawnUrl from '../assets/banners/dawn.png?url';
import bannerFieldUrl from '../assets/banners/field.png?url';
import bannerForestUrl from '../assets/banners/forest.png?url';
import bannerMirrorUrl from '../assets/banners/mirror.png?url';
import bannerPathsUrl from '../assets/banners/paths.png?url';

export const ASSETS = {
  tileset: tilesetUrl,
  heroSheet: heroSheetUrl,
  props: {
    mirror: propMirrorUrl,
    moon: propMoonUrl,
    mushroom: propMushroomUrl,
    well: propWellUrl,
    wheat: propWheatUrl,
  },
  banners: {
    cover: bannerCoverUrl,
    dawn: bannerDawnUrl,
    field: bannerFieldUrl,
    forest: bannerForestUrl,
    mirror: bannerMirrorUrl,
    paths: bannerPathsUrl,
  },
} as const;

export type BannerKey = keyof typeof ASSETS.banners;
