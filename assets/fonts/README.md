# 字体说明

## 霞鹜文楷（LXGW WenKai）

- 用途：全游戏 DOM 文字层的首选字体（楷体，契合绘本/经卷气质）。
- 来源：npm 包 `lxgw-wenkai-webfont@1.7.0`（jsdelivr vendor 到本地），作者 Chawye Hsu；字体本体作者 落霞孤鹜（lxgw）。
- 许可：SIL Open Font License 1.1，见 `lxgw/OFL.txt`。
- 结构：`lxgw/style.css`（入口）→ `lxgw/lxgwwenkai-regular.css`（97 个 @font-face 分片）→ `lxgw/files/*.woff2`（共 97 片，约 4.8MB，浏览器按 unicode-range 按需加载）。

## 字体栈

```css
font-family: 'LXGW WenKai', 'Noto Serif SC', 'Microsoft YaHei', serif;
```

字体文件缺失时自动回退系统字体（DOM 渲染下依然清晰）。

## 手动更新/补全

1. 从 https://github.com/chawyehsu/lxgw-wenkai-webfont 或 jsdelivr 下载对应版本；
2. 将 `*-regular.css` 与 `files/` 覆盖到 `lxgw/`；
3. 如需其他字重（light/bold/mono），把对应 css 也在 `style.css` 中 @import。
