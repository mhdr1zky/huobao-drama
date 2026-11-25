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
