# Project Context — Huobao Drama (火宝短剧)

> Dokumen ini dibuat sebagai hasil analisis awal repositori sebelum melakukan modifikasi kode.

---

## 1. Tujuan Proyek dan Fitur Utama

**Huobao Drama (火宝短剧)** adalah platform otomatisasi produksi drama pendek berbasis AI (*AI Short Drama Generation Platform*) dengan arsitektur full-stack TypeScript. Proyek ini mengotomatisasi alur pembuatan drama dari teks sumber/novel hingga menjadi video episode utuh.

### Fitur Utama
- **Manajemen Proyek & Episode**: Pembuatan proyek drama dengan pilihan rasio aspek (`16:9` / `9:16`, tetap setelah dibuat) dan preset gaya visual (*style presets*).
- **Pipeline Produksi End-to-End**:
  1. **Script Rewriting**: Mengubah teks novel/mentah menjadi naskah terformat (header scene, aksi, dialog) menggunakan AI Agent.
  2. **Asset Extraction & Dedup**: Ekstraksi otomatis karakter, scene, dan prop penting dari naskah dengan deduplikasi terhadap aset yang sudah ada di proyek.
  3. **Asset Visual & Suara**: Generasi prompt & gambar referensi untuk karakter, scene, dan prop; serta manajemen audio referensi suara karakter.
  4. **Storyboard Breakdown**: Pemecahan naskah menjadi segmen storyboard (durasi 8–15 detik per segmen, terdiri dari beberapa sub-shot) lengkap dengan prompt video.
  5. **Video Generation & Export**: Generasi klip video per storyboard dan penggabungan/ekspor video satu episode penuh menggunakan FFmpeg.
- **4 Mastra AI Agents**: `script_rewriter`, `extractor`, `storyboard_breaker`, dan `prompt_generator`, dengan instruksi berbasis file Markdown (`backend/workspace/prompts/*.md` & `skills/*/SKILL*.md`) yang dapat diedit langsung melalui UI.
- **Multi-Provider AI**:
  - **Text**: OpenAI (dan API kompatibel), Gemini.
  - **Image**: OpenAI, Gemini, Volcengine (火山引擎).
  - **Video**: Volcengine Seedance 2.0 (Standard/Fast/Mini), MiniMax H3, Alibaba Bailian Wan 3.0 (Prime/Standard).
- **Multi-Bahasa & Multi-Platform**: UI mendukung 4 bahasa (`zh`, `en`, `ja`, `ko`) beserta pengaturan bahasa konten AI; dapat dijalankan sebagai Web/Server (Node.js / Docker) maupun aplikasi Desktop (Electron untuk macOS & Windows).

---

## 2. Tech Stack, Bahasa, Framework, dan Dependensi Penting

- **Bahasa**: TypeScript (full-stack; ESM di `backend/` dan `frontend/`, output CJS untuk main process `desktop/`).
- **Backend (`backend/`)**:
  - **Runtime & HTTP**: Node.js 20+, `hono` (`^4.12.9`), `@hono/node-server`, `tsx` (`^4.21.0`).
  - **Database**: `better-sqlite3` (`^12.4.1`, mode WAL) dengan `drizzle-orm` (`^0.45.1`). Mendukung migrasi otomatis satu kali dari MySQL (`mysql2`).
  - **AI & Agents**: `@mastra/core` (`^1.17.0`), `@ai-sdk/openai`, `@ai-sdk/google`.
  - **Media & Utilitas**: `fluent-ffmpeg`, `ffmpeg-static`, `ffprobe-static`, `sharp`, `pino`, `zod`, `uuid`, `dotenv`.
- **Frontend (`frontend/`)**:
  - **Framework**: Nuxt 3 (`^3.17.5`, mode SPA `ssr: false`), Vue 3 (`^3.5.13`), Vue Router (`^4.5.1`).
  - **Styling & UI**: Pure CSS (`app/assets/studio.css`), tanpa library komponen UI eksternal; ikon `lucide-vue-next`, toast `vue-sonner`, tur interaktif `driver.js`, i18n `vue-i18n` (`^11.4.10`).
