const { app, BrowserWindow, ipcMain, clipboard, dialog, Menu, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const os     = require('os');
const { spawn } = require('child_process');

app.setName('Motif Analyzer Admin');

const isDev = process.env.NODE_ENV === 'development';

// ── Storage root ──
const ROOT        = path.join('C:\\ProgramData', 'MotifAnalyzer');
const CONFIG_FILE = path.join(ROOT, 'config.json');

function ensureRoot() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });
}

function sanitizeName(name) {
  return (name || 'Unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Unknown';
}

// ── Config (project root, etc.) ──
function loadConfig() {
  ensureRoot();
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

function saveConfig(patch) {
  ensureRoot();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...loadConfig(), ...patch }, null, 2), 'utf8');
}

function getProjectRoot() {
  if (!app.isPackaged) return path.join(__dirname, '..');
  return loadConfig().projectRoot || '';
}

// ── Private key path ──
function getPrivateKeyPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'private.key')
    : path.join(__dirname, '..', 'tools', 'private.key');
}

// ── Per-business folder storage ──
function loadLicenses() {
  ensureRoot();
  const list = [];
  try {
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const f = path.join(ROOT, entry.name, 'license.json');
      if (fs.existsSync(f)) {
        try { list.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch {}
      }
    }
  } catch {}
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBusinessDir(record) {
  return path.join(ROOT, sanitizeName(record.business || record.name));
}

function saveLicense(record, logoSrcPath) {
  ensureRoot();
  const dir = getBusinessDir(record);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (logoSrcPath && fs.existsSync(logoSrcPath)) {
    const ext     = path.extname(logoSrcPath).toLowerCase() || '.png';
    const logoDst = path.join(dir, 'logo' + ext);
    fs.copyFileSync(logoSrcPath, logoDst);
    record.logoPath = logoDst;
  }

  fs.writeFileSync(path.join(dir, 'license.json'), JSON.stringify(record, null, 2), 'utf8');
}

function deleteLicense(id) {
  const rec = loadLicenses().find(l => l.id === id);
  if (!rec) return;
  const dir = getBusinessDir(rec);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ── Key generation ──
function generateLicenseKey(machineId) {
  const keyPath = getPrivateKeyPath();
  if (!fs.existsSync(keyPath)) throw new Error(`Private key not found.\nExpected: ${keyPath}`);
  const sign = crypto.createSign('SHA256');
  sign.update(machineId.toUpperCase().trim());
  return sign.sign(fs.readFileSync(keyPath, 'utf8')).toString('base64');
}

// ── Window ──
let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'app-logo.png');
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 960, minHeight: 620,
    backgroundColor: '#0d0f17',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    title: 'Motif Analyzer — Admin Dashboard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.webContents.session.clearCache().then(() =>
      mainWindow.loadFile(path.join(__dirname, 'index.html'))
    );
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC ──
ipcMain.handle('check-ready', () => ({
  keyExists:   fs.existsSync(getPrivateKeyPath()),
  storagePath: ROOT,
  projectRoot: getProjectRoot(),
}));

ipcMain.handle('get-licenses', () => loadLicenses());

ipcMain.handle('generate-license', (_ev, { name, business, email, machineId, notes, logoPath }) => {
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
  saveLicense(record, logoPath || null);
  return record;
});

ipcMain.handle('delete-license', (_ev, id) => { deleteLicense(id); return true; });

ipcMain.handle('copy-text', (_ev, text) => { clipboard.writeText(text); return true; });

ipcMain.handle('pick-logo', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Business Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('set-config', (_ev, patch) => { saveConfig(patch); return true; });

ipcMain.handle('open-folder', (_ev, folderPath) => { shell.openPath(folderPath); return true; });

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

// ── Build branded exe ──
ipcMain.handle('build-exe', async (_ev, { licenseId }) => {
  const projectRoot = getProjectRoot();
  if (!projectRoot || !fs.existsSync(projectRoot)) {
    return { success: false, error: 'Project root not set. Open Settings (⚙) and set the project path first.' };
  }

  const license  = loadLicenses().find(l => l.id === licenseId);
  if (!license) return { success: false, error: 'License not found.' };

  const logoSrc      = license.logoPath;
  const bizName      = sanitizeName(license.business || license.name);
  const pubBrandLogo = path.join(projectRoot, 'public', 'brand-logo.png');
  const outDir       = path.join(projectRoot, 'out');
  const outBrandLogo = path.join(outDir, 'brand-logo.png');
  const outExists    = fs.existsSync(outDir);

  // Snapshot originals for restore
  const origPub = fs.existsSync(pubBrandLogo) ? fs.readFileSync(pubBrandLogo) : null;
  const origOut = fs.existsSync(outBrandLogo) ? fs.readFileSync(outBrandLogo) : null;

  const srcLogo = (logoSrc && fs.existsSync(logoSrc))
    ? logoSrc
    : path.join(projectRoot, 'public', 'app-logo.png');

  try {
    // Inject business logo into project
    fs.copyFileSync(srcLogo, pubBrandLogo);
    if (outExists) fs.copyFileSync(srcLogo, outBrandLogo);

    // Use dist:branded (no next build) if out/ exists; else full dist
    const script = outExists ? 'dist:branded' : 'dist';
    mainWindow?.webContents.send('build-log', `▶ Running: npm run ${script}\n`);
    mainWindow?.webContents.send('build-log', `  Project: ${projectRoot}\n\n`);

    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', script], {
        cwd: projectRoot,
        shell: true,
        env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
      });
      child.stdout.on('data', d => mainWindow?.webContents.send('build-log', d.toString()));
      child.stderr.on('data', d => mainWindow?.webContents.send('build-log', d.toString()));
      child.on('close', code =>
        code === 0 ? resolve() : reject(new Error(`Build exited with code ${code}`))
      );
      child.on('error', reject);
    });

    // Locate the built installer
    const releaseDir = path.join(projectRoot, 'release');
    const exeFile    = fs.readdirSync(releaseDir).find(f => f.endsWith('.exe') && !f.includes('blockmap'));
    if (!exeFile) throw new Error('No .exe found in release/ after build.');

    // Save to business folder
    const bizDir = path.join(ROOT, bizName);
    if (!fs.existsSync(bizDir)) fs.mkdirSync(bizDir, { recursive: true });

    const dstExe = path.join(bizDir, `${bizName} - Motif Analyzer Setup.exe`);
    fs.copyFileSync(path.join(releaseDir, exeFile), dstExe);

    return { success: true, exePath: dstExe, folderPath: bizDir };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    // Restore brand-logo files
    if (origPub) fs.writeFileSync(pubBrandLogo, origPub);
    else if (fs.existsSync(pubBrandLogo)) fs.unlinkSync(pubBrandLogo);

    if (origOut) fs.writeFileSync(outBrandLogo, origOut);
    else if (outExists && fs.existsSync(outBrandLogo)) fs.unlinkSync(outBrandLogo);
  }
});

// ── Lifecycle ──
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureRoot();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
