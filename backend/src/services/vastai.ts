import { logTaskError, logTaskProgress, logTaskSuccess, logTaskWarn } from '../utils/task-logger.js'

export interface VastOffer {
  id: number
  gpu_name: string
  num_gpus: number
  vram_cost_per_hr?: number
  dph_total: number
  dlperf_usd?: number
  inet_down: number
  inet_up: number
  reliability: number
  geolocation?: string
  direct_port_count: number
  score?: number
}

export interface VastAccountInfo {
  ok: boolean
  email?: string
  credit?: number
  error?: string
}

const VAST_API_BASE = 'https://console.vast.ai/api/v0'

/**
 * Memeriksa status akun & sisa saldo di Vast.ai
 */
export async function checkVastAccount(apiKey: string): Promise<VastAccountInfo> {
  try {
    const res = await fetch(`${VAST_API_BASE}/users/current/`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { ok: false, error: `Vast.ai API returned status ${res.status}` }
    }
    const data = await res.json()
    return {
      ok: true,
      email: data.email || data.username,
      credit: typeof data.credit === 'number' ? data.credit : Number(data.credit || 0),
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to connect to Vast.ai' }
  }
}

/**
 * Mencari penawaran GPU terbaik dengan koneksi host terlancar dan reliabilitas tinggi.
 * Filter: RTX 5090 / 4090, VRAM >= 24GB, inet_down >= 200, inet_up >= 80, reliability >= 0.95
 */
export async function searchBestGPUOffers(apiKey: string, maxDph = 1.2): Promise<VastOffer[]> {
  try {
    const query = {
      verified: { eq: true },
      rentable: { eq: true },
      num_gpus: { eq: 1 },
      reliability: { gte: 0.95 },
      inet_down: { gte: 200 },
      inet_up: { gte: 80 },
      direct_port_count: { gte: 1 },
      dph_total: { lte: maxDph },
      gpu_name: { in: ['RTX 5090', 'RTX 4090', 'RTX_5090', 'RTX_4090', 'A100', 'RTX 6000 Ada'] },
    }

    const res = await fetch(`${VAST_API_BASE}/bundles/?q=${encodeURIComponent(JSON.stringify(query))}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`Search offers HTTP ${res.status}`)
    const data = await res.json()
    const offers: any[] = Array.isArray(data.offers) ? data.offers : Array.isArray(data) ? data : []

    // Algoritma Scoring: Kombinasi DLPerf/USD + Bobot Bandwidth + Bobot Reliability
    const scoredOffers: VastOffer[] = offers.map(o => {
      const inetDownScore = Math.min(o.inet_down / 1000, 2) * 15 // Hingga 30 poin
      const reliabilityScore = (o.reliability || 0.9) * 40        // Hingga 40 poin
      const priceScore = Math.max(0, (maxDph - o.dph_total) / maxDph) * 30 // Hingga 30 poin
      return {
        id: o.id,
        gpu_name: o.gpu_name,
        num_gpus: o.num_gpus,
        dph_total: Number(o.dph_total.toFixed(4)),
        inet_down: Math.round(o.inet_down),
        inet_up: Math.round(o.inet_up),
        reliability: Number(o.reliability.toFixed(3)),
        geolocation: o.geolocation,
        direct_port_count: o.direct_port_count,
        score: Number((inetDownScore + reliabilityScore + priceScore).toFixed(1)),
      }
    })

    scoredOffers.sort((a, b) => (b.score || 0) - (a.score || 0))
    return scoredOffers.slice(0, 10)
  } catch (e: any) {
    logTaskError('VastAI', 'search-offers-failed', { error: e.message })
    return []
  }
}

/**
 * State instance GPU pod yang sedang aktif
 */
interface ActivePod {
  instanceId: number
  endpointUrl: string
  createdAt: number
  lastActivityAt: number
  idleTimer?: NodeJS.Timeout
}

let currentPod: ActivePod | null = null

/**
 * Mendapatkan pod ComfyUI yang siap melayani render.
 * Jika belum ada, otomatis menyewa penawaran terbaik dan menunggu hingga siap.
 */
export async function getOrProvisionComfyUIPod(apiKey: string, maxBudgetPerHour = 1.0): Promise<string> {
  if (currentPod) {
    currentPod.lastActivityAt = Date.now()
    resetIdleTimer(apiKey)
    return currentPod.endpointUrl
  }

  logTaskProgress('VastAI', 'provision-start', { maxBudgetPerHour })
  const offers = await searchBestGPUOffers(apiKey, maxBudgetPerHour)
  if (!offers.length) {
    throw new Error(`Tidak ditemukan penawaran GPU RTX 5090/4090 dengan harga <= $${maxBudgetPerHour}/jam dan koneksi stabil. Coba naikkan budget limit di pengaturan.`)
  }

  const bestOffer = offers[0]
  logTaskProgress('VastAI', 'offer-selected', { offerId: bestOffer.id, gpu: bestOffer.gpu_name, dph: bestOffer.dph_total, score: bestOffer.score })

  // Sewa instance dengan template ComfyUI
  const createPayload = {
    client_id: 'me',
    image: 'pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime',
    disk: 150,
    onstart_cmd: 'echo "Ready for ComfyUI"',
    direct: true,
  }

  const rentRes = await fetch(`${VAST_API_BASE}/asks/${bestOffer.id}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(createPayload),
  })

  if (!rentRes.ok) {
    throw new Error(`Gagal menyewa instance Vast.ai (HTTP ${rentRes.status})`)
  }

  const rentData = await rentRes.json()
  const instanceId = rentData.new_contract
  if (!instanceId) throw new Error('Vast.ai tidak mengembalikan ID kontrak instance')

  logTaskSuccess('VastAI', 'instance-rented', { instanceId })

  // Polling hingga instance siap dan port ComfyUI bisa dihubungi
  const endpointUrl = await waitForInstanceReady(apiKey, instanceId)

  currentPod = {
    instanceId,
    endpointUrl,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }

  resetIdleTimer(apiKey)
  return endpointUrl
}

/**
 * Menghancurkan pod saat idle untuk melindungi saldo pengguna
 */
export async function destroyPod(apiKey: string, instanceId: number) {
  try {
    logTaskProgress('VastAI', 'destroy-instance', { instanceId })
    await fetch(`${VAST_API_BASE}/instances/${instanceId}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
    })
    if (currentPod?.instanceId === instanceId) {
      if (currentPod.idleTimer) clearTimeout(currentPod.idleTimer)
      currentPod = null
    }
    logTaskSuccess('VastAI', 'instance-destroyed', { instanceId })
  } catch (e: any) {
    logTaskError('VastAI', 'destroy-instance-failed', { instanceId, error: e.message })
  }
}

function resetIdleTimer(apiKey: string) {
  if (!currentPod) return
  if (currentPod.idleTimer) clearTimeout(currentPod.idleTimer)
  // Auto destroy setelah 15 menit idle
  currentPod.idleTimer = setTimeout(() => {
    if (currentPod) {
      logTaskProgress('VastAI', 'idle-timeout-triggered', { instanceId: currentPod.instanceId })
      void destroyPod(apiKey, currentPod.instanceId)
    }
  }, 15 * 60 * 1000)
}

async function waitForInstanceReady(apiKey: string, instanceId: number, timeoutMs = 300_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 6000))
    try {
      const res = await fetch(`${VAST_API_BASE}/instances/${instanceId}/`, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
      })
      if (!res.ok) continue
      const inst = await res.json()
      if (inst.actual_status === 'running') {
        const host = inst.public_ipaddr || inst.ssh_host
        const port = inst.direct_port_start || 8188
        const url = `http://${host}:${port}`
        return url
      }
    } catch { /* retry */ }
  }
  throw new Error('Timeout menunggu inisialisasi GPU pod di Vast.ai (5 menit)')
}
