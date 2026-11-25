# Rencana Modifikasi (`plan.md`) — Integrasi Otomatis GPU Rental (Vast.ai) & ComfyUI Video Generation

> Disusun berdasarkan [context.md](file:///c:/Users/Hades/Documents/lab/huobao-drama/context.md), resep produksi [DRACIN-AI.md](file:///c:/Users/Hades/Downloads/Paket-Komplit-OpikPun-AI/3-dracin/DRACIN-AI.md), dan aturan di [aturanmodifproyeku.md](file:///c:/Users/Hades/Documents/lab/aturanmodifproyeku.md).

---

## 1. Tujuan dan Ruang Lingkup

### Tujuan
Menambahkan penyedia generasi video mandiri berbasis rental GPU cloud (**Vast.ai** / **ComfyUI**) yang **berjalan otomatis penuh**. Pengguna hanya perlu memasukkan API Key Vast.ai (dan budget limit); sistem AI aplikasi secara otonom akan:
1. Memeriksa kualitas & stabilitas koneksi internet PC lokal sebelum render.
2. Mencari GPU terbaik (RTX 5090 / 4090, VRAM ≥ 24GB, RAM ≥ 40GB, Disk ≥ 150GB) dengan koneksi host terlancar (Download ≥ 300 Mbps, Upload ≥ 100 Mbps, Reliability ≥ 98%, direct port, lokasi geografis terdekat).
3. Menyewa instance secara otomatis saat ada tugas video, memasang ComfyUI dengan bobot model (MiniMax H3 / Wan multishot), dan mengeksekusi render melalui alur baku `sys_task` & `VideoProviderAdapter`.
4. Mengunduh hasil video langsung ke `data/static/videos/` dan otomatis mematikan/menghancurkan (destroy) pod GPU saat idle (15 menit tanpa job) untuk melindungi saldo pengguna.

### Termasuk dalam Ruang Lingkup
- **Pre-flight Network Check**: Endpoint diagnostik untuk mengukur latency dan kecepatan koneksi PC lokal, serta peringatan otomatis jika jaringan tidak stabil.
- **Vast.ai Orchestrator (`vastai.ts`)**: Modul pencarian tawaran terbaik, sewa otomatis, status polling, dan auto-teardown saat idle.
- **VastAI / ComfyUI Video Adapter (`vastai-video.ts`)**: Terintegrasi penuh ke dalam arsitektur adapter Huobao Drama (`registry.ts`, `generation.ts`, `types.ts`).
- **Prompt Transpiler Multishot**: Format prompt video khusus ComfyUI (`<Picture 1..N>`, `<d>dialog</d>`, penanda sudut kamera, filter kulit berminyak) sesuai `DRACIN-AI.md`.
- **UI Settings & Workbench Integration**: Menu konfigurasi di `settings.vue` (input API key, widget cek koneksi PC lokal, status saldo/pod aktif) dan pemilihan model di topbar episode.
- **Multi-language Support**: Label dan status error baru diterjemahkan lengkap ke dalam 4 bahasa (`en`, `zh`, `ja`, `ko`).

### Tidak Termasuk dalam Ruang Lingkup
- Penyewaan GPU di luar platform yang menyediakan REST API terotomatisasi (fokus utama pada Vast.ai).
- Mengubah alur inti database SQLite atau merusak adapter bawaan (`volcengine`, `minimax`, `aliyun`).

---

## 2. Daftar File yang Diubah / Dibuat

| File | Aksi | Alasan |
|---|---|---|
| `backend/src/utils/network-check.ts` | Buat | Utilitas pengujian ping latency & kecepatan koneksi internet PC lokal |
| `backend/src/routes/settings.ts` | Ubah | Menambahkan endpoint `GET /api/v1/settings/network-check` dan endpoint status/saldo Vast.ai |
| `backend/src/services/vastai.ts` | Buat | Service orchestrator Vast.ai: pencarian penawaran terbaik (GPU + speed + reliability), auto-rent, monitoring, dan auto-destroy idle timer |
| `backend/src/services/adapters/vastai-video.ts` | Buat | Implementasi `VideoProviderAdapter` untuk ComfyUI di pod Vast.ai (upload referensi gambar/audio, trigger workflow, polling, streaming download) |
| `backend/src/services/adapters/types.ts` | Ubah | Menambahkan tipe & konstanta konfigurasi terkait provider `vastai` |
| `backend/src/services/adapters/registry.ts` | Ubah | Mendaftarkan adapter `vastai` ke dalam daftar `videoAdapters` |
| `frontend/app/pages/settings.vue` | Ubah | Menambahkan preset template `vastai` di form Video AI, tombol cek koneksi PC lokal, dan indikator pod aktif |
| `frontend/app/locales/{en,zh,ja,ko}.json` | Ubah | Menambahkan string terjemahan untuk pengaturan Vast.ai, diagnostik jaringan, dan notifikasi terkait |
| `backend/tests/vastai-integration.test.ts` | Buat | Unit test untuk scoring penawaran GPU terbaik, parsing adapter response, dan diagnostik jaringan |

---

## 3. Langkah Kecil Berurutan

### Langkah 1 — Modul Diagnostik Koneksi PC Lokal & Endpoint Backend ✅ Selesai
- **Perubahan**:
  - Buat `backend/src/utils/network-check.ts` untuk mengukur RTT latency dan estimasi kecepatan transfer.
  - Tambahkan route `GET /settings/network-check` di `backend/src/routes/settings.ts`.
- **Test verifikasi**: Jalankan `node --test` atau test script untuk memverifikasi endpoint mengembalikan status latency, upload/download stability, dan rekomendasi status jaringan.

### Langkah 2 — Service Orchestrator Vast.ai & Smart GPU Matching ✅ Selesai
- **Perubahan**:
  - Buat `backend/src/services/vastai.ts`:
    - Fungsi pencarian penawaran GPU terbaik dengan filter: GPU tier (RTX 5090/4090), VRAM ≥ 24GB, disk ≥ 150GB, inet_down ≥ 300 Mbps, inet_up ≥ 100 Mbps, reliability ≥ 98%, direct port, dan lokasi terdekat.
    - Fungsi `rentInstance()`, `getInstanceStatus()`, `destroyInstance()`.
    - Mekanisme *Auto-Destroy Timer* (idle sentinel 15 menit tanpa aktivitas video render).
- **Test verifikasi**: Unit test algoritma scoring tawaran penawaran GPU di `backend/tests/vastai-integration.test.ts`.

### Langkah 3 — Pembuatan Video Adapter `VastAIVideoAdapter` & Dukungan Custom Provider (Teks, Gambar, Video) ✅ Selesai
- **Perubahan**:
  - Buat `backend/src/services/adapters/vastai-video.ts` sesuai kontrak `VideoProviderAdapter`.
  - Dukung mapping referensi multishot `<Picture 1..N>` dan audio lock sesuai resep `DRACIN-AI.md`.
  - Daftarkan `vastai`, `comfyui`, dan `custom` ke `backend/src/services/adapters/registry.ts` dan buka whitelist di `ai.ts` untuk teks, gambar, dan video kustom.
- **Test verifikasi**: Unit test pemetaan request ComfyUI graph dan parsing polling response di `backend/tests/vastai-integration.test.ts`.

### Langkah 4 — Integrasi UI Settings & Dukungan 4 Bahasa ✅ Selesai
- **Perubahan**:
  - Di `frontend/app/pages/settings.vue`: tambahkan preset provider `vastai` dan `custom` (Teks, Gambar, Video), input API key, budget limit, dan widget "Diagnostik Koneksi & Vast.ai GPU".
  - Tambahkan method `networkCheck`, `checkVastAi`, `searchVastOffers` di `useApi.ts`.
- **Test verifikasi**: Uji struktur UI dan paritas key terjemahan di 4 file locale via unit test frontend.

### Langkah 5 — Verifikasi Akhir, Build Check, & Clean Commit ✅ Selesai
- **Perubahan**: Memastikan `typecheck` backend, semua test suite, dan alur aplikasi berjalan bersih tanpa regresi pada provider lain.
- **Test verifikasi**: Jalankan `npm run typecheck` di backend dan unit test suite di frontend.

### Langkah 6 — Pengalihan Sumber Update ke Repositori Sendiri (`mhdr1zky/huobao-drama`) ✅ Selesai
- **Perubahan**:
  - `backend/src/services/server-update.ts`: Default `FEED_URLS` dialihkan ke `https://github.com/mhdr1zky/huobao-drama/releases/latest/download/latest.json`.
  - `desktop/src/updater.ts`: Update feed Electron dialihkan ke repository `mhdr1zky/huobao-drama`.
  - `desktop/scripts/make-update-feed.mjs` & `desktop/scripts/publish-release.mjs`: Script rilis GitHub dialihkan ke `mhdr1zky/huobao-drama`.
  - `docker-compose.yml`: Contoh environment update dialihkan ke repo sendiri.
  - `frontend/app/layouts/default.vue`: Tombol logo link GitHub di navigasi atas diarahkan ke `https://github.com/mhdr1zky/huobao-drama`.
  - `README.md`, `readme-id.md`, `README.en.md`, `README.ja.md`, `README.ko.md`, `README.zh-CN.md`: Seluruh tautan clone, rilis, dan badge diarahkan ke repositori sendiri.
- **Test verifikasi**: `backend/tests/repo-update-check.test.ts` memverifikasi seluruh file rujukan update mengarah ke `mhdr1zky/huobao-drama`.

---

## 4. Risiko dan Mitigasinya

| Risiko | Mitigasi |
|---|---|
| Saldo pengguna terkuras jika pod GPU lupa dimatikan | **Auto-Destroy Timer Mandiri**: Server lokal memasang timer internal 15 menit setelah task video terakhir selesai; jika tidak ada task baru, instance otomatis dihapus melalui API Vast.ai. |
| Koneksi PC lokal lambat menyebabkan upload gambar/audio timeout | **Pre-flight Network Check**: Sistem mendeteksi latency tinggi dan otomatis menyesuaikan batas timeout fetch serta memberi peringatan ramah di UI. |
| Host GPU sewaan tiba-tiba offline di tengah render | **Auto-Failover & Resume**: Jika host tidak merespons healthcheck 3 kali berturut-turut, sistem menandai error dan menawarkan tombol *Recover Video* untuk menyewa host baru tanpa mengulang shot yang sudah selesai. |

---

## 5. Kriteria Selesai (*Definition of Done*)

1. Pengguna dapat memilih provider `vastai` di menu Pengaturan Video dan melakukan tes koneksi lokal & validasi API Key.
2. Algoritma pencarian otomatis memilih GPU terbaik dengan koneksi host tercepat dan terstabil.
3. Seluruh alur pembuatan video berjalan persis seperti provider bawaan (`processing` → `downloading` → `completed` → ekstraksi poster frame).
4. Instance GPU otomatis dihancurkan setelah periode idle untuk menghemat biaya pengguna.
5. Semua pesan dan UI terlokalisasi dalam 4 bahasa (`en`, `zh`, `ja`, `ko`) dan seluruh test lulus.
