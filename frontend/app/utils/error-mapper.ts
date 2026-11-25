/**
 * 统一错误映射（纯函数，无 UI/Nuxt 依赖，便于单元测试与 useToast 复用）
 *
 * 将技术错误（Failed to fetch / TimeoutError / 5xx）、后端中文业务错误
 * （未配置模型 / 资源不存在 / 参数错误 / 重复提交）映射到当前 UI 语言文案。
 */

export const MODERATION_RE = /sensitive|moderation|真人|人脸|real[\s_-]?person|审核|内容.*(违规|不合规|未通过)|content[\s_-]?policy|risk[\s_-]?control|violation|blocked/i

const NETWORK_RE = /failed to fetch|network ?error|load failed|network request failed|fetch failed|econnrefused|enotfound/i
const NONJSON_RE = /unexpected token|not valid json|failed to parse/i
const SERVER5XX_RE = /(^|\D)5\d{2}(\D|$)|internal server error|服务器内部错误/i
const AUTH_RE = /(^|\D)40[13](\D|$)|unauthorized|forbidden|invalid[\s_-]?api[\s_-]?key|authentication|鉴权/i
const RATELIMIT_RE = /(^|\D)429(\D|$)|rate[\s_-]?limit|too many requests|quota|额度不足|insufficient/i
const TIMEOUT_RE = /timeout|timed out|polling exceeded|etimedout|econnaborted|request aborted|超时/i

/** 技术特征：出现即判定不可直接透传给用户 */
const TECHY_RE = /[{}\[\]<>]|https?:\/\/|\b(error|errno|exception|code|stack|undefined|null)\b|[a-z]+_[a-z]+/i
const CJK_RE = /[\u4e00-\u9fff]/

const BACKEND_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/未配置图片模型|未找到启用的图片生成配置/, 'errors.noImageModel'],
  [/未配置视频模型|未找到启用的视频生成配置/, 'errors.noVideoModel'],
  [/未配置文本模型|未找到启用的文本/, 'errors.noTextModel'],
  [/正在提交任务|请勿重复点击/, 'errors.duplicateSubmit'],
  [/角色不存在|剧集不存在|镜头不存在|分镜不存在|场景不存在|道具不存在|剧本不存在|Agent 不存在|资源不存在/i, 'errors.notFound'],
  [/最终提示词生成失败/, 'errors.promptFailed'],
  [/Agent 执行失败|无效的 Agent 类型|未知的 Agent 类型/i, 'errors.agentFailed'],
  [/不能超过\s*\d+\s*MB|file too large|exceeds.*size/i, 'errors.uploadTooLarge'],
  [/unsupported.*type|不支持的.*类型|格式不支持/i, 'errors.unsupportedType'],
  [/请求参数错误|必填|必须为|必须是|无效的|不支持的/, 'errors.badRequest'],
]

export type ErrorTranslator = (key: string, params?: Record<string, unknown>) => string

function messageOf(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message || String(err)
  const anyErr = err as { message?: unknown; error_msg?: unknown; errorMsg?: unknown }
  return String(anyErr.message ?? anyErr.error_msg ?? anyErr.errorMsg ?? err)
}

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const s = (err as { status?: unknown }).status
  return typeof s === 'number' && Number.isFinite(s) ? s : undefined
}

function isTimeoutError(err: unknown, msg: string): boolean {
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return true
  return TIMEOUT_RE.test(msg)
}

/**
 * 错误 → 当前语言的友好文案。
 * - 非中文环境下不透传后端中文原文，统一经由映射表或状态码翻译。
 */
export function mapErrorMessage(
  err: unknown,
  t: ErrorTranslator,
  locale: string,
  opts?: { fallback?: string },
): string {
  const msg = messageOf(err).trim()
  const status = statusOf(err)

  if (!msg && !status) return opts?.fallback ? t(opts.fallback) : t('errors.unknown')

  if (NETWORK_RE.test(msg)) return t('errors.network')
  if (err instanceof SyntaxError || NONJSON_RE.test(msg)) return t('errors.server')
  if (MODERATION_RE.test(msg)) return t('errors.moderation')
  if (AUTH_RE.test(msg) || status === 401 || status === 403) return t('errors.auth')
  if (RATELIMIT_RE.test(msg) || status === 429) return t('errors.rateLimit')
  if (SERVER5XX_RE.test(msg) || (status !== undefined && status >= 500)) return t('errors.unavailable')
  if (isTimeoutError(err, msg) || status === 408 || status === 504) return t('errors.timeout')

  for (const [pattern, key] of BACKEND_ERROR_PATTERNS) {
    if (pattern.test(msg)) return t(key)
  }

  // 仅中文界面透传后端短中文业务提示
  if (locale === 'zh' && msg.length <= 40 && CJK_RE.test(msg) && !TECHY_RE.test(msg)) return msg

  if (/^\d{3}$/.test(msg)) {
    const code = Number(msg)
    if (code === 404) return t('errors.notFound')
    if (code === 400) return t('errors.badRequest')
    return t('errors.requestFailed', { status: msg })
  }

  if (status !== undefined) {
    if (status === 404) return t('errors.notFound')
    if (status === 400) return t('errors.badRequest')
    return t('errors.requestFailed', { status: String(status) })
  }

  return opts?.fallback ? t(opts.fallback) : t('errors.unknown')
}