- **Desktop (`desktop/`)**:
  - **Shell & Bundling**: Electron (`37.10.3`), `electron-builder` (`^26.15.3`), `esbuild` (`^0.28.2`).
  - **Native Modules**: `better-sqlite3`, `sharp`, `ffmpeg-static`, `ffprobe-static`.

---

## 3. Struktur Folder dan Peran Tiap Modul

```text
huobao-drama/
├── package.json              # Script orkestrasi root (dev:backend, dev:frontend, dev:desktop, build:frontend, dist)
├── Dockerfile & docker-compose.yml  # Containerisasi multi-stage (frontend generate + backend tsx + system ffmpeg)
├── CLAUDE.md                 # Ringkasan arsitektur & panduan teknis internal repo
├── configs/                  # Konfigurasi legacy (tidak direferensikan oleh kode aktif)
├── data/                     # Direktori default SQLite (huobao.sqlite3) & aset statis (static/)
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point server Hono, middleware, static serving, /api/v1/* routes
│   │   ├── agents/           # Definisi 4 Mastra Agent, pemuat prompt/skill, dan tools/
│   │   ├── db/               # Koneksi SQLite (index.ts), skema Drizzle (schema.ts), DDL (sqlite-schema.ts), migrasi MySQL
│   │   ├── middleware/       # Request logger & error handler
│   │   ├── routes/           # 17 modul route REST API (/dramas, /episodes, /storyboards, /tasks, /agent, /merge, dll.)
│   │   ├── services/         # Logika bisnis (generation.ts, adapters/, ffmpeg-merge.ts, extraction.ts, ai.ts, dll.)
│   │   └── utils/            # Path anchor (paths.ts), storage, ffmpeg wrapper, video-poster, task-logger
│   ├── workspace/            # Prompt (.md) & skill (SKILL.md) agent per bahasa
│   ├── scripts/              # Utilitas CLI (backfill-artwork.ts, import-mysql-to-sqlite.ts)
│   └── tests/                # Unit & structure tests (node:test)
├── frontend/
│   ├── nuxt.config.ts        # Konfigurasi Nuxt SPA, manual route registration, Vite dev proxy
│   ├── app/
│   │   ├── pages/            # Halaman utama (index.vue) dan pengaturan (settings.vue)
│   │   ├── views/drama/      # Detail proyek (detail.vue) dan workbench produksi utama (episode.vue)
│   │   ├── composables/      # Client API (useApi.ts), agent, media, desktop bridge, i18n, tema, toast
│   │   ├── components/       # Komponen UI reusable (ModelSelect, MentionTextarea, BaseSelect, dll.)
│   │   ├── locales/          # File terjemahan (zh.json, en.json, ja.json, ko.json)
│   │   └── assets/           # studio.css & aset visual
│   └── tests/                # Structure & utility tests
└── desktop/
    ├── src/                  # Main process Electron (main.ts), migrasi storage, auto-updater, startup healthcheck
    ├── scripts/              # Bundling esbuild (build-backend.mjs, build-main.mjs) & packaging electron-builder
    └── tests/                # Unit tests startup & packaging Electron
```

---

## 4. Alur Kerja Utama (Entry Point, Alur Data, Arsitektur)

### Entry Point & Mode Eksekusi
1. **Mode Development**:
   - Backend berjalan via `tsx watch backend/src/index.ts` di port `5679`.
   - Frontend berjalan via `nuxt dev --port 3013` dan mem-proxy `/api` serta `/static` ke `http://localhost:5679`.
2. **Mode Single-Service / Docker**:
   - Backend Hono melayani API `/api/v1/*`, file statis `/static/*` dari `DATA_ROOT`, serta file frontend statis hasil `nuxt generate` dari `FRONTEND_DIST` (default `frontend/dist`).
