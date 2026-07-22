# 《蛋与兔 · 碎梦童话》像素美术规范

## 主调色板（16 色）

场景横幅、道具、敌人、tileset 仅使用以下颜色（`assets/gen/palette.py` 为唯一来源）：

| # | 名称 | HEX | 用途 |
|---|------|-----|------|
| 1 | bg_deep | `#0e0a14` | 深夜底色 / 最深暗部（锚点 --bg-deep） |
| 2 | bg_mid | `#1a1224` | 暗部过渡（锚点 --bg-mid） |
| 3 | outline | `#3d2f4a` | **统一 1px 深色描边**（锚点） |
| 4 | violet | `#5a4868` | 暗紫高光 / 剪影亮面 |
| 5 | blood | `#6b3048` | 暗红强调（锚点 --accent-blood） |
| 6 | blood_hi | `#8b4048` | 暗红亮面（蘑菇伞沿、荆棘尖） |
| 7 | gold | `#d4b86a` | 金色强调（锚点 --accent-gold） |
| 8 | gold_hi | `#f0e0a0` | 金色亮面 |
| 9 | glow | `#f8eeb8` | 光源暖白（月 / 蛋光 / 落日核心） |
| 10 | mist | `#7a9ab0` | 雾蓝强调（锚点 --accent-mist） |
| 11 | mist_hi | `#98c0d8` | 雾蓝亮面（井水反光、裂镜） |
| 12 | moss | `#506040` | 苔藓绿 |
| 13 | moss_dark | `#3e5030` | 苔藓暗部 / 森林地面 |
| 14 | pale | `#e8e0d4` | 纸页苍白（锚点 --text-pale） |
| 15 | skin | `#fff0e0` | 暖白高光（月光受光面） |
| 16 | yolk | `#f0c848` | 蛋黄 / 落日核心 |

## 绘制规则

1. **基础像素格 4px**：所有素材按像素网格绘制后用最近邻（NEAREST）×4 放大，禁止双线性缩放。
2. **1px 深色描边**：所有不透明图形外轮廓补 1px `#3d2f4a`（`outline_pass`），与 sprite.js 主角描边逻辑一致。
3. **暗黑童话氛围**：大面积暗部（bg_deep/bg_mid 占 ≥60% 画面）+ 每章唯一光源（glow/yolk/mist）。
4. **使用方式**：CSS 中必须 `image-rendering: pixelated`；存 PNG（不用 WebP 等有损格式）。
5. **渐变只走色带台阶**：垂直渐变按 ≤8 级台阶量化，保留像素画色带感；光晕用同心圆环 + 抖动打散。

## 例外：主角 sprite sheet

`assets/hero/hero-sheet.png` 沿用 `js/sprite.js` 既有的 32 色手工调色板（含肤色、裙绿、发色系），
由 `assets/gen/gen_hero.py` **逐行移植 sprite.js 矩阵逻辑**生成，与运行时手工矩阵像素级一致。
这是有意为之：sheet 与手工矩阵互为 fallback，任何一帧不同都会造成闪烁。

## 目录

```
assets/
  palette.md            本规范
  gen/                  可复跑的生成脚本（python gen_xxx.py）
  banners/              六章场景横幅 400×100 网格 ×4 = 1600×400
  props/                道具 sprite（蘑菇 16² / 井 24² / 镜 16×24 / 麦 24×16 / 月 24²）×4
  enemies/              暗影 2 帧循环 24×24 ×4 + 帧表 JSON
  hero/                 主角 sprite sheet 48×64×26 帧 ×4 + 帧表 JSON
  tiles/                平台/荆棘 tileset 16×16×6 ×4 + 帧表 JSON
```
