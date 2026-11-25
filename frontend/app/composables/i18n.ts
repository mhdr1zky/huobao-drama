/**
 * i18n 实例（模块级单例）
 * - 实例放独立模块而非插件内：useAgent/useMigrateState 等 setup 外代码
 *   需要 `import { i18n }` 直接用 i18n.global.t
 * - ssr:false，模块顶层读 localStorage 安全；UI 语言偏好持久化 huobao:locale
 * - legacy:false 必须显式，否则 global.locale 不是 ref 无法运行时切换
 */
import { createI18n } from 'vue-i18n'
import zh from '../locales/zh.json'
import en from '../locales/en.json'
import ja from '../locales/ja.json'
import ko from '../locales/ko.json'

export const LOCALE_STORAGE_KEY = 'huobao:locale'

export type UiLocale = 'zh' | 'en' | 'ja' | 'ko'

export const UI_LOCALES: Array<{ value: UiLocale; label: string }> = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

export function isUiLocale(v: unknown): v is UiLocale {
  return typeof v === 'string' && UI_LOCALES.some(l => l.value === v)
}

export function readStoredLocale(): UiLocale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isUiLocale(v)) return v
  } catch { /* localStorage 不可用时回退默认 */ }
  return 'en'
}

export function persistLocale(locale: UiLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch { /* 忽略持久化失败 */ }
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'en',
  messages: { zh, en, ja, ko },
  missingWarn: false,
  fallbackWarn: false,
})

/** 切换 UI 语言并持久化（LocaleSwitcher 与初始化共用） */
export function setUiLocale(locale: UiLocale) {
  i18n.global.locale.value = locale
  persistLocale(locale)
}

/**
 * 启动时从后端 SQLite 同步语言偏好。
 * 桌面端每次启动端口随机变化，localStorage 会重置，故以后端 content_language 为准。
 */
export async function syncLocaleFromBackend(
  fetcher: () => Promise<{ language?: string } | null | undefined>,
): Promise<UiLocale | null> {
  try {
    const res = await fetcher()
    const lang = res?.language
    if (isUiLocale(lang)) {
      if (i18n.global.locale.value !== lang) setUiLocale(lang)
      else persistLocale(lang)
      return lang
    }
  } catch { /* 启动期后端暂不可达时不阻断渲染 */ }
  return null
}
