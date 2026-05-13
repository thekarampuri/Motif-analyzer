const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path    = require('path');
const fs      = require('fs');
const license = require('./license');

const isDev = process.env.NODE_ENV === 'development';

// ── MUST be called before app.whenReady() ──
// Without this, the custom scheme is untrusted: JS runs but React can't
// hydrate (no fetch, no same-origin storage, no IPC), making all buttons dead.
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,       // relative URLs resolve correctly (like http://)
    secure: true,         // treated as a secure origin (like https://)
    supportFetchAPI: true,// fetch() works inside the page
    corsEnabled: true,    // cross-origin requests allowed
    stream: true,         // streaming responses supported
  },
}]);

// ── Folders ──
const MOTIF_WEAVE_DIR = 'C:\\MotifAnalyzer\\MotifWeave';
const FILL_WEAVE_DIR  = 'C:\\MotifAnalyzer\\FillToolWeave';
const IMAGE_EXTS      = new Set(['.bmp', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.map':  'application/json',
  '.txt':  'text/plain',
};

let mainWindow   = null;
let motifWatcher = null;
let fillWatcher  = null;

function ensureFolders() {
  [MOTIF_WEAVE_DIR, FILL_WEAVE_DIR].forEach(dir => {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  });
}

function readBitmapsFromFolder(dir) {
  const items = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const ext = path.extname(f).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      try {
        const buf  = fs.readFileSync(path.join(dir, f));
        const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                   : ext === '.png'  ? 'image/png'
                   : ext === '.bmp'  ? 'image/bmp'
                   : ext === '.gif'  ? 'image/gif'
                   : 'image/webp';
        items.push({ name: f, dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
      } catch (_) {}
    }
  } catch (_) {}
  return items;
}

function sendBitmaps() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('bitmaps-updated', {
    motif: readBitmapsFromFolder(MOTIF_WEAVE_DIR),
    fill:  readBitmapsFromFolder(FILL_WEAVE_DIR),
  });
}

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function startWatchers() {
  const send = debounce(sendBitmaps, 400);
  try { motifWatcher = fs.watch(MOTIF_WEAVE_DIR, send); } catch (_) {}
  try { fillWatcher  = fs.watch(FILL_WEAVE_DIR,  send); } catch (_) {}
}

// ── Custom app:// protocol — serves static Next.js out/ via fs (asar-safe) ──
function registerProtocol() {
  protocol.handle('app', (request) => {
    try {
      const reqUrl = new URL(request.url);
      // Strip query string / hash; keep only the path
      let pathname = decodeURIComponent(reqUrl.pathname);
      if (!pathname || pathname === '/') pathname = '/index.html';

      const rel     = pathname.replace(/^\/+/, '');          // remove leading slash
      const outDir  = path.join(app.getAppPath(), 'out');
      const resolved = path.normalize(path.join(outDir, rel));

      // Prevent path traversal
      if (!resolved.startsWith(path.normalize(outDir))) {
        return new Response('Forbidden', { status: 403 });
      }

      // Try exact path → .html extension → directory index
      for (const candidate of [resolved, resolved + '.html', path.join(resolved, 'index.html')]) {
        try {
          const stat = fs.statSync(candidate);
          if (!stat.isFile()) continue;
          const content = fs.readFileSync(candidate);
          const ext     = path.extname(candidate).toLowerCase();
          const mime    = MIME_TYPES[ext] || 'application/octet-stream';
          return new Response(content, { status: 200, headers: { 'Content-Type': mime } });
        } catch (_) {}
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#f0ede8',
    webPreferences: {
      // Use app.getAppPath() so the preload resolves correctly in production asar
      preload: path.join(app.getAppPath(), 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://app/index.html');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('did-finish-load', sendBitmaps);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── License window ──
function createLicenseWindow() {
  const licWin = new BrowserWindow({
    width: 500,
    height: 510,
    resizable: false,
    maximizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    title: 'Motif Analyzer — Activation',
    backgroundColor: '#1a1814',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'license-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  licWin.loadFile(path.join(app.getAppPath(), 'electron', 'license-window.html'));
  licWin.once('ready-to-show', () => licWin.show());
  licWin.on('closed', () => { if (!mainWindow) app.quit(); });
}

// ── IPC: license ──
ipcMain.handle('get-machine-id', () => license.getMachineId());

ipcMain.handle('try-activate', (event, licenseKey) => {
  const machineId = license.getMachineId();
  if (license.verifyLicense(machineId, licenseKey)) {
    license.saveLicense(machineId, licenseKey);
    // Short delay so the success message is visible before the window transitions
    setTimeout(() => {
      const licWin = BrowserWindow.fromWebContents(event.sender);
      createWindow();
      if (licWin && !licWin.isDestroyed()) licWin.close();
    }, 900);
    return { success: true };
  }
  return { success: false, error: 'Invalid license key for this machine.' };
});

// ── IPC: save BMP file ──
ipcMain.handle('save-bmp', async (_event, { fileName, buffer }) => {
  try {
    fs.writeFileSync(fileName, Buffer.from(buffer));
    return { success: true, path: fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: native save dialog ──
ipcMain.handle('show-save-dialog', async (_event, { defaultName, defaultDir }) => {
  const { dialog } = require('electron');
  const dir = defaultDir || path.join(require('os').homedir(), 'Downloads');
  return dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(dir, defaultName || 'motif_export.bmp'),
    filters: [{ name: 'BMP Image', extensions: ['bmp'] }],
  });
});

// ── IPC: renderer requests fresh bitmap list ──
ipcMain.on('request-bitmaps', sendBitmaps);

// ── IPC: save generic file ──
ipcMain.handle('save-file', async (_event, { fileName, buffer }) => {
  try {
    fs.writeFileSync(fileName, Buffer.from(buffer));
    return { success: true, path: fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: save dialog with format ──
ipcMain.handle('show-save-dialog-format', async (_event, { defaultName, format, defaultDir }) => {
  const { dialog } = require('electron');
  const filters = {
    png:  [{ name: 'PNG Image',           extensions: ['png']        }],
    tiff: [{ name: 'TIFF Image',          extensions: ['tiff', 'tif']}],
    maf:  [{ name: 'Motif Analyzer File', extensions: ['maf']        }],
  };
  const dir = defaultDir || path.join(require('os').homedir(), 'Downloads');
  return dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(dir, defaultName),
    filters: filters[format] || filters.png,
  });
});

// ── IPC: open project dialog ──
ipcMain.handle('show-open-project-dialog', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Motif Analyzer File', extensions: ['maf'] }],
    properties: ['openFile'],
  });
  return { canceled: result.canceled, filePath: result.filePaths?.[0] };
});

// ── IPC: save project JSON ──
ipcMain.handle('save-project', async (_event, { filePath, data }) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: load project JSON ──
ipcMain.handle('load-project', async (_event, { filePath }) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  ensureFolders();
  registerProtocol();

  // Skip license check in dev mode so `npm run dev:electron` works normally
  if (isDev || license.loadAndVerify()) {
    createWindow();
  } else {
    createLicenseWindow();
  }

  startWatchers();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (motifWatcher) { try { motifWatcher.close(); } catch (_) {} }
  if (fillWatcher)  { try { fillWatcher.close();  } catch (_) {} }
  if (process.platform !== 'darwin') app.quit();
});
