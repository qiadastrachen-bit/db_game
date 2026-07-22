/**
 * Rules 系统：律令数据全部来自 src/data/rules.zh.json（JSON 驱动，不硬编码文本）。
 * - encounter(id)：律令首次出现 → 广播 'rule:scroll' 由 UIScene 弹出经卷弹窗；
 *   确认后 confirmRead() 录入图鉴（J 键查看）。
 * - break(id)：违反 → 写入 brokeRule_* 并返回 onBreak 结局负载，由场景执行结算。
 * - footnote：页边注脚（不计入入口五律，经卷/图鉴单独分组）。
 */
import Phaser from 'phaser';
import rulesData from '../data/rules.zh.json';
import type { FlagsSystem } from './FlagsSystem';
import type { SaveSystem } from './SaveSystem';

export interface RuleTrigger {
  type: 'interact' | 'zone' | 'event' | 'timed';
  targetId?: string;
  condition?: string;
}

export interface RuleOnBreak {
  outcomeId: string;
  fadeMessage: string;
}

export interface Rule {
  id: string;
  realm: string;
  severity: 'hard' | 'soft';
  title: string;
  body: string;
  trigger: RuleTrigger;
  onBreak: RuleOnBreak;
  /** 页边注脚：非入口明文五律 */
  footnote?: boolean;
}

export class RulesSystem {
  readonly events = new Phaser.Events.EventEmitter();
  private rules: Rule[] = (rulesData as unknown as { rules: Rule[] }).rules;
  private encountered = new Set<string>(); // 本轮已弹过经卷的律令

  constructor(
    private flags: FlagsSystem,
    private saves: SaveSystem,
  ) {}

  all(): Rule[] {
    return this.rules;
  }

  get(id: string): Rule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  byRealm(realm: string): Rule[] {
    return this.rules.filter((r) => r.realm === realm);
  }

  /** 入口明文主律（非注脚） */
  mainByRealm(realm: string): Rule[] {
    return this.byRealm(realm).filter((r) => !r.footnote);
  }

  /** 页边注脚 */
  footnotesByRealm(realm: string): Rule[] {
    return this.byRealm(realm).filter((r) => !!r.footnote);
  }

  /** 律令在场景中的序号（主律/注脚各自从 1 计） */
  pageOf(id: string): number {
    const rule = this.get(id);
    if (!rule) return 0;
    const list = rule.footnote ? this.footnotesByRealm(rule.realm) : this.mainByRealm(rule.realm);
    const idx = list.findIndex((r) => r.id === id);
    return idx >= 0 ? idx + 1 : 0;
  }

  /** 同组总数（主律组或注脚组） */
  groupTotal(id: string): number {
    const rule = this.get(id);
    if (!rule) return 0;
    return rule.footnote ? this.footnotesByRealm(rule.realm).length : this.mainByRealm(rule.realm).length;
  }

  /** 本轮是否已触发过该律（含经卷未确认被中断后释放前） */
  wasEncountered(id: string): boolean {
    return this.encountered.has(id);
  }

  /**
   * 律令首次"出现"（接近/相关事件触发）时调用。
   * 返回 true 表示本次需要弹经卷；同一轮内只弹一次；已录入图鉴的律令不再重复弹。
   */
  encounter(id: string): boolean {
    if (this.encountered.has(id)) return false;
    this.encountered.add(id);
    if (this.flags.hasReadRule(id)) return false; // 图鉴已读 → 不重复弹
    const rule = this.get(id);
    if (rule) this.events.emit('scroll', rule);
    return true;
  }

  /**
   * 经卷被其它模态强制挤掉且未确认时回滚：未读律可再次 encounter。
   * 已 confirmRead 的不回滚。
   */
  releaseEncounter(id: string): void {
    if (this.flags.hasReadRule(id)) return;
    this.encountered.delete(id);
  }

  /** 玩家在经卷弹窗上确认 → 录入图鉴（flags + 全局图鉴持久化） */
  confirmRead(id: string): void {
    this.flags.markRuleRead(id);
    const g = this.saves.loadGallery();
    if (!g.rulesRead.includes(id)) {
      g.rulesRead.push(id);
    }
    this.saves.saveGallery(g);
  }

  /** 违反律令：写入 brokeRule_*，返回结局负载 */
  break(id: string): RuleOnBreak | null {
    const rule = this.get(id);
    if (!rule) return null;
    this.flags.markRuleBroken(id);
    this.events.emit('broken', rule);
    return rule.onBreak;
  }

  /** 新一轮翻阅时重置"已弹过"记录（图鉴已读状态不受影响） */
  resetEncountered(): void {
    this.encountered.clear();
  }
}