3. **Mode Desktop (Electron)**:
   - `desktop/src/main.ts` mengambil single-instance lock, mencari port lokal bebas, menyiapkan `userData` (`HuobaoDrama` atau `HuobaoDrama-Dev`) beserta salinan `workspace`, lalu menjalankan bundle backend (`build/backend.mjs`) melalui `utilityProcess.fork` dengan injeksi env (`HUOBAO_DATA_DIR`, `SQLITE_PATH`, `WORKSPACE_PATH`, `FRONTEND_DIST`, `FFMPEG_BIN`, `FFPROBE_BIN`). Setelah `/api/v1/health` siap, `BrowserWindow` memuat URL lokal backend secara同源 (*same-origin*).

### Alur Data & Arsitektur Produksi
- **Frontend → Backend**: Seluruh pemanggilan API melalui `frontend/app/composables/useApi.ts` dengan path relatif `/api/v1/*`.
- **AI Text & Agent Pipeline**: Endpoint `/api/v1/agent` dan route terkait memanggil Mastra Agent (`backend/src/agents/index.ts`), yang merakit instruksi secara dinamis dari `workspace/prompts/*.md` + `workspace/skills/*/SKILL*.md` + bahasa target, lalu membaca/menulis ke SQLite melalui Drizzle tools (`extract-tools.ts`, `script-tools.ts`, `storyboard-tools.ts`, `image-prompt-tools.ts`).
- **Media Generation Pipeline (`services/generation.ts`)**:
  - Request pembuatan gambar/video membuat record di tabel `sys_task` (status `processing`).
  - Memilih adapter vendor via `services/adapters/registry.ts` (`openai`, `gemini`, `volcengine`, `minimax`, `aliyun`).
  - Proses latar belakang (`runBackground`) melakukan eksekusi sinkron atau polling asinkron (`POLL_PROFILES`: gambar 5s×120, video 10s×300), mengunduh hasil media ke `STORAGE_ROOT` (`data/static/`), membuat thumbnail/poster, dan memperbarui tabel bisnis terkait.
  - Saat server restart, `resumeInterruptedTasks()` melanjutkan tugas yang sempat terputus.
- **Database**: `backend/src/db/index.ts` menginisialisasi SQLite (WAL mode) dan menjalankan `initSqliteSchema` (DDL idempoten + seed preset gaya) setiap startup. Terdapat 18 tabel di `schema.ts` (termasuk `dramas`, `episodes`, `characters`, `scenes`, `props`, `storyboards`, `sys_task`, `video_merges`, `ai_service_configs`, `ai_service_providers`, `style_presets`, `app_settings`).

---

## 5. Cara Install, Menjalankan, Build, dan Test

### Install Dependensi
```bash
cd backend && npm install
cd ../frontend && npm install
# Opsional (untuk mode desktop Electron):
cd ../desktop && npm install
```

### Menjalankan Development
```bash
# Terminal 1 - Backend (port 5679)
npm run dev:backend

# Terminal 2 - Frontend (port 3013)
npm run dev:frontend

# Atau mode Desktop Electron:
npm run dev:desktop
```

### Build & Produksi
- **Single-Service Web**:
  ```bash
  cd frontend && npm run generate
  # Salin hasil .output/public ke frontend/dist (sesuai FRONTEND_DIST)
  cd ../backend && npm start
  ```
- **Docker**: Menggunakan `Dockerfile` multi-stage (`docker compose up`).
- **Desktop Installer**:
  - macOS: `cd desktop && npm run dist`
  - Windows: `cd desktop && npm run dist:win`

### Typecheck & Test
- **Typecheck Backend**: `cd backend && npm run typecheck` (`tsc --noEmit`).
- **Unit & Structure Tests**: Proyek menggunakan `node:test` pada direktori `backend/tests/`, `frontend/tests/`, dan `desktop/tests/` (dijalankan dengan `node --test`, serta dukungan TypeScript via `tsx` / Node strip-types sesuai skrip test masing-masing).

---

## 6. Konvensi Kode (Penamaan, Gaya, Pola Desain)

