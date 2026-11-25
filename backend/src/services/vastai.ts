import { logTaskError, logTaskProgress, logTaskSuccess } from '../utils/task-logger.js'

// ─── Vast.ai Dashboard API base ───────────────────────────────────────────────
const VAST_API_BASE = 'https://console.vast.ai/api/v0'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VastAccountInfo {
  ok: boolean
  email?: string
  credit?: number
  error?: string
}

export interface VastOffer {
  id: number
  gpu_name: string
  num_gpus: number
  dph_total: number
  inet_down: number
  inet_up: number
  reliability: number
  geolocation?: string
  direct_port_count: number
  public_ipaddr?: string
  score?: number
}

export interface VastInstance {
  id: number
  actual_status: string
  intended_status?: string
  public_ipaddr?: string
  ssh_host?: string
  ssh_port?: number
  direct_port_start?: number
  direct_port_end?: number
  ports?: Record<string, any>
  gpu_name: string
  dph_total: number
  image?: string
}

// ─── Pod state (singleton per process) ────────────────────────────────────────

interface ActivePod {
  instanceId: number
  endpointUrl: string
  createdAt: number
  lastActivityAt: number
  idleTimer?: NodeJS.Timeout
}

let currentPod: ActivePod | null = null

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function vastGet<T = any>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${VAST_API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Vast.ai GET ${path} → HTTP ${res.status}`)
  return res.json()
}

async function vastRequest<T = any>(apiKey: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${VAST_API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Vast.ai ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Periksa akun & saldo Vast.ai menggunakan API key dashboard.
 * Endpoint: GET /api/v0/users/current/
 */
export async function checkVastAccount(apiKey: string): Promise<VastAccountInfo> {
  try {
    const data = await vastGet(apiKey, '/users/current/')
    return {
      ok: true,
      email: data.email ?? data.username,
      credit: typeof data.credit === 'number' ? data.credit : Number(data.credit ?? 0),
    }
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Failed to connect to Vast.ai' }
  }
}

/**
 * Cari penawaran GPU terbaik dari marketplace Vast.ai.
 * Endpoint: GET /api/v0/bundles/?q=<json_filter>
 *
 * Field yang dipakai API nyata:
 *  - reliability2 (bukan reliability)
 *  - dph_total, inet_down, inet_up, direct_port_count, gpu_name
 */
export async function searchBestGPUOffers(apiKey: string, maxDph = 1.2): Promise<VastOffer[]> {
  try {
    const query = {
      rentable: { eq: true },
      num_gpus: { eq: 1 },
      reliability2: { gte: 0.90 },
      inet_down: { gte: 100 },
      inet_up: { gte: 50 },
      direct_port_count: { gte: 1 },
      dph_total: { lte: maxDph },
      gpu_name: { in: ['RTX 5090', 'RTX 4090', 'RTX 4090 D', 'A100 SXM4', 'RTX 6000 Ada'] },
    }

    const data = await vastGet<any>(apiKey, `/bundles/?q=${encodeURIComponent(JSON.stringify(query))}`)
    const raw: any[] = Array.isArray(data.offers) ? data.offers : []

    const scored: VastOffer[] = raw.map(o => {
      // inet_down dan reliability dibobot tinggi untuk video upload cepat
      const bandwidthScore = Math.min(o.inet_down / 1000, 2) * 20   // maks 40 poin
      const reliabilityScore = (o.reliability2 ?? o.reliability ?? 0.9) * 35  // maks 35 poin
      const priceScore = Math.max(0, (maxDph - o.dph_total) / maxDph) * 25     // maks 25 poin

      return {
        id: o.id,
        gpu_name: o.gpu_name,
        num_gpus: o.num_gpus,
        dph_total: Number((o.dph_total as number).toFixed(4)),
        inet_down: Math.round(o.inet_down),
        inet_up: Math.round(o.inet_up),
        reliability: Number(((o.reliability2 ?? o.reliability) as number).toFixed(3)),
        geolocation: o.geolocation,
        direct_port_count: o.direct_port_count,
        public_ipaddr: o.public_ipaddr,
        score: Number((bandwidthScore + reliabilityScore + priceScore).toFixed(1)),
      }
    })

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return scored.slice(0, 10)
  } catch (e: any) {
    logTaskError('VastAI', 'search-offers-failed', { error: e.message })
    return []
  }
}

/**
 * Ambil list semua instance yang sedang aktif milik akun ini.
 * Endpoint: GET /api/v0/instances/
 */
export async function listInstances(apiKey: string): Promise<VastInstance[]> {
  const data = await vastGet<any>(apiKey, '/instances/')
  return Array.isArray(data.instances) ? data.instances : []
}

/**
 * Sewa satu GPU dari offer yang sudah dipilih.
 * Endpoint: PUT /api/v0/asks/{offer_id}/
 *
 * Rentals Vast.ai tidak perlu Docker Compose atau ComfyUI;
 * aplikasi hanya butuh akses SSH atau port terbuka untuk memanggil API.
 * Image default: pytorch dengan CUDA – bisa diganti sesuai kebutuhan.
 */
export async function rentInstance(
  apiKey: string,
  offerId: number,
  opts: {
    image?: string
    diskGb?: number
    runtype?: 'ssh' | 'jupyter' | 'args'
    env?: Record<string, string>
    onstart?: string
  } = {},
): Promise<{ instanceId: number; instanceApiKey?: string }> {
  const payload: Record<string, unknown> = {
    image: opts.image ?? (process.env.VAST_IMAGE || 'yanwk/comfyui-boot:cu124'),
    disk: opts.diskGb ?? Number(process.env.VAST_DISK_GB || 60),
    runtype: opts.runtype ?? 'ssh',
    target_state: 'running',
  }
  if (opts.env && Object.keys(opts.env).length) payload.env = opts.env
  if (opts.onstart) payload.onstart = opts.onstart

  const data = await vastRequest<any>(apiKey, 'PUT', `/asks/${offerId}/`, payload)

  if (!data?.new_contract) {
    throw new Error(`Vast.ai tidak mengembalikan ID kontrak. Response: ${JSON.stringify(data).slice(0, 200)}`)
  }

  return { instanceId: data.new_contract, instanceApiKey: data.instance_api_key }
}

/**
 * Hancurkan instance – pastikan selalu dipanggil setelah selesai pakai!
 * Endpoint: DELETE /api/v0/instances/{id}/
 */
export async function destroyInstance(apiKey: string, instanceId: number): Promise<void> {
  try {
    logTaskProgress('VastAI', 'destroy-instance', { instanceId })
    await vastRequest(apiKey, 'DELETE', `/instances/${instanceId}/`)
    if (currentPod?.instanceId === instanceId) {
      if (currentPod.idleTimer) clearTimeout(currentPod.idleTimer)
      currentPod = null
    }
    logTaskSuccess('VastAI', 'instance-destroyed', { instanceId })
  } catch (e: any) {
    logTaskError('VastAI', 'destroy-instance-failed', { instanceId, error: e.message })
  }
}

/** Alias untuk backward compat (dipanggil dari routes/settings.ts) */
export const destroyPod = destroyInstance

/**
 * Polling hingga instance `actual_status === 'running'` atau timeout.
 * Mengembalikan info instance yang sudah berjalan.
 */
export async function waitForRunning(
  apiKey: string,
  instanceId: number,
  timeoutMs = 600_000, // 10 menit untuk mengakomodasi download model & warmup container
): Promise<VastInstance> {
  const start = Date.now()
  let attempt = 0
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 8_000))
    attempt++
    try {
      const instances = await listInstances(apiKey)
      const inst = instances.find(i => i.id === instanceId)
      if (!inst) {
        logTaskProgress('VastAI', 'poll-instance-not-found', { instanceId, attempt })
        continue
      }
      logTaskProgress('VastAI', 'poll-instance-status', {
        instanceId,
        actual_status: inst.actual_status,
        intended_status: inst.intended_status,
        attempt,
      })
      if (inst.actual_status === 'running') return inst
    } catch (err: any) {
      logTaskProgress('VastAI', 'poll-instance-error', { instanceId, attempt, error: err.message })
    }
  }
  throw new Error(`Timeout (${timeoutMs / 1000}s) menunggu instance Vast.ai ${instanceId} running`)
}

/**
 * High-level helper: cari offer terbaik → sewa → tunggu running → kembalikan info instance.
 * Jika sudah ada pod aktif, langsung kembalikan tanpa sewa baru (reuse).
 */
export async function getOrProvisionPod(
  apiKey: string,
  maxBudgetPerHour = 1.0,
  opts: Parameters<typeof rentInstance>[2] = {},
): Promise<{ instanceId: number; instance: VastInstance }> {
  // Reuse pod yang masih aktif
  if (currentPod) {
    currentPod.lastActivityAt = Date.now()
    resetIdleTimer(apiKey)
    // Ambil info instance terbaru
    const instances = await listInstances(apiKey)
    const inst = instances.find(i => i.id === currentPod!.instanceId)
    if (inst && inst.actual_status === 'running') {
      return { instanceId: currentPod.instanceId, instance: inst }
    }
    // Pod sudah tidak ada, reset state
    if (currentPod.idleTimer) clearTimeout(currentPod.idleTimer)
    currentPod = null
  }

  logTaskProgress('VastAI', 'provision-start', { maxBudgetPerHour })

  const offers = await searchBestGPUOffers(apiKey, maxBudgetPerHour)
  if (!offers.length) {
    throw new Error(
      `Tidak ditemukan penawaran GPU dengan harga ≤ $${maxBudgetPerHour}/jam dan spesifikasi yang cukup. ` +
      `Coba naikkan budget limit atau kurangi filter GPU di pengaturan.`,
    )
  }

  const best = offers[0]
  logTaskProgress('VastAI', 'offer-selected', {
    offerId: best.id, gpu: best.gpu_name,
    dph: best.dph_total, score: best.score,
    location: best.geolocation,
  })

  const { instanceId } = await rentInstance(apiKey, best.id, opts)
  logTaskSuccess('VastAI', 'instance-rented', { instanceId, offerId: best.id })

  const instance = await waitForRunning(apiKey, instanceId)

  currentPod = {
    instanceId,
    endpointUrl: buildInstanceEndpoint(instance),
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
  resetIdleTimer(apiKey)

  return { instanceId, instance }
}

/** Alias lama – dipakai oleh vastai-video.ts */
export async function getOrProvisionComfyUIPod(apiKey: string, maxBudgetPerHour = 1.0): Promise<string> {
  const { instance } = await getOrProvisionPod(apiKey, maxBudgetPerHour)
  return buildInstanceEndpoint(instance)
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function buildInstanceEndpoint(inst: VastInstance): string {
  const host = inst.public_ipaddr ?? inst.ssh_host ?? '127.0.0.1'
  // direct_port_start adalah port pertama yang di-forward secara langsung (tanpa NAT)
  const port = inst.direct_port_start ?? 8188
  return `http://${host}:${port}`
}

function resetIdleTimer(apiKey: string, idleMinutes = 15) {
  if (!currentPod) return
  if (currentPod.idleTimer) clearTimeout(currentPod.idleTimer)
  currentPod.idleTimer = setTimeout(() => {
    if (currentPod) {
      logTaskProgress('VastAI', 'idle-timeout-triggered', { instanceId: currentPod.instanceId, idleMinutes })
      void destroyInstance(apiKey, currentPod.instanceId)
    }
  }, idleMinutes * 60 * 1000)
}
