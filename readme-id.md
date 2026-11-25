# 🎬 Huobao Drama — Platform Pembuatan Drama Pendek Berbasis AI

<div align="center">

**Platform Full-Stack TypeScript untuk Otomatisasi Produksi Drama Pendek AI**

[![Node Version](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js)](https://nodejs.org)
[![Vue Version](https://img.shields.io/badge/Vue-3.x-4FC08D?style=flat&logo=vue.js)](https://vuejs.org)
[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Download](https://img.shields.io/github/v/release/mhdr1zky/huobao-drama?style=flat&logo=github&label=Download)](https://github.com/mhdr1zky/huobao-drama/releases/latest)

[English](README.md) | **Bahasa Indonesia** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[Fitur](#-fitur) • [Mulai Cepat](#-mulai-cepat) • [Panduan Visual](#-panduan-visual) • [Aplikasi Desktop](#-aplikasi-desktop-direkomendasikan) • [Deployment](#-deployment)

<p>
  <a href="https://api.firemux.com">
    <img src="docs/images/api-key-cta-en.svg" width="380" alt="Dapatkan API Key FireMux" />
  </a>
</p>

<p>
  <a href="https://firemux.cn/#opensource">
    <img src="docs/images/open-source-download-cta-en.svg" width="380" alt="Open Source &amp; Unduhan" />
  </a>
</p>

</div>

---

## 📖 Ringkasan Proyek

Huobao Drama adalah platform produksi drama pendek berbasis kecerdasan buatan (AI) yang mengotomatisasi seluruh alur produksi: dari naskah, desain karakter, pemecahan storyboard, hingga perakitan video akhir.

### 🎯 Nilai Utama

- **🤖 Berbasis AI**: LLM mengurai naskah dan mengekstrak tokoh, adegan/lokasi, dan storyboard.
- **🎨 Kreasi Cerdas**: Generasi gambar AI untuk desain konsisten tokoh dan latar adegan.
- **📹 Generasi Video**: Model Text-to-Video dan Image-to-Video otomatis menghasilkan klip per adegan.
- **🔄 Alur Kerja Lengkap**: Dari ide novel/naskah kasar hingga menjadi video episode utuh siap tonton.

### 🛠️ Struktur Arsitektur

```text
frontend/   — Nuxt 3 + Vue 3 + TypeScript (CSS murni tanpa framework UI)
backend/    — Hono + Drizzle ORM + Mastra AI Agents + better-sqlite3
backend/workspace/skills/ — Definisi Skill Agent (SKILL.md, dapat diedit di web)
desktop/    — Aplikasi Desktop Electron (main process + esbuild + electron-builder dmg/exe)
data/       — Aset media yang dihasilkan dan database SQLite lokal
```

---

## ✨ Fitur

### 🎭 Manajemen Karakter
- ✅ Generasi penampilan karakter dengan AI
- ✅ Batch generasi karakter sekaligus
- ✅ Unggah dan kelola foto referensi karakter

### 🎬 Tugas Video
- ✅ Pembuatan tugas video otomatis berbasis AI
- ✅ Prompt visual adegan & prompt gerak kamera otomatis
- ✅ Generasi video massal (batch) per tugas episode

### 🎥 Generasi Video
- ✅ Text-to-video & Image-to-video
- ✅ FFmpeg untuk penggabungan per adegan dan pemrosesan subtitle
- ✅ Penggabungan satu episode penuh dan ekspor MP4

### 📦 Manajemen Aset
- ✅ Pustaka aset terpadu (Karakter, Adegan, Properti)
- ✅ Penyimpanan data lokal tanpa ketergantungan server cloud eksternal
- ✅ Pelacakan progres generasi tugas

### 🤖 AI Agents
Dilengkapi 4 Agent bawaan berbasis Mastra framework:

| Agent | Peran / Tugas |
|---|---|
| `script_rewriter` | Mengubah novel/teks kasar → naskah terformat dengan adegan & dialog |
| `extractor` | Ekstraksi otomatis tokoh, adegan, dan properti beserta deduplikasi |
| `storyboard_breaker` | Pemecahan naskah menjadi adegan storyboard terukur |
| `prompt_generator` | Pembuatan prompt gambar konsisten dan prompt video gerak |

### 🌐 Antarmuka Multi-Bahasa
Tersedia dalam **English / Bahasa Indonesia / 中文 / 日本語 / 한국어**, dengan pengaturan global untuk bahasa konten yang dihasilkan oleh AI.

### 🔌 Dukungan Provider Luas (Termasuk Custom API & GPU Pod)

| Tipe | Provider yang Didukung |
|---|---|
| **Teks** | OpenAI (dan gateway kompatibel seperti OpenRouter/DeepSeek/SiliconFlow/Ollama), Gemini, Volcengine, Custom API |
| **Gambar** | OpenAI (DALL-E / Flux via OpenAI-compatible), Gemini, Volcengine, Custom API |
| **Video** | Volcengine Seedance 2.0 (Standard / Fast / Mini), MiniMax H3, Alibaba Wan 3.0, **Vast.ai GPU Pod Auto-Rental (ComfyUI)**, Custom Video API |

---

## 🚀 Mulai Cepat

### 📋 Kebutuhan Sistem

| Perangkat Lunak | Versi Minimal | Keterangan |
|---|---|---|
| **Node.js** | 20+ | Runtime backend & frontend |
| **npm** | 9+ | Package manager |

> **Tanpa Instalasi Database**: Menggunakan SQLite bawaan (`better-sqlite3` + WAL mode) dalam satu file di folder data lokal.  
> **Tanpa Instalasi FFmpeg**: Binary FFmpeg dan FFprobe sudah terpaket otomatis melalui dependensi npm.

### ⚙️ Variabel Lingkungan

Konfigurasi bersifat opsional dengan nilai bawaan siap pakai:

| Variabel | Bawaan | Keterangan |
|---|---|---|
| `SQLITE_PATH` | `<repo>/data/huobao.sqlite3` | Lokasi file database SQLite |
| `PORT` | `5679` | Port layanan backend |
| `STORAGE_PATH` | `<repo>/data/static` | Direktori file media hasil render |
| `WORKSPACE_PATH` | `backend/workspace` | Direktori prompt & skill agent |
| `FRONTEND_DIST` | `frontend/dist` | Direktori hasil build statis frontend |

> **Catatan**: API Key AI dan konfigurasi model diatur langsung di halaman **Settings** pada UI web, tidak perlu mengubah file `.env`.

### 📥 Pemasangan Dependensi

```bash
# Clone repositori
git clone https://github.com/mhdr1zky/huobao-drama.git
cd huobao-drama

# Pasang dependensi backend
cd backend && npm install

# Pasang dependensi frontend
cd ../frontend && npm install
```

### 🎯 Menjalankan Aplikasi

#### Cara 1: Menggunakan Skrip Cepat Windows (Rekomendasi)
Klik ganda file `start.bat` di folder utama proyek, atau jalankan via terminal:
```cmd
.\start.bat
```
Skrip ini akan otomatis menyalakan backend, frontend, dan membuka browser di `http://localhost:3013`.

#### Cara 2: Manual Development Mode
Jalankan di dua jendela terminal:

```bash
# Terminal 1: Backend (port 5679)
cd backend
npm run dev

# Terminal 2: Frontend (port 3013)
cd frontend
npm run dev
```

Buka browser di: `http://localhost:3013`.

---

## 📖 Panduan Visual

Alur lengkap pembuatan drama dari novel hingga video selesai:

1. **Langkah 1 · Buat Proyek**: Pilih rasio layar (16:9 horizontal atau 9:16 vertikal) dan gaya visual seni.
2. **Langkah 2 · Atur Layanan AI**: Buka menu Settings untuk memasukkan API Key atau atur provider Custom / Vast.ai.
3. **Langkah 3 · Tahap Naskah**: Tempel novel/teks sumber dan klik **AI Rewrite** untuk memecahnya ke format naskah drama.
4. **Langkah 4 · Ekstraksi Aset**: Klik ekstraksi karakter & adegan, lalu hasilkan gambar referensi konsisten.
5. **Langkah 5 · Storyboard & Video**: Jalankan pemecahan storyboard, tinjau prompt video tiap adegan, dan klik **Generate Video**.
6. **Langkah 6 · Penggabungan (Merge) & Ekspor**: Pilih adegan yang sudah selesai dirender dan klik gabung untuk mengekspor episode utuh.

---

## 🖥️ Aplikasi Desktop (Direkomendasikan)

Installer mandiri tersedia di [GitHub Releases](https://github.com/mhdr1zky/huobao-drama/releases/latest) untuk **Windows x64** dan **macOS (Apple Silicon & Intel)**.

Untuk mem-package sendiri dari source code:
```bash
npm run dist        # Menghasilkan macOS dmg
npm run dist:win    # Menghasilkan Windows Setup.exe
```

---

## 🎨 Tech Stack

- **Backend**: Node.js 20+, Hono, Drizzle ORM, SQLite (`better-sqlite3`), Mastra AI Framework, Fluent-FFmpeg, Sharp.
- **Frontend**: Nuxt 3 (SPA mode), Vue 3, TypeScript, Pure CSS, Lucide Icons, vue-i18n.
- **Desktop**: Electron, esbuild, electron-builder.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **[CC BY-NC-SA 4.0](LICENSE)** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International).

- ✅ Penggunaan pribadi, edukasi, dan proyek non-komersial dipersilakan.
- ✅ Modifikasi dan distribusi ulang diperbolehkan dengan atribusi yang sesuai dan lisensi yang sama.
- ❌ **Penggunaan komersial dilarang** tanpa izin tertulis dari pembuat asli.
