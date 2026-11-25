<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('cancel')">
      <div class="dialog vast-confirm-dialog" role="dialog" aria-modal="true" :aria-label="t('components.vastConfirm.title')">
        <div class="vast-confirm-icon">
          <Cpu :size="24" :stroke-width="1.8" />
        </div>

        <h2 class="vast-confirm-title">{{ t('components.vastConfirm.title') }}</h2>
        <p class="vast-confirm-sub">{{ t('components.vastConfirm.subtitle') }}</p>

        <div v-if="offer" class="vast-spec-card">
          <div class="vast-spec-row highlight">
            <span class="vast-spec-label">{{ t('components.vastConfirm.gpu') }}</span>
            <span class="vast-spec-val font-bold text-accent">{{ offer.gpu_name }} ({{ offer.num_gpus || 1 }}x)</span>
          </div>

          <div class="vast-spec-row">
            <span class="vast-spec-label">{{ t('components.vastConfirm.price') }}</span>
            <span class="vast-spec-val font-mono">
              ${{ Number(offer.dph_total || 0).toFixed(4) }} {{ t('components.vastConfirm.perHour') }}
            </span>
          </div>

          <div class="vast-spec-row">
            <span class="vast-spec-label">{{ t('components.vastConfirm.bandwidth') }}</span>
            <span class="vast-spec-val">
              ↓ {{ offer.inet_down }} Mbps · ↑ {{ offer.inet_up }} Mbps
            </span>
          </div>

          <div class="vast-spec-row">
            <span class="vast-spec-label">{{ t('components.vastConfirm.reliability') }}</span>
            <span class="vast-spec-val">
              {{ (Number(offer.reliability || 0.9) * 100).toFixed(1) }}%
            </span>
          </div>

          <div v-if="offer.geolocation" class="vast-spec-row">
            <span class="vast-spec-label">{{ t('components.vastConfirm.location') }}</span>
            <span class="vast-spec-val">{{ offer.geolocation.trim() }}</span>
          </div>

          <div class="vast-spec-row">
            <span class="vast-spec-label">{{ t('components.vastConfirm.warmup') }}</span>
            <span class="vast-spec-val text-warning">{{ t('components.vastConfirm.warmupVal') }}</span>
          </div>

          <div class="vast-spec-row border-top">
            <span class="vast-spec-label">{{ t('components.vastConfirm.balance') }}</span>
            <span class="vast-spec-val font-bold" :class="credit && credit < 0.2 ? 'text-danger' : 'text-success'">
              ${{ credit != null ? Number(credit).toFixed(2) : '0.00' }}
            </span>
          </div>
        </div>

        <div class="vast-protection-notice">
          <Clock :size="15" class="notice-icon text-warning" />
          <span>{{ t('components.vastConfirm.warmupNotice') }}</span>
        </div>

        <div class="vast-protection-notice">
          <ShieldAlert :size="15" class="notice-icon" />
          <span>{{ t('components.vastConfirm.autoDestroyNotice') }}</span>
        </div>

        <div class="vast-confirm-actions">
          <button type="button" class="btn btn-ghost" :disabled="loading" @click="emit('cancel')">
            {{ t('common.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="emit('confirm')">
            <Loader2 v-if="loading" :size="14" class="animate-spin" />
            {{ t('components.vastConfirm.confirmBtn') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Cpu, ShieldAlert, Clock, Loader2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  offer: { type: Object, default: null },
  credit: { type: Number, default: null },
  alreadyRunning: { type: Boolean, default: false },
  instance: { type: Object, default: null },
})

const emit = defineEmits(['confirm', 'cancel'])

function onKeydown(e) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}

watch(() => props.open, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.vast-confirm-dialog {
  width: 440px;
  max-width: calc(100vw - 32px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.vast-confirm-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--accent-subtle, rgba(255, 107, 0, 0.12));
  color: var(--accent, #ff6b00);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.vast-confirm-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-0);
  margin: 0;
}
.vast-confirm-sub {
  margin: 6px 0 16px;
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.5;
}
.vast-spec-card {
  width: 100%;
  background: var(--bg-1, #1e1e24);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 10px);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  text-align: left;
}
.vast-spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.vast-spec-row.highlight {
  font-size: 14px;
}
.vast-spec-row.border-top {
  border-top: 1px dashed var(--border-color, rgba(255, 255, 255, 0.1));
  padding-top: 8px;
  margin-top: 2px;
}
.vast-spec-label {
  color: var(--text-2);
}
.vast-spec-val {
  color: var(--text-0);
}
.font-bold { font-weight: 700; }
.font-mono { font-family: monospace; }
.text-accent { color: var(--accent, #ff6b00); }
.text-warning { color: #f59e0b; font-weight: 600; }
.text-success { color: var(--success, #10b981); }
.text-danger { color: var(--danger, #ef4444); }

.vast-protection-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 180, 0, 0.08);
  border: 1px solid rgba(255, 180, 0, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-1);
  text-align: left;
  margin-bottom: 20px;
  width: 100%;
}
.notice-icon {
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
}
.vast-confirm-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}
.vast-confirm-actions .btn {
  flex: 1;
}
</style>
