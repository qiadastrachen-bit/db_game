# 音频说明（第一期：全程序化占位）

本期**没有任何音频文件**。所有声音由 `src/systems/AudioSystem.ts` 用 Web Audio 振荡器 + 噪声实时合成：

## BGM（`startBgm(kind)`）

| kind | 内容 | 用途 |
|---|---|---|
| `menu` | C2 双失谐正弦 + 五度泛音 + 低通噪声垫 | 主菜单/序章/Staff |
| `field` | A1 低频氛围 loop + 周期性下行三音「哽咽」音簇 | 封面之野 |
| `ending` | G1 更低沉 drone | 结局页 |

## SFX（`playSfx(name)`）

| name | 内容 | 触发 |
|---|---|---|
| `scroll` | 带通噪声扫频（纸面摩擦）+ 三角波 | 律念经卷弹窗展开 |
| `break` | 110→38Hz 低音下坠 + 低频噪声 | 违反律令 |
| `step` | 短噪声 tick（180ms 节流） | 脚步/打字机纸声 |
| `ui` / `confirm` / `cancel` | 方波/三角波 blip | 按钮、确认、取消 |
| `unlock` | 四音上行琶音 | 结局解锁 |
| `midnight` | 220→55Hz 长音下坠 + 噪声 | 午夜降临 |

音量：主音量 + BGM/SFX 分轨，存 `localStorage('sdt_settings_v1')`。

## 替换为真实音频文件的方式

1. 将音频文件放入本目录（`assets/audio/`），建议命名：
   `bgm_menu.ogg` `bgm_field.ogg` `bgm_ending.ogg` `sfx_scroll.ogg` `sfx_break.ogg` `sfx_step.ogg` `sfx_ui.ogg` `sfx_confirm.ogg` `sfx_cancel.ogg` `sfx_unlock.ogg` `sfx_midnight.ogg`
2. 在 `src/assets.ts` 中以 `?url` 导入（与图片相同的方式），导出 `ASSETS.audio`。
3. 在 `BootScene.preload` 中 `this.load.audio(key, url)`。
4. 改造 `AudioSystem`：`startBgm` / `playSfx` 内优先 `scene.sound.play(key)`（Phaser 声音管理器自带音量分组），文件缺失时回退到现有 Web Audio 合成逻辑作为 fallback。

注意：浏览器自动播放策略要求首次用户手势后才能出声，现有 `ensureInit()` 已处理；换 Phaser sound 后由 Phaser 自动处理。
