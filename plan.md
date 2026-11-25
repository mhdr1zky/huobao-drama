# Rencana Modifikasi (`plan.md`) — Global i18n, Notifikasi/Error API, & Persistensi Bahasa

> Dibuat berdasarkan [context.md](file:///c:/Users/Hades/Documents/lab/huobao-drama/context.md) dan aturan di [aturanmodifproyeku.md](file:///c:/Users/Hades/Documents/lab/aturanmodifproyeku.md).

---

## 1. Tujuan dan Ruang Lingkup

### Tujuan
1. Memastikan pergantian bahasa (`zh`, `en`, `ja`, `ko`) mencakup **keseluruhan UI, notifikasi (`toast`), error API, dan notifikasi timeout** secara konsisten.
2. Memastikan pilihan bahasa **tersimpan dan otomatis terpulihkan** saat aplikasi dibuka ulang (baik di mode Web/Docker maupun Desktop Electron yang port-nya berubah tiap startup).

### Termasuk dalam Ruang Lingkup
- **Persistensi & Sinkronisasi Bahasa Saat Startup**:
  - Sinkronisasi `locale` UI saat aplikasi dibuka dari backend SQLite (`GET /api/v1/settings/content-language` / `app_settings`), bukan hanya bergantung pada `localStorage` (yang hilang saat port Electron berubah).
  - Perbaikan bug tombol Cancel pada dialog konfirmasi ganti bahasa (`useUnifiedLanguage.ts`) agar membatalkan dengan benar.
- **Lokalisasi Error API, Timeout, & Notifikasi (`useToast.ts` + `useApi.ts` + `locales/*.json`)**:
  - Menghilangkan perilaku *passthrough* mentah pesan Mandarin dari backend di `mapError()` saat bahasa aktif bukan `zh`.
  - Menambahkan mekanisme pemetaan error API & timeout (baik berdasarkan `error_code` / pola pesan backend maupun pola timeout/jaringan seperti `AbortError`, `ETIMEDOUT`, `timeout`, `polling exceeded`) ke key terjemahan di `zh.json`, `en.json`, `ja.json`, `ko.json`.
  - Memastikan notifikasi timeout (mis. saat polling gambar/video/ekstraksi/prompt batch habis) menggunakan key i18n yang sesuai.
- **Audit String UI & Desktop yang Masih Hardcoded**:
  - Mengganti sisa string UI/notifikasi hardcoded Mandarin di komponen/halaman frontend (termasuk `episode.vue`, `detail.vue`, `settings.vue`, `index.vue`, komponen dialog) serta label/dialog utama di `desktop/src/main.ts` bila perlu (menyesuaikan locale tersimpan).

### Tidak Termasuk dalam Ruang Lingkup
- Mengubah isi atau logika prompt/skill AI di `backend/workspace/prompts/` dan `backend/workspace/skills/`.
- Menerjemahkan pesan error teknis mentah dari provider pihak ketiga (OpenAI/Volcengine/MiniMax/Aliyun) secara kata-per-kata di log terminal; cukup dipetakan ke pesan ramah pengguna sesuai bahasa UI di frontend/task error summary.
- Mengubah arsitektur database atau menambah bahasa baru di luar `zh`, `en`, `ja`, `ko`.

---

## 2. Daftar File yang Diubah / Dibuat Beserta Alasannya

| File | Aksi | Alasan |
|---|---|---|
| `frontend/app/composables/i18n.ts` | Ubah | Menambah helper sinkronisasi locale dari backend (`syncLocaleFromBackend` / `setUiLocale`) agar state awal selalu akurat |
| `frontend/app/app.vue` | Ubah | Memanggil sinkronisasi bahasa dari backend saat aplikasi dimount sehingga bahasa tersimpan di SQLite langsung diterapkan saat app dibuka ulang |
| `frontend/app/composables/useUnifiedLanguage.ts` | Ubah | Memperbaiki bug `onCancel` yang tetap me-resolve `true` pada `confirmDialog` |
| `frontend/app/composables/useApi.ts` | Ubah | Menyertakan status HTTP / `errorCode` pada `Error` yang dilempar agar `mapError()` dapat memetakan error API secara akurat tanpa bergantung pada teks Mandarin mentah |
| `frontend/app/composables/useToast.ts` | Ubah | Menghentikan passthrough teks Mandarin saat locale != `zh`; menambah pemetaan error API backend, timeout (`AbortError`/`ETIMEDOUT`/dll.), dan fallback terlokalisasi |
| `frontend/app/locales/zh.json`, `en.json`, `ja.json`, `ko.json` | Ubah | Menambah key terjemahan untuk error API umum (validasi, not found, belum konfigurasi AI, duplikat submit, timeout polling/request, dll.) |
| `frontend/app/views/drama/episode.vue` (dan view/komponen lain jika ditemukan sisa hardcoded) | Ubah | Memastikan notifikasi timeout & sisa string UI menggunakan `t(...)` dari `vue-i18n` |
| `backend/src/utils/response.ts` (opsional/terbatas pada helper error) | Ubah | Mendukung field opsional `error_code` pada JSON error response agar frontend bisa memetakan error API secara deterministik |
| `frontend/tests/i18n-persistence-and-errors.test.mjs` | Buat | Unit/structure test untuk verifikasi persistensi locale, `useUnifiedLanguage`, pemetaan `mapError()` (termasuk error API & timeout di semua locale), serta kelengkapan key di 4 file `locales/*.json` |

---

## 3. Langkah Kecil Berurutan

### Langkah 1 — Perbaikan Persistensi Bahasa & Dialog Konfirmasi ✅ Selesai
- **Perubahan**:
  - Di `frontend/app/composables/useUnifiedLanguage.ts`: perbaiki `confirmDialog()` agar `onCancel` me-resolve `false` dan `onConfirm` me-resolve `true`.
  - Di `frontend/app/composables/i18n.ts` dan `frontend/app/app.vue`: saat aplikasi startup (`onMounted` di `app.vue`), ambil `settingsAPI.contentLanguage()` dari backend SQLite; jika berbeda dengan `i18n.global.locale.value` (mis. karena port Electron berubah sehingga `localStorage` kosong), perbarui `setUiLocale(lang)` secara otomatis.
- **File terdampak**: `frontend/app/composables/useUnifiedLanguage.ts`, `frontend/app/composables/i18n.ts`, `frontend/app/app.vue`.
- **Test verifikasi**: Tambah test di `frontend/tests/i18n-persistence-and-errors.test.mjs` (verifikasi `onCancel` resolve `false`, serta logika sinkronisasi `contentLanguage` ke `setUiLocale`), lalu jalankan test suite `frontend/tests/`.

### Langkah 2 — Pemetaan Error API & Timeout Multi-Bahasa di `useApi.ts`, `useToast.ts`, & `locales/*.json` ✅ Selesai
- **Perubahan**:
  - Di `frontend/app/composables/useApi.ts`: buat `ApiError` (atau properti `status` & `errorCode` pada `Error`) saat response gagal atau timeout (`AbortSignal`/fetch error).
  - Di `frontend/app/composables/useToast.ts`:
    - Batasi passthrough string Mandarin mentah hanya ketika `i18n.global.locale.value === 'zh'`.
    - Tambahkan tabel/pola pemetaan pesan error API backend & timeout (seperti `未配置图片模型`, `未配置视频模型`, `角色不存在`, `剧集不存在`, `镜头不存在`, `正在提交任务`, `请求参数错误`, `资源不存在`, `AbortError`, `ETIMEDOUT`, `timeout`, `polling exceeded`) ke key i18n di `errors.*`.
  - Lengkapi key `errors.*` di `frontend/app/locales/{zh,en,ja,ko}.json`.
- **File terdampak**: `frontend/app/composables/useApi.ts`, `frontend/app/composables/useToast.ts`, `frontend/app/locales/zh.json`, `frontend/app/locales/en.json`, `frontend/app/locales/ja.json`, `frontend/app/locales/ko.json`.
- **Test verifikasi**: Jalankan unit test `mapError()` di `frontend/tests/i18n-persistence-and-errors.test.mjs` untuk menguji error API Mandarin, error HTTP status, dan error timeout pada locale `zh`, `en`, `ja`, `ko`.

### Langkah 3 — Audit & Lokalisasi Notifikasi Timeout & Sisa String UI Hardcoded ✅ Selesai
- **Perubahan**:
  - Audit seluruh `frontend/app/` (`episode.vue`, `detail.vue`, `settings.vue`, `index.vue`, `components/*.vue`) untuk notifikasi timeout (`watchAsyncResult` / polling) dan teks UI yang masih hardcoded Mandarin.
  - Pastikan semua notifikasi timeout dan pesan UI yang ditemukan menggunakan `t(...)` dengan key yang tersedia di `zh.json`, `en.json`, `ja.json`, `ko.json`.
- **File terdampak**: `frontend/app/views/drama/episode.vue` (serta file view/komponen lain yang terdeteksi saat audit), `frontend/app/locales/{zh,en,ja,ko}.json`.
- **Test verifikasi**: Jalankan seluruh test di `frontend/tests/` (termasuk `watch-async-result-timeout.test.mjs` dan test kelengkapan key 4 bahasa).

### Langkah 4 — Verifikasi Akhir & Build Check ✅ Selesai (Test `node --test` lulus; `typecheck` & `generate` menunggu `npm install`)
- **Perubahan**: Tidak ada perubahan fitur baru; hanya memastikan seluruh test (`backend/tests/`, `frontend/tests/`, `desktop/tests/`) dan `typecheck` / `nuxt generate` berjalan bersih.
- **File terdampak**: —
- **Test verifikasi**: Jalankan `cd backend && npm run typecheck`, `node --test frontend/tests/*.test.mjs`, dan `cd frontend && npm run generate`.

---

## 4. Risiko dan Mitigasinya

| Risiko | Mitigasi |
|---|---|
| `episode.vue` berukuran sangat besar (~6.264 baris) dan punya test struktural ketat (`watch-async-result-timeout.test.mjs`) | Lakukan edit minimal dan terlokalisir; jangan mengubah signature `watchAsyncResult` atau pola cleanup yang diuji test struktural; jalankan `watch-async-result-timeout.test.mjs` setelah edit. |
| Sinkronisasi `settingsAPI.contentLanguage()` saat `app.vue` mount bisa memicu kedipan teks singkat jika `localStorage` kosong (di Electron) | Simpan juga di `localStorage` sebagai cache cepat untuk port yang sama, dan jalankan `settingsAPI.contentLanguage()` sedini mungkin di `app.vue` (serta pastikan `vue-i18n` reaktif memperbarui semua komponen). |
| Pesan error backend baru di masa depan belum ada di peta `useToast.ts` | Sediakan fallback yang rapi berdasarkan HTTP status (`400`, `404`, `429`, `5xx`, `timeout`) agar saat locale != `zh` pengguna tetap mendapat pesan terlokalisasi yang jelas, bukan teks Mandarin mentah atau pesan kosong. |

---

## 5. Kriteria Selesai (*Definition of Done*)

1. Mengganti bahasa ke `en`, `ja`, `ko`, atau `zh` lalu menutup dan membuka kembali aplikasi (termasuk simulasi `localStorage` kosong / ganti port) tetap mempertahankan bahasa yang dipilih.
2. Klik "Batal/Cancel" pada dialog ganti bahasa benar-benar membatalkan perubahan tanpa me-reload halaman.
3. Error API dari backend (seperti data tidak ditemukan, AI service belum dikonfigurasi, validasi gagal) dan error timeout/jaringan tampil dalam bahasa sesuai locale UI aktif (tidak bocor teks Mandarin saat locale `en`/`ja`/`ko`).
4. Seluruh key i18n baru tersedia lengkap di `zh.json`, `en.json`, `ja.json`, dan `ko.json`.
5. Semua test terkait dan `typecheck` lulus tanpa error.
