/**
 * 统一错误提示入口 — 把裸技术错误（Failed to fetch / API error 500: {...} /
 * 上游错误码 / ffmpeg 输出 / SDK 英文原文）映射为用户可读的友好文案。
 *
 * - mapError(err, { fallback? }): 返回友好文案（内联展示复用同一函数）
 * - toastError(err, { fallback?, duration? }): toast.error(mapError(...))，错误统一 5s
 * - 后端返回的短中文友好 message（如「镜头不存在」）原样透传
 * - 原始错误不展示，排障走 DevTools（useApi 已 console.error）
 */
import { toast } from 'vue-sonner'
import { i18n } from '~/composables/i18n'
import { mapErrorMessage, MODERATION_RE } from '~/utils/error-mapper'

export { MODERATION_RE }

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params)

/**
 * 错误 → 友好文案。按当前 UI 语言输出，非中文界面不透传后端中文原文。
 */
export function mapError(err: unknown, opts?: { fallback?: string }): string {
  return mapErrorMessage(err, t, i18n.global.locale.value, opts)
}

/** 统一错误 toast（默认 5s，比成功提示长） */
export function toastError(err: unknown, opts?: { fallback?: string; duration?: number }): void {
  toast.error(mapError(err, opts), { duration: opts?.duration ?? 5000 })
}
