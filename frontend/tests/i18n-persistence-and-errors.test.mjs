import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapErrorMessage } from '../app/utils/error-mapper.ts'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const locales = {
  zh: JSON.parse(read('../app/locales/zh.json')),
  en: JSON.parse(read('../app/locales/en.json')),
  ja: JSON.parse(read('../app/locales/ja.json')),
  ko: JSON.parse(read('../app/locales/ko.json')),
}

function makeTranslator(loc) {
  const dict = locales[loc]
  return (key, params) => {
    const parts = key.split('.')
    let cur = dict
    for (const part of parts) cur = cur?.[part]
    if (typeof cur !== 'string') return key
    if (!params) return cur
    return cur.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
  }
}

test('useUnifiedLanguage resolves false on cancel and true on confirm', () => {
  const src = read('../app/composables/useUnifiedLanguage.ts')
  assert.match(src, /let confirmed = false/)
  assert.match(src, /onConfirm:\s*\(\)\s*=>\s*\{\s*confirmed = true;\s*open\.value = false\s*\}/)
  assert.match(src, /onCancel:\s*\(\)\s*=>\s*\{\s*confirmed = false;\s*open\.value = false\s*\}/)
  assert.match(src, /pending\?\.resolve\(confirmed\)/)
})

test('i18n.ts exposes syncLocaleFromBackend and app.vue calls it on mount', () => {
  const i18nSrc = read('../app/composables/i18n.ts')
  const appSrc = read('../app/app.vue')
  assert.match(i18nSrc, /export async function syncLocaleFromBackend\(/)
  assert.match(i18nSrc, /export function isUiLocale\(/)
  assert.match(appSrc, /syncLocaleFromBackend\(\(\) => settingsAPI\.contentLanguage\(\)\)/)
  // Must run before `if (!bridge) return` so both web and desktop sync on startup
  const syncIdx = appSrc.indexOf('syncLocaleFromBackend')
  const bridgeIdx = appSrc.indexOf('if (!bridge) return')
  assert.ok(syncIdx !== -1 && bridgeIdx !== -1 && syncIdx < bridgeIdx)
})

test('mapErrorMessage translates backend Chinese API errors when locale is not zh', () => {
  for (const loc of ['en', 'ja', 'ko']) {
    const t = makeTranslator(loc)
    const notFound = mapErrorMessage(new Error('角色不存在'), t, loc)
    assert.equal(notFound, locales[loc].errors.notFound)
    assert.notEqual(notFound, '角色不存在')
    if (loc === 'en') assert.doesNotMatch(notFound, /[\u4e00-\u9fff]/)

    const noImg = mapErrorMessage(new Error('未配置图片模型，请先到「设置」页添加并启用 AI 服务'), t, loc)
    assert.equal(noImg, locales[loc].errors.noImageModel)

    const dup = mapErrorMessage(new Error('该分镜正在提交任务，请勿重复点击'), t, loc)
    assert.equal(dup, locales[loc].errors.duplicateSubmit)

    // Unmapped short Chinese message with HTTP status falls back to localized status message
    const withStatus = mapErrorMessage(Object.assign(new Error('自定义后端错误'), { status: 400 }), t, loc)
    assert.equal(withStatus, locales[loc].errors.badRequest)
  }

  // In zh locale, short friendly Chinese backend messages still pass through verbatim
  const tZh = makeTranslator('zh')
  assert.equal(mapErrorMessage(new Error('自定义后端错误'), tZh, 'zh'), '自定义后端错误')
})

test('mapErrorMessage maps timeout and AbortError to localized timeout message', () => {
  const abortErr = new Error('The operation was aborted')
  abortErr.name = 'AbortError'

  for (const loc of ['zh', 'en', 'ja', 'ko']) {
    const t = makeTranslator(loc)
    assert.equal(mapErrorMessage(abortErr, t, loc), locales[loc].errors.timeout)
    assert.equal(mapErrorMessage(new Error('Request timed out (ETIMEDOUT)'), t, loc), locales[loc].errors.timeout)
    assert.equal(mapErrorMessage(new Error('生成超时'), t, loc), locales[loc].errors.timeout)
  }
})

test('all four locale files define identical error keys', () => {
  const baseKeys = Object.keys(locales.zh.errors).sort()
  for (const loc of ['en', 'ja', 'ko']) {
    assert.deepEqual(Object.keys(locales[loc].errors).sort(), baseKeys)
  }
})

test('default layout uses i18n app.title and episode polling timeouts show localized toast', () => {
  const layoutSrc = read('../app/layouts/default.vue')
  assert.doesNotMatch(layoutSrc, /<span class="brand-name">火宝短剧<\/span>/)
  assert.match(layoutSrc, /t\('app\.title'\)/)

  const epSrc = read('../app/views/drama/episode.vue')
  const timeoutToasts = epSrc.match(/toast\.warning\(t\('errors\.timeout'\)\)/g) || []
  assert.equal(timeoutToasts.length, 3)
})

