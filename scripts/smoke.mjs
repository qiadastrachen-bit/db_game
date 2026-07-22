/**
 * 冒烟检查（纯静态，不启动任何服务器、不留后台进程）：
 *  1. dist/ 产物存在且 index.html 引用了构建后的 JS；
 *  2. 关键数据 JSON 可解析（律令/结局/序章/对话/调色板/i18n）；
 *  3. 律令引用的结局 id 在结局目录中存在。
 * 用法：npm run build && npm run smoke
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

// 1. dist 产物
ok(existsSync(join(root, 'dist/index.html')), 'dist/index.html 存在');
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
ok(/assets\/index-.*\.js/.test(html), 'index.html 引用了构建 JS');
ok(readdirSync(join(root, 'dist/assets')).some((f) => f.endsWith('.js')), 'dist/assets 含 JS chunk');

// 2. 数据 JSON 可解析
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const rules = read('src/data/rules.zh.json').rules;
const endings = read('src/data/endings.zh.json').endings;
const dialogs = read('src/data/dialogs.zh.json');
read('src/data/prologue.zh.json');
read('src/data/palette.json');
const zh = read('i18n/zh.json');
ok(true, '全部数据 JSON 可解析');
const mainRules = rules.filter((r) => !r.footnote);
const footnotes = rules.filter((r) => r.footnote);
ok(mainRules.length === 5, `明文主律 = 5（实际 ${mainRules.length}）`);
ok(footnotes.length === 2, `页边注脚 = 2（实际 ${footnotes.length}）`);
ok(rules.length === 7, `律令总数 = 7（实际 ${rules.length}）`);
ok(endings.length === 2, `结局数量 = 2（实际 ${endings.length}）`);
ok(
  footnotes.every((r) => r.id === 'cover_no_well' || r.id === 'cover_no_mushroom'),
  '注脚 id 为 cover_no_well / cover_no_mushroom',
);

// 3. 律令 → 结局引用完整
const endingIds = new Set(endings.map((e) => e.id));
for (const r of rules) {
  ok(endingIds.has(r.onBreak.outcomeId), `律令 ${r.id} 的结局 ${r.onBreak.outcomeId} 存在`);
}

// 4. DOM UI 架构回归
const src = (p) => readFileSync(join(root, p), 'utf8');
const indexHtml = src('index.html');
ok(indexHtml.includes('justify-content: center'), 'index.html 画布 flex 居中');
ok(indexHtml.includes('ui-overlay'), 'index.html 含 DOM 覆盖层');
const mainTs = src('src/main.ts');
ok(mainTs.includes('domUI.init') && mainTs.includes('applyIntegerZoom'), 'main.ts DOM UI + 整数倍缩放');
ok(!mainTs.includes('pixelArt: true') && mainTs.includes('antialias: true'), 'main.ts 关闭 pixelArt 全局模式');
ok(!/image-rendering:\s*pixelated\s*;/.test(indexHtml), 'index.html canvas 不再全局 pixelated');

const cf = src('src/scenes/CoverFieldScene.ts');
ok(cf.includes('domUI.clearScene()'), 'CoverFieldScene 进入时清空 scene DOM');
ok(cf.includes('midnightStarted = true'), 'CoverFieldScene 读档恢复午夜不重播');
ok(cf.includes('JustDown(this.qKey)'), 'CoverFieldScene Q 键快速存档');
ok(cf.includes('ui:loadSlot') && cf.includes('onLoadSlot'), 'CoverFieldScene 游戏内读档处理');
ok(!cf.includes("add.text("), 'CoverFieldScene 画布无 add.text');
ok(cf.includes('playDeathFx') && cf.includes('onWellInteract') && cf.includes('onMushroomInteract'), 'CoverFieldScene 分死因 + 井/蕈交互');
ok(cf.includes('buildFieldPages') && cf.includes('pagesReady') && cf.includes('enterWellDive'), 'CoverFieldScene 拾页闸门 + 井心坠入');
ok(cf.includes('buildSavePoints') && cf.includes('openSaveDesk'), 'CoverFieldScene 纸页记事存档点');

const wellDive = src('src/scenes/WellDiveScene.ts');
ok(wellDive.includes('WellDiveScene') && wellDive.includes('COVER_PAGES.well'), 'WellDiveScene 井底小游戏存在');
ok(wellDive.includes("'ink'") && wellDive.includes("'ember'") && wellDive.includes('gateOpen') && wellDive.includes('mover.move'), 'WellDiveScene 含双危害/开关门/移动平台');
ok(mainTs.includes('WellDiveScene'), 'main.ts 注册 WellDiveScene');

const pagesSys = src('src/systems/Pages.ts');
ok(pagesSys.includes('PAGE_NEED') && pagesSys.includes('pickedPages'), 'Pages 拾页模块');

const deathFx = src('src/systems/DeathFX.ts');
const deathKinds = [
  'cover_midnight_grass',
  'cover_no_moon',
  'cover_rabbit_freeze',
  'cover_no_signpost',
  'cover_watch_step',
  'cover_no_well',
  'cover_no_mushroom',
];
ok(
  deathKinds.every((k) => deathFx.includes(k)),
  'DeathFX 覆盖全部 7 种死因',
);

const ui = src('src/scenes/UIScene.ts');
ok(ui.includes('showLoadSlotsPanel') && ui.includes('loadSlots'), 'UIScene 游戏内读档面板');
ok(ui.includes('abortCurrentScroll') && ui.includes('releaseEncounter'), 'UIScene 经卷中断回滚');
ok(ui.includes('footnoteKicker') && ui.includes('mainByRealm'), 'UIScene 经卷/图鉴区分注脚');
ok(ui.includes('pages:changed') && ui.includes('hud.pages'), 'UIScene 拾页 HUD');
ok(ui.includes('showSaveDesk') && ui.includes('saveAtPoint'), 'UIScene 纸页记事台 + 暂停无随地写入');
ok(!ui.includes("on('keydown-S'"), 'UIScene 不再重复监听 S 键');

const rulesSys = src('src/systems/RulesSystem.ts');
ok(rulesSys.includes('footnotesByRealm') && rulesSys.includes('mainByRealm'), 'RulesSystem 主律/注脚分组');

const menu = src('src/scenes/MenuScene.ts');
ok(menu.includes('menu.close') && menu.includes('menu.escBack'), 'MenuScene 面板 ✕ 关闭按钮 + Esc 提示');
ok(menu.includes('domUI.clearScene()'), 'MenuScene 离场清空 scene DOM');

const dialogSys = src('src/systems/DialogSystem.ts');
ok(dialogSys.includes('pending') && dialogSys.includes('reset()'), 'DialogSystem 排队防重入 + reset');

const rabbit = src('src/entities/Rabbit.ts');
ok(rabbit.includes('pendingStare'), 'Rabbit 凝视延迟到 UI 解除阻塞');

const endingsSys = src('src/systems/EndingsSystem.ts');
ok(endingsSys.includes('seedFromGallery') && !/for \(const id of g\.rulesRead\)/.test(endingsSys), 'seedFromGallery 不再写入本档律令已读');

const player = src('src/entities/Player.ts');
ok(player.includes('KeyCodes.W') && player.includes('KeyCodes.A') && player.includes('KeyCodes.D'), 'Player 支持 WASD');

const interactable = src('src/entities/Interactable.ts');
ok(interactable.includes('uiGate.blocked') && interactable.includes('dialog.active'), 'Interactable 点击检查 UI 门闩');

const boot = src('src/scenes/BootScene.ts');
ok(boot.includes('Phaser.Textures.FilterMode.NEAREST') && boot.includes('applyNearestFilter'), 'BootScene 统一 NEAREST 过滤函数');

const ctx = src('src/systems/context.ts');
ok(ctx.includes('lastClosedAt') && ctx.includes('justClosed'), 'uiGate justClosed 防穿透窗口');
ok(cf.includes('uiGate.justClosed') && cf.includes('dialog.active'), 'CoverFieldScene pointerdown 三重防穿透守卫');

// 5. i18n 键
ok(zh.menu.close === '✕ 关闭' && zh.hud.quickSaved === '已存入快速存档' && typeof zh.pause.load === 'string', 'i18n 基础键');
ok(typeof zh.hud.pageRift === 'string' && typeof zh.hud.restored === 'string' && typeof zh.hud.codexClose === 'string', 'i18n 新增键（pageRift/restored/codexClose）');
ok(zh.settings.hint.includes('拖动'), '设置提示与滑条行为一致');
ok(zh.hud.keys.includes('WASD') && zh.hud.keys.includes('Q'), 'HUD 键位说明含 WASD/Q');
ok(typeof zh.ruleScroll.footnoteKicker === 'string' && typeof zh.gallery.footnotes === 'string', 'i18n 注脚相关键');

// 6. 旁白对话已接入
ok(typeof dialogs.signpost_whisper !== 'undefined' && typeof dialogs.moon_whisper !== 'undefined', '指示牌/残月旁白数据存在');
ok(typeof dialogs.well_whisper !== 'undefined' && typeof dialogs.mushroom_whisper !== 'undefined', '井/蕈旁白数据存在');
ok(typeof dialogs.exit_need_pages !== 'undefined', '缺页页缝旁白存在');
ok(cf.includes('signpost_whisper') && cf.includes('moon_whisper'), 'CoverFieldScene 接入旁白对话');
ok(cf.includes('well_whisper') && cf.includes('mushroom_whisper'), 'CoverFieldScene 接入井/蕈旁白');
ok(typeof zh.hud.pages === 'string' && zh.hud.pages.includes('{a}'), 'i18n 拾页 HUD 键');

if (failed > 0) {
  console.error(`\n冒烟检查失败：${failed} 项`);
  process.exit(1);
}
console.log('\n冒烟检查全部通过 ✓');
