import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

test('backend server-update defaults to user repo mhdr1zky/huobao-drama', () => {
  const fileContent = fs.readFileSync(path.join(rootDir, 'backend/src/services/server-update.ts'), 'utf-8')
  assert.match(fileContent, /https:\/\/github\.com\/mhdr1zky\/huobao-drama\/releases\/latest\/download\/latest\.json/)
  assert.doesNotMatch(fileContent, /chatfire-AI\/huobao-drama/)
  assert.doesNotMatch(fileContent, /installer\.firemux\.site/)
})

test('desktop updater defaults to user repo mhdr1zky/huobao-drama', () => {
  const fileContent = fs.readFileSync(path.join(rootDir, 'desktop/src/updater.ts'), 'utf-8')
  assert.match(fileContent, /https:\/\/github\.com\/mhdr1zky\/huobao-drama\/releases\/latest\/download\/latest\.json/)
  assert.doesNotMatch(fileContent, /chatfire-AI\/huobao-drama/)
  assert.doesNotMatch(fileContent, /installer\.firemux\.site/)
})

test('desktop build & publish scripts use mhdr1zky/huobao-drama', () => {
  const feedScript = fs.readFileSync(path.join(rootDir, 'desktop/scripts/make-update-feed.mjs'), 'utf-8')
  const publishScript = fs.readFileSync(path.join(rootDir, 'desktop/scripts/publish-release.mjs'), 'utf-8')
  assert.match(feedScript, /mhdr1zky\/huobao-drama/)
  assert.doesNotMatch(feedScript, /chatfire-AI\/huobao-drama/)
  assert.match(publishScript, /mhdr1zky\/huobao-drama/)
  assert.doesNotMatch(publishScript, /chatfire-AI\/huobao-drama/)
})

test('frontend layout github link points to mhdr1zky/huobao-drama', () => {
  const layout = fs.readFileSync(path.join(rootDir, 'frontend/app/layouts/default.vue'), 'utf-8')
  assert.match(layout, /href="https:\/\/github\.com\/mhdr1zky\/huobao-drama"/)
  assert.doesNotMatch(layout, /chatfire-AI\/huobao-drama/)
})
