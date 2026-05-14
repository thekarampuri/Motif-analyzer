# Motif Analyzer

A Windows desktop application for analyzing and filling textile motif patterns with weave bitmaps. Built with Electron + Next.js.

---

## What it does

Motif Analyzer takes a black-and-white textile motif image and automatically detects each motif shape. You can then paint weave patterns (from a bitmap library) onto the motifs using several fill modes, preview vertical float threads, highlight long floats, erase or switch motifs, and export the result as an 8-bit BMP file ready for production.

---

## Features

| Feature | Description |
|---|---|
| **Auto detection** | Finds all motif shapes in the image using BFS connected components + Zhang-Suen skeletonization |
| **Motif Weave** | Paints a tiled weave bitmap onto each detected motif |
| **Fill Tool** | Flood-fills any region with a separate fill-tool weave bitmap |
| **Fill Modes** | Whole · Inside · Border · Vert Border ≥ · Inside + Vert |
| **Float Fill** | Detects vertical thread floats above a set length and previews/bakes them |
| **Highlight Float** | Overlays a color on all floats longer than a given length |
| **Erase** | Click to erase a motif; right-click to restore |
| **Lasso Erase** | Draw a freehand polygon to erase multiple motifs at once |
| **Switch L/R** | Flip the weave side (left ↔ right) for any motif or filled region |
| **Pen** | Paint or remove individual pixels; Space to eyedrop color |
| **Undo / Redo** | 100-level history |
| **Export** | Save as 8-bit indexed BMP via native save dialog |
| **Bitmap Library** | Live-loaded from two watched folders; drop in new bitmaps without restarting |
| **Dark / Light mode** | Persisted per machine |
| **Zoom** | 1× – 32× with scroll wheel or buttons |
| **Drag & drop** | Drop an image file directly onto the canvas |
| **License protection** | Offline hardware-locked activation (ECDSA P-256) |

---

## Tech stack

- **Electron 31** — desktop shell, IPC, file system, native save dialog
- **Next.js 15** — React UI (static export, served via custom `app://` protocol)
- **React 19 + TypeScript**
- **Tailwind CSS v3**
- **electron-builder 24** — NSIS installer for Windows

---

## Project structure

```
├── electron/
│   ├── main.js               # Main process: window, protocol, IPC, license check
│   ├── preload.js            # Exposes electronAPI to renderer
│   ├── license.js            # Machine ID generation + ECDSA verification
│   ├── license-preload.js    # Preload for activation window
│   └── license-window.html   # Activation screen UI
│
├── app/                      # Next.js app router
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── MotifAnalyzer.tsx     # Root component — wires engine to UI
│   ├── Header.tsx            # Toolbar (undo/redo, export, reset, theme)
│   ├── LeftPanel.tsx         # Settings panel (tools, fill, highlight, bitmap pickers)
│   └── CanvasArea.tsx        # Canvas + overlay + zoom controls
│
├── hooks/
│   └── useMotifEngine.ts     # All canvas/analysis logic as a React hook
│
├── lib/
│   ├── motifEngine.ts        # Pure functions: BFS, skeleton, fill cache, BMP export
│   └── types.ts              # Shared TypeScript types
│
├── tools/
│   ├── keygen.js             # Developer tool: generates license keys (keep private)
│   └── private.key           # ECDSA private key (never commit, never share)
│
└── release/
    └── Motif Analyzer Setup 1.0.0.exe   # Distributable installer
```

---

## Bitmap library folders

The app auto-creates these folders on first launch and watches them for changes:

```
C:\MotifAnalyzer\MotifWeave\       ← Motif weave bitmaps
C:\MotifAnalyzer\FillToolWeave\    ← Fill tool weave bitmaps
```

Drop any image file (`.bmp`, `.png`, `.jpg`, `.gif`, `.webp`) into either folder. The dropdown in the app updates automatically — no restart needed.

---

## Development

### Prerequisites
- Node.js 18+
- npm

### Install dependencies
```bash
npm install
```

### Run in development mode
```bash
npm run dev:all
```
This starts the Next.js dev server on port 3000 and launches Electron pointing at it. The license check is skipped in dev mode.

### Run Electron only (if Next.js is already running)
```bash
npm run dev:electron
```

---

## Building the installer

```bash
npm run build:next          # Compile Next.js to out/
npm run dist                # Package into release/Motif Analyzer Setup 1.0.0.exe
```

Or in one command:
```bash
npm run dist
```

The installer is created at `release/Motif Analyzer Setup 1.0.0.exe`.  
The `release/win-unpacked/` folder can be deleted after the build — only the `.exe` is needed.

---

## License system

The app uses offline hardware-locked activation. Each `.exe` install is tied to one machine.

### One-time setup (already done — do not repeat)

```bash
node tools/keygen.js --setup
```

This generates `tools/private.key` and prints the public key that is embedded in `electron/license.js`. **Back up `private.key` securely — losing it means you cannot generate new licenses.**

### Activating a customer

1. Customer installs the `.exe` → activation screen appears showing their **Machine ID**
2. Customer sends you the Machine ID
3. You run:
   ```bash
   node tools/keygen.js <MACHINE-ID>
   ```
4. Copy the printed **License Key** and send it to the customer
5. Customer pastes the key into the activation screen → app unlocks permanently on that machine

### If a customer changes their hardware

Their Machine ID changes. They send you the new ID, you generate a new license key with the same command.

---

## Key files to never commit

```
tools/private.key      # ECDSA private key — anyone with this can generate unlimited licenses
```

---

## Scripts reference

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server only |
| `npm run dev:electron` | Start Electron only (needs Next.js running) |
| `npm run dev:all` | Start both together |
| `npm run build:next` | Build Next.js static export to `out/` |
| `npm run dist` | Build Next.js + package Windows installer |
| `node tools/keygen.js --setup` | Show public key (key pair already generated) |
| `node tools/keygen.js <ID>` | Generate license key for a customer |
