/**
 * 应用设置路由 — 全局配置的读写入口（当前：AI 内容语言）
 */
import { Hono } from 'hono'
import { getContentLanguage, setContentLanguage, getToursSeen, setToursSeen, getBannedWords, setBannedWords, CONTENT_LANGUAGES, type ContentLanguage } from '../services/app-settings.js'
import { checkLocalNetwork } from '../utils/network-check.js'
import { checkVastAccount, searchBestGPUOffers, listInstances, rentInstance, destroyInstance } from '../services/vastai.js'
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

// POST /vastai/preflight — Cek pod aktif atau ambil rincian penawaran GPU terbaik + saldo akun
app.post('/vastai/preflight', async (c) => {
  const body = await c.req.json().catch(() => null)
  const apiKey = body?.api_key
  const maxBudget = Number(body?.max_budget || 1.2)
  if (!apiKey) return badRequest(c, 'API Key Vast.ai diperlukan')

  const account = await checkVastAccount(apiKey)
  if (!account.ok) {
    return badRequest(c, account.error || 'Gagal memverifikasi akun Vast.ai')
  }

  const instances = await listInstances(apiKey)
  const activeRunning = instances.find(i => i.actual_status === 'running')
  if (activeRunning) {
    return success(c, {
      alreadyRunning: true,
      instance: {
        id: activeRunning.id,
        gpu_name: activeRunning.gpu_name,
        dph_total: activeRunning.dph_total,
        public_ipaddr: activeRunning.public_ipaddr,
        ssh_host: activeRunning.ssh_host,
      },
      credit: account.credit,
      email: account.email,
    })
  }

  const offers = await searchBestGPUOffers(apiKey, maxBudget)
  const bestOffer = offers[0] || null

  return success(c, {
    alreadyRunning: false,
    offer: bestOffer,
    credit: account.credit,
    email: account.email,
  })
})

// GET /vastai/instances — List semua instance aktif milik akun
app.get('/vastai/instances', async (c) => {
  const apiKey = c.req.query('api_key')
  if (!apiKey) return badRequest(c, 'api_key query param diperlukan')
  const instances = await listInstances(apiKey)
  return success(c, { instances })
})

// POST /vastai/rent — Sewa GPU instance dari offer ID yang dipilih
app.post('/vastai/rent', async (c) => {
  const body = await c.req.json().catch(() => null)
  const { api_key: apiKey, offer_id: offerId, image, disk_gb: diskGb } = body ?? {}
  if (!apiKey || !offerId) return badRequest(c, 'api_key dan offer_id diperlukan')
  try {
    const result = await rentInstance(apiKey, Number(offerId), {
      image: image ?? undefined,
      diskGb: diskGb ? Number(diskGb) : undefined,
      runtype: 'ssh',
    })
    return success(c, result)
  } catch (err: any) {
    return badRequest(c, err.message)
  }
})

// DELETE /vastai/instances/:id — Hancurkan instance
app.delete('/vastai/instances/:id', async (c) => {
  const apiKey = c.req.query('api_key')
  const instanceId = Number(c.req.param('id'))
  if (!apiKey) return badRequest(c, 'api_key query param diperlukan')
  if (!instanceId) return badRequest(c, 'Instance ID tidak valid')
  await destroyInstance(apiKey, instanceId)
  return success(c, { destroyed: true, instanceId })
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
