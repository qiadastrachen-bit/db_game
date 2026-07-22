/**
 * I18n 系统：首版仅中文（i18n/zh.json），结构预留多语言。
 * t('menu.start') 点路径取值；支持 {n} 占位替换。
 */
import zh from '../../i18n/zh.json';

type Dict = Record<string, unknown>;

export class I18nSystem {
  private dict: Dict = zh as unknown as Dict;
  readonly locale = 'zh';

  t(key: string, vars?: Record<string, string | number>): string {
    let node: unknown = this.dict;
    for (const part of key.split('.')) {
      if (node && typeof node === 'object' && part in (node as Dict)) {
        node = (node as Dict)[part];
      } else {
        return key; // 缺键时原样返回，便于排查
      }
    }
    let s = typeof node === 'string' ? node : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  }
}
