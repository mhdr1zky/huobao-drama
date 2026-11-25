/**
 * Vast.ai / ComfyUI Video Generation Adapter
 * Terintegrasi penuh dengan arsitektur VideoProviderAdapter di Huobao Drama.
 * Mengikuti resep multishot MiniMax H3 / Wan 2.1 (DRACIN-AI.md):
 * - Reference injection (<Picture 1..N>)
 * - Prompt multi-shot
 * - Polling eksekusi ComfyUI (/history/{prompt_id})
 */
import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types'
import { joinProviderUrl } from './url'

export class VastAIVideoAdapter implements VideoProviderAdapter {
  provider = 'vastai'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const prompt = (record.prompt || '').trim()
    const targetUrl = config.baseUrl || 'http://127.0.0.1:8188'

    // Format multishot prompt sesuai resep DRACIN-AI.md
    let formattedPrompt = prompt
    if (record.referenceImageUrls) {
      try {
        const refImages: string[] = JSON.parse(record.referenceImageUrls)
        if (refImages.length > 0 && !formattedPrompt.includes('<Picture')) {
          const refsTag = refImages.map((_, i) => `<Picture ${i + 1}>`).join(' ')
          formattedPrompt = `${refsTag}\n${formattedPrompt}`
        }
      } catch {}
    }

    // ComfyUI /prompt payload graph
    const payload = {
      prompt: {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": record.seed || Math.floor(Math.random() * 1000000),
            "steps": 8,
            "cfg": 1.0,
            "sampler_name": "euler",
            "scheduler": "beta",
            "denoise": 1.0
          }
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": formattedPrompt
          }
        }
      },
      client_id: `huobao-task-${record.id}`
    }

    return {
      url: joinProviderUrl(targetUrl, '', '/prompt'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: payload,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const promptId = result.prompt_id || result.taskId || result.id
    if (!promptId) throw new Error(result.error || result.message || 'ComfyUI tidak mengembalikan prompt_id')
    return {
      isAsync: true,
      taskId: String(promptId),
    }
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    const targetUrl = config.baseUrl || 'http://127.0.0.1:8188'
    return {
      url: joinProviderUrl(targetUrl, '', `/history/${taskId}`),
      method: 'GET',
      headers: {
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    // result adalah response dari /history/{prompt_id}
    const taskId = Object.keys(result)[0]
    const taskData = result[taskId]

    if (!taskData) {
      return { status: 'processing' }
    }

    const status = taskData.status
    if (status && status.status_str === 'error') {
      const errMsg = status.messages ? JSON.stringify(status.messages) : 'ComfyUI render failed'
      return { status: 'failed', error: errMsg }
    }

    if (taskData.outputs) {
      for (const nodeId of Object.keys(taskData.outputs)) {
        const out = taskData.outputs[nodeId]
        if (out.videos && out.videos.length > 0) {
          const v = out.videos[0]
          return {
            status: 'completed',
            videoUrl: `/view?filename=${encodeURIComponent(v.filename)}&subfolder=${encodeURIComponent(v.subfolder || '')}&type=${encodeURIComponent(v.type || 'output')}`,
          }
        }
        if (out.gifs && out.gifs.length > 0) {
          const g = out.gifs[0]
          return {
            status: 'completed',
            videoUrl: `/view?filename=${encodeURIComponent(g.filename)}&subfolder=${encodeURIComponent(g.subfolder || '')}&type=${encodeURIComponent(g.type || 'output')}`,
          }
        }
      }
    }

    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    if (result.videoUrl) return result.videoUrl
    return null
  }
}
