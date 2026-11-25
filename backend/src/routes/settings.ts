/**
 * 应用设置路由 — 全局配置的读写入口（当前：AI 内容语言）
 */
import { Hono } from 'hono'
import { getContentLanguage, setContentLanguage, getToursSeen, setToursSeen, getBannedWords, setBannedWords, CONTENT_LANGUAGES, type ContentLanguage } from '../services/app-settings.js'
import { checkLocalNetwork } from '../utils/network-check.js'
import { checkVastAccount, searchBestGPUOffers } from '../services/vastai.js'
import { success, badRequest } from '../utils/response.js'

const app = new Hono()

// GET /network-check — Diagnostik koneksi internet PC lokal
app.get('/network-check', async (c) => {
  const result = await checkLocalNetwork()
  return success(c, result)
})

// POST /vastai/check — Periksa saldo akun & koneksi Vast.ai
app.post('/vastai/check', async (c) => {
  const body = await c.req.json().catch(() => null)
  const apiKey = body?.api_key
  if (!apiKey) return badRequest(c, 'API Key Vast.ai diperlukan')
  const info = await checkVastAccount(apiKey)
  return success(c, info)
})

// POST /vastai/offers — Cari penawaran GPU terbaik
app.post('/vastai/offers', async (c) => {
  const body = await c.req.json().catch(() => null)
  const apiKey = body?.api_key
  const maxBudget = Number(body?.max_budget || 1.2)
  if (!apiKey) return badRequest(c, 'API Key Vast.ai diperlukan')
  const offers = await searchBestGPUOffers(apiKey, maxBudget)
  return success(c, { offers })
})

// GET /content-language — 当前 AI 内容语言
app.get('/content-language', async (c) => {
  return success(c, { language: await getContentLanguage() })
})

// PUT /content-language — 设置 AI 内容语言（body: { language: 'zh'|'en'|'ja'|'ko' }）
app.put('/content-language', async (c) => {
  const body = await c.req.json().catch(() => null)
  const language = body?.language
  if (!(CONTENT_LANGUAGES as readonly string[]).includes(language)) {
    return badRequest(c, `language 必须是 ${CONTENT_LANGUAGES.join(' / ')} 之一`)
  }
  const saved = await setContentLanguage(language as ContentLanguage)
  return success(c, { language: saved })
})

// GET /tours-seen — 已看过的引导漫游 id 列表
app.get('/tours-seen', async (c) => {
  return success(c, { seen: await getToursSeen() })
})

// PUT /tours-seen — 写入已看过的引导漫游 id 列表（body: { seen: string[] }）
app.put('/tours-seen', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!Array.isArray(body?.seen) || !body.seen.every((v: unknown) => typeof v === 'string')) {
    return badRequest(c, 'seen 必须是字符串数组')
  }
  return success(c, { seen: await setToursSeen(body.seen) })
})

// GET /banned-words — AI 改写屏蔽词 [{ word, replace }]
app.get('/banned-words', async (c) => success(c, { words: getBannedWords() }))

// PUT /banned-words — 覆盖保存（body: { words: [{ word, replace? }] }）
app.put('/banned-words', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!Array.isArray(body?.words)) return badRequest(c, 'words 必须是数组')
  return success(c, { words: setBannedWords(body.words) })
})

export default app
