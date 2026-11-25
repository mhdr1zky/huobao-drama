import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOfficialProvider } from '../src/services/ai.ts'
import { getImageAdapter, getVideoAdapter } from '../src/services/adapters/registry.ts'
import { VastAIVideoAdapter } from '../src/services/adapters/vastai-video.ts'

test('isOfficialProvider allows custom providers and vastai', () => {
  assert.equal(isOfficialProvider('text', 'custom'), true)
  assert.equal(isOfficialProvider('text', 'custom-openrouter'), true)
  assert.equal(isOfficialProvider('image', 'custom'), true)
  assert.equal(isOfficialProvider('video', 'vastai'), true)
  assert.equal(isOfficialProvider('video', 'custom'), true)
})

test('registry returns adapters for custom and vastai', () => {
  const customImg = getImageAdapter('custom')
  assert.ok(customImg)

  const vastaiVid = getVideoAdapter('vastai')
  assert.ok(vastaiVid instanceof VastAIVideoAdapter)

  const comfyVid = getVideoAdapter('comfyui')
  assert.ok(comfyVid instanceof VastAIVideoAdapter)
})

test('VastAIVideoAdapter builds multishot prompt format matching DRACIN-AI recipe', () => {
  const adapter = new VastAIVideoAdapter()
  const req = adapter.buildGenerateRequest(
    { provider: 'vastai', baseUrl: 'http://127.0.0.1:8188', apiKey: 'test-key', model: 'MiniMax-H3' },
    {
      id: 101,
      prompt: 'Scene 1: Emperor sitting on throne',
      referenceImageUrls: JSON.stringify(['https://example.com/ref1.png', 'https://example.com/ref2.png']),
    }
  )

  assert.equal(req.url, 'http://127.0.0.1:8188/prompt')
  assert.equal(req.method, 'POST')
  assert.ok(req.body.prompt['6'].inputs.text.includes('<Picture 1> <Picture 2>'))
  assert.ok(req.body.prompt['6'].inputs.text.includes('Scene 1: Emperor sitting on throne'))
})

test('vastai.ts uses correct API endpoint and reliability2 field', async () => {
  const fs = await import('node:fs')
  const content = fs.readFileSync(new URL('../src/services/vastai.ts', import.meta.url), 'utf-8')

  // Harus pakai /api/v0 dashboard endpoint (bukan localhost)
  assert.match(content, /https:\/\/console\.vast\.ai\/api\/v0/)
  // Harus pakai reliability2 (field nyata dari API)
  assert.match(content, /reliability2/)
  // Harus punya listInstances (endpoint GET /instances/)
  assert.match(content, /listInstances/)
  // Harus punya rentInstance
  assert.match(content, /rentInstance/)
  // Harus punya destroyInstance
  assert.match(content, /destroyInstance/)
  // Harus punya waitForRunning
  assert.match(content, /waitForRunning/)
  // Tidak boleh pakai /instances/{id}/ untuk polling (harus /instances/)
  assert.match(content, /\/instances\//)
})

test('settings route exports vastai rent and destroy endpoints', async () => {
  const fs = await import('node:fs')
  const content = fs.readFileSync(new URL('../src/routes/settings.ts', import.meta.url), 'utf-8')

  assert.match(content, /\/vastai\/rent/)
  assert.match(content, /\/vastai\/instances/)
  assert.match(content, /\/vastai\/preflight/)
  assert.match(content, /rentInstance/)
  assert.match(content, /destroyInstance/)
})

test('episode page and VastGpuConfirmDialog are wired for rental confirmation', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const rootDir = path.resolve(__dirname, '../..')

  const episodeContent = fs.readFileSync(path.join(rootDir, 'frontend/app/views/drama/episode.vue'), 'utf-8')
  assert.match(episodeContent, /VastGpuConfirmDialog/)
  assert.match(episodeContent, /vastPreflight/)
  assert.match(episodeContent, /vastConfirmOpen/)

  const dialogContent = fs.readFileSync(path.join(rootDir, 'frontend/app/components/VastGpuConfirmDialog.vue'), 'utf-8')
  assert.match(dialogContent, /components\.vastConfirm\.title/)
  assert.match(dialogContent, /components\.vastConfirm\.confirmBtn/)
})
