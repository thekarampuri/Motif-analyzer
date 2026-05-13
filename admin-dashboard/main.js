const { app, BrowserWindow, ipcMain, clipboard, dialog, Menu } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const os     = require('os');

app.setName('Motif Analyzer Admin');

const isDev = process.env.NODE_ENV === 'development';

// ── Paths ──
function getPrivateKeyPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'private.key')
    : path.join(__dirname, '..', 'tools', 'private.key');
}

function getStoragePath() {
  return path.join(app.getPath('userData'), 'licenses.json');
}

// ── Storage ──
function loadLicenses() {
  try {
    const raw  = fs.readFileSync(getStoragePath(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.licenses) ? data.licenses : [];
  } catch {
    return [];
  }
}

function saveLicenses(licenses) {
  const dir = path.dirname(getStoragePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getStoragePath(), JSON.stringify({ licenses }, null, 2), 'utf8');
}

// ── Key generation (same ECDSA logic as tools/keygen.js) ──
function generateLicenseKey(machineId) {
  const keyPath = getPrivateKeyPath();
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Private key not found.\nExpected at: ${keyPath}`);
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(machineId.toUpperCase().trim());
  return sign.sign(privateKey).toString('base64');
}

// ── Window ──
let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'app-logo.png');

  mainWindow = new BrowserWindow({
    width:     1200,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    backgroundColor: '#0d0f17',
    icon:  fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    title: 'Motif Analyzer — Admin Dashboard',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    show: false,
  });

  // Clear disk cache in dev so HTML/CSS changes are always picked up immediately
  if (isDev) {
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC ──
ipcMain.handle('check-ready', () => ({
  keyExists:   fs.existsSync(getPrivateKeyPath()),
  storagePath: getStoragePath(),
}));

ipcMain.handle('get-licenses', () => loadLicenses());

ipcMain.handle('generate-license', (_ev, { name, business, email, machineId, notes }) => {
  const normalizedId = machineId.toUpperCase().trim();
  const licenseKey   = generateLicenseKey(normalizedId);

  const record = {
    id:        crypto.randomUUID(),
    name:      name.trim(),
    business:  (business || '').trim(),
    email:     (email    || '').trim(),
    machineId: normalizedId,
    licenseKey,
    notes:     (notes    || '').trim(),
    createdAt: new Date().toISOString(),
  };

  const licenses = loadLicenses();
  licenses.unshift(record);
  saveLicenses(licenses);
  return record;
});

ipcMain.handle('delete-license', (_ev, id) => {
  saveLicenses(loadLicenses().filter(l => l.id !== id));
  return true;
});

ipcMain.handle('copy-text', (_ev, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('export-csv', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(os.homedir(), 'Desktop', 'motif-licenses.csv'),
    filters: [{ name: 'CSV File', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return { success: false };

  const licenses = loadLicenses();
  const header   = '"#","Name","Business","Email","Machine ID","License Key","Created At","Notes"';
  const rows     = licenses.map((l, i) =>
    [i + 1, l.name, l.business, l.email, l.machineId, l.licenseKey, l.createdAt, l.notes]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );

  fs.writeFileSync(result.filePath, [header, ...rows].join('\r\n'), 'utf8');
  return { success: true, path: result.filePath };
});

// ── Lifecycle ──
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
