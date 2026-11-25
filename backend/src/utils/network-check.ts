import https from 'node:https'
import http from 'node:http'

export interface NetworkCheckResult {
  ok: boolean
  latencyMs: number
  packetLoss: boolean
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  clientIp?: string
  warnings: string[]
  testedAt: string
}

/**
 * Menguji kualitas & stabilitas koneksi internet lokal (ping latency & DNS/connectivity test).
 * Endpoint target adalah backbone API publik berkecepatan tinggi.
 */
export async function checkLocalNetwork(): Promise<NetworkCheckResult> {
  const targets = [
    { name: 'Cloudflare', url: 'https://1.1.1.1' },
    { name: 'Google DNS', url: 'https://8.8.8.8' },
    { name: 'Vast.ai Console', url: 'https://console.vast.ai' },
  ]

  const testedAt = new Date().toISOString()
  const latencies: number[] = []
  const warnings: string[] = []

  for (const target of targets) {
    try {
      const start = performance.now()
      const req = await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
      const ms = Math.round(performance.now() - start)
      if (req.ok || req.status < 500) {
        latencies.push(ms)
      }
    } catch (e: any) {
      warnings.push(`Ping to ${target.name} timed out or failed: ${e.message}`)
    }
  }

  if (latencies.length === 0) {
    return {
      ok: false,
      latencyMs: 9999,
      packetLoss: true,
      quality: 'poor',
      warnings: ['Koneksi internet lokal terputus atau sangat lambat.', ...warnings],
      testedAt,
    }
  }

  // Hitung rata-rata latency
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'

  if (avgLatency <= 100) quality = 'excellent'
  else if (avgLatency <= 250) quality = 'good'
  else if (avgLatency <= 450) {
    quality = 'fair'
    warnings.push('Latency cukup tinggi (>250ms). Upload referensi video mungkin memerlukan waktu lebih lama.')
  } else {
    quality = 'poor'
    warnings.push('Koneksi internet lambat/tidak stabil (>450ms). Sistem akan otomatis memperpanjang batas timeout render.')
  }

  return {
    ok: true,
    latencyMs: avgLatency,
    packetLoss: latencies.length < targets.length,
    quality,
    warnings,
    testedAt,
  }
}
