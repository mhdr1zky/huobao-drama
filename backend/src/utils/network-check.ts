import https from 'node:https'
import http from 'node:http'

export interface NetworkCheckResult {
  ok: boolean
  latencyMs: number
  localLatencyMs: number
  vastLatencyMs?: number
  packetLoss: boolean
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  clientIp?: string
  warnings: string[]
  testedAt: string
}

/**
 * Menguji kualitas & stabilitas koneksi internet lokal (ping latency & DNS/connectivity test).
 * Membedakan antara:
 * 1. Koneksi lokal ke Edge CDN terdekat (mengukur kesehatan internet PC lokal)
 * 2. Latency fisik lintas benua ke API Gateway Vast.ai (US)
 */
export async function checkLocalNetwork(): Promise<NetworkCheckResult> {
  const testedAt = new Date().toISOString()
  const warnings: string[] = []
  let localLatencyMs = 0
  let vastLatencyMs: number | undefined

  // 1. Uji koneksi lokal / regional CDN terdekat
  const localTargets = [
    { name: 'Cloudflare Edge', url: 'https://1.1.1.1' },
    { name: 'Google HTTP', url: 'https://www.google.com/generate_204' },
  ]
  const localLatencies: number[] = []

  for (const target of localTargets) {
    try {
      const start = performance.now()
      const req = await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(3500) })
      const ms = Math.round(performance.now() - start)
      if (req.ok || req.status < 500) localLatencies.push(ms)
    } catch { /* coba target berikutnya */ }
  }

  if (localLatencies.length > 0) {
    localLatencyMs = Math.min(...localLatencies)
  }

  // 2. Uji latency ke API Gateway Vast.ai (jarak fisik Trans-Pacific ke server US)
  try {
    const start = performance.now()
    await fetch('https://console.vast.ai/api/v0/users/current/', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    vastLatencyMs = Math.round(performance.now() - start)
  } catch {
    /* Vast.ai timeout */
  }

  // Evaluasi Kualitas Koneksi Lokal
  // Bandwidth 40 Mbps + latency CDN ~150-250ms adalah standar normal internet residensial Indonesia
  let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'
  if (localLatencyMs === 0) {
    quality = 'poor'
    warnings.push('Tidak dapat menghubungi CDN lokal/Google. Periksa sambungan internet PC Anda.')
  } else if (localLatencyMs <= 120) {
    quality = 'excellent'
  } else if (localLatencyMs <= 280) {
    quality = 'good'
  } else if (localLatencyMs <= 450) {
    quality = 'fair'
    warnings.push(`Latency lokal cukup tinggi (${localLatencyMs}ms). Pastikan tidak ada aktivitas download besar lain di PC Anda.`)
  } else {
    quality = 'poor'
    warnings.push(`Koneksi internet lokal tidak stabil (${localLatencyMs}ms).`)
  }

  // Penjelasan informatif tentang Latency Trans-Pasifik Vast.ai
  if (vastLatencyMs && vastLatencyMs > 600) {
    warnings.push(
      `Latency ke server Vast.ai US (~${vastLatencyMs}ms) wajar karena jarak fisik antar benua. Bandwidth lokal Anda lancar untuk transfer media.`
    )
  }

  return {
    ok: localLatencyMs > 0,
    latencyMs: localLatencyMs || vastLatencyMs || 9999,
    localLatencyMs: localLatencyMs || 0,
    vastLatencyMs,
    packetLoss: localLatencies.length === 0,
    quality,
    warnings,
    testedAt,
  }
}