- **Import & Modul**: Backend menggunakan ESM (`"type": "module"`) dengan ekstensi `.js` pada import relatif antar file TS di `src/` (sesuai `moduleResolution: "bundler"` dan dieksekusi oleh `tsx` atau dibundel `esbuild`).
- **Konfigurasi AI**: Semua API key, base URL, dan model layanan AI disimpan di database (`ai_service_configs` & `ai_service_providers`) melalui halaman Settings UI, bukan di file `.env` atau YAML.
- **Path Resolution**: Wajib melalui `DATA_ROOT` dan `STORAGE_ROOT` di `backend/src/utils/paths.ts` agar kompatibel di dev, Docker, dan Electron packaged.
- **Adapter Pattern**: Integrasi provider gambar/video diisolasi di `backend/src/services/adapters/` dengan interface seragam pada `types.ts` dan registrasi di `registry.ts`.
- **Frontend Routing & Styling**: Halaman berparameter dinamis diletakkan di `frontend/app/views/` dan didaftarkan manual pada hook `pages:extend` di `nuxt.config.ts` (menghindari tanda `[id]` pada nama file/folder). Styling menggunakan pure CSS di `studio.css`.
- **Konvensi Penamaan**: Tabel dan field API umumnya menggunakan `snake_case`, sedangkan simbol TypeScript/JS menggunakan `camelCase` dan komponen Vue menggunakan `PascalCase`.

---

## 7. Area Rawan Rusak Jika Diubah

1. **`frontend/app/views/drama/episode.vue`**: File sangat besar (~6.264 baris) yang mengelola hampir seluruh state dan alur workbench episode. Perubahan kecil pada state, polling, atau event handler berisiko menimbulkan regresi lintas tahap.
2. **`backend/src/utils/paths.ts` & `backend/src/db/index.ts`**: Mengandalkan struktur direktori relatif (`../../..`) saat dev dan variabel lingkungan injeksi (`HUOBAO_DATA_DIR`, `SQLITE_PATH`, `STORAGE_PATH`, `WORKSPACE_PATH`) saat berjalan di Electron/Docker. Salah mengubah logika fallback dapat merusak penyimpanan aset atau database di versi desktop/container.
3. **`backend/src/db/schema.ts` vs `backend/src/db/sqlite-schema.ts`**: Skema Drizzle dan DDL startup (`initSqliteSchema`) dikelola terpisah. Mengubah kolom/tabel hanya di satu tempat akan menyebabkan error runtime saat startup atau query.
4. **`backend/src/services/generation.ts` & `adapters/*`**: Mengatur dedup submission (`activeTasks`, `videoSubmissions`), polling timeout, download atomik, dan pemulihan tugas saat startup (`resumeInterruptedTasks`). Perubahan pada kontrak response adapter atau urutan write-back bisa menyebabkan tugas menggantung atau aset gagal tersimpan.
5. **`desktop/scripts/build-backend.mjs` & `desktop/src/main.ts`**: Modul native (`better-sqlite3`, `sharp`, `ffmpeg-static`, `ffprobe-static`) di-mark sebagai external untuk asar/unpacked resolution. Selain itu, `TEMPLATE_VERSION` di `main.ts` mengatur sinkronisasi file `workspace/` ke direktori user.
6. **`frontend/nuxt.config.ts` (`nuxt generate` vs `nuxt build`)**: Backend dan Electron mengharapkan output statis yang memiliki `index.html` (`.output/public` dari `nuxt generate`), bukan hasil `nuxt build`.

---

## 8. Pertanyaan atau Hal yang Masih Belum Jelas

1. **Ruang Lingkup Modifikasi**: Fitur atau bug spesifik apa yang ingin Anda kerjakan? (Pada prompt sebelumnya masih terdapat placeholder `[nama-branch, misal feat/nama-fitur]` dan `[tempel di sini]`).
2. **Target Lingkungan**: Apakah perubahan nanti ditujukan untuk mode Web/Docker saja, Desktop Electron (Windows/macOS), atau keduanya?
3. **Nama Branch**: Saat ini saya telah membuat branch `docs/context-analysis` agar `master` tetap bersih. Apakah Anda ingin melanjutkan di branch ini atau mengganti namanya sesuai fitur yang akan dibuat?
