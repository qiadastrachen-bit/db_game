# 素材清单与占位说明

## 真实素材（来自上级 `assets/` 目录，已拷贝进本项目）

| 路径 | 内容 | 用法 |
|---|---|---|
| `tilesets/tileset.png` + `.json` | 地块图集（64px/块 = 16px×4 倍，6 帧：草/土/石/荆棘/木/碎片） | 封面之野地面 |
| `sprites/hero-sheet.png` + `.json` | 主角精灵表（帧 192×256 = 48×64×4 倍；行 0 idle×4、行 1 walk×8） | 玩家角色 |
| `objects/well.png` | 井（96×96） | 场景装饰 |
| `objects/wheat.png` | 麦子（96×64） | 哽咽植被（午夜染色为灰绿） |
| `objects/mushroom.png` | 蘑菇（64×64） | 场景装饰 |
| `objects/mirror.png` / `moon.png` | 镜子 / 月亮 | 本期备用（第二期使用） |
| `banners/*.png`（cover/dawn/field/forest/mirror/paths，1600×400） | 章节过场横幅 | 菜单/序章/结局背景 |
| `palette.md` | 美术规范（16 色主调色板） | `src/data/palette.json` 的基准 |

## 程序化占位纹理（BootScene 运行时生成，无 PNG 文件）

| 纹理 key | 内容 | 替换方式 |
|---|---|---|
| `rabbit` | 兔子两帧（眨眼/凝视）32×20 | 画好后放入 `assets/sprites/rabbit-sheet.png`，在 `BootScene.preload` 改为 load.spritesheet |
| `signpost` | 指示牌 20×28 | `assets/objects/signpost.png` |
| `claw-mark` | 路面爪印花纹 16×16 | `assets/objects/claw-mark.png` |
| `claw-sil` | 大爪印剪影 64×64（结局画廊锁定占位 + 坏结局静帧） | `assets/objects/claw-sil.png` |
| `moon-frag` | 残月角 36×36 | `assets/objects/moon-frag.png` |
| `star` / `noise` / `page-rift` | 星星 / 纸纹噪点 / 页缝 | 同名 PNG 放入 `assets/objects/` 后在 preload 加载 |

替换后删除 `BootScene.makePlaceholderTextures` 中对应的生成块即可。

## 音频

全部为 Web Audio 程序化占位（无音频文件），替换路径见 `assets/audio/README.md`。
