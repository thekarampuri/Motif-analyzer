const { app, BrowserWindow, ipcMain, clipboard, dialog, Menu, shell } = require('electron');
const path       = require('path');
const fs         = require('fs');
const originalFs = require('original-fs'); // bypass Electron's asar interception
const crypto     = require('crypto');
const os         = require('os');
const { execFileSync } = require('child_process');

app.setName('Motif Analyzer Admin');

const isDev = process.env.NODE_ENV === 'development';

// ── Storage root ──
const ROOT        = path.join('C:\\ProgramData', 'MotifAnalyzerAdmin');
const CONFIG_FILE = path.join(ROOT, 'config.json');

function ensureRoot() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });
}

function sanitizeName(name) {
  return (name || 'Unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Unknown';
}

// ── Config ──
function loadConfig() {
  ensureRoot();
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(patch) {
  ensureRoot();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...loadConfig(), ...patch }, null, 2), 'utf8');
}

// ── Resource paths (bundled tools) ──
function getResourcesDir() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'tools');
}
function getNsisDir()            { return path.join(getResourcesDir(), 'nsis'); }
function get7zaPath()            { return path.join(getResourcesDir(), '7za.exe'); }
function getMakeNsis()           { return path.join(getNsisDir(), 'makensis.exe'); }
function getTemplateArchive()    { return path.join(getResourcesDir(), 'app-template.7z'); }

// ── Private key ──
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
  if (!fs.existsSync(keyPath)) throw new Error(`Private key not found: ${keyPath}`);
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
  keyExists:     fs.existsSync(getPrivateKeyPath()),
  storagePath:   ROOT,
  templateReady: fs.existsSync(getTemplateArchive()),
  toolsReady:    fs.existsSync(getMakeNsis()) && fs.existsSync(get7zaPath()),
}));

ipcMain.handle('get-licenses', () => loadLicenses());

ipcMain.handle('generate-license', (_ev, { name, business, email, machineId, notes, logoPath }) => {
  const normalizedId = (machineId || '').toUpperCase().trim();
  const licenseKey   = normalizedId ? generateLicenseKey(normalizedId) : '';
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

ipcMain.handle('set-machine-id', (_ev, { id, machineId }) => {
  const licenses = loadLicenses();
  const rec = licenses.find(l => l.id === id);
  if (!rec) throw new Error('Record not found');
  const normalizedId = machineId.toUpperCase().trim();
  if (!normalizedId) throw new Error('Machine ID is required');
  rec.machineId  = normalizedId;
  rec.licenseKey = generateLicenseKey(normalizedId);
  saveLicense(rec, null);
  return rec;
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
ipcMain.handle('open-folder', (_ev, p) => { shell.openPath(p); return true; });

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

// ── Build branded exe (fully self-contained, no source code needed) ──
ipcMain.handle('build-exe', async (_ev, { licenseId }) => {
  const sevenZa  = get7zaPath();
  const makeNsis = getMakeNsis();
  const template = getTemplateArchive();

  if (!fs.existsSync(template))  return { success: false, error: 'App template not found. Please reinstall the admin dashboard.' };
  if (!fs.existsSync(sevenZa))   return { success: false, error: 'Bundled 7za.exe not found. Please reinstall the admin dashboard.' };
  if (!fs.existsSync(makeNsis))  return { success: false, error: 'Bundled NSIS tools not found. Please reinstall the admin dashboard.' };

  const license = loadLicenses().find(l => l.id === licenseId);
  if (!license) return { success: false, error: 'License not found.' };

  // ── Load @electron/asar dynamically (bundled by electron-builder) ──
  let asar;
  try {
    asar = require('@electron/asar');
  } catch {
    return { success: false, error: '@electron/asar not found. Please reinstall the admin dashboard.' };
  }

  const bizName = sanitizeName(license.business || license.name);
  const logoSrc = license.logoPath && fs.existsSync(license.logoPath) ? license.logoPath : null;
  const log     = msg => mainWindow?.webContents.send('build-log', msg);
  const tmpBase = path.join(os.tmpdir(), 'motif-brand-' + Date.now());

  try {
    // 1. Extract the bundled app template to a staging directory
    log('▶ Staging app files…\n');
    const stageDir = tmpBase + '-stage';
    fs.mkdirSync(stageDir, { recursive: true });
    execFileSync(sevenZa, ['x', template, '-o' + stageDir, '-y'], { windowsHide: true });
    log('  ✓ Staged\n\n');

    // 2. Extract the app.asar from the staged template
    const origAsar   = path.join(stageDir, 'resources', 'app.asar');
    if (!fs.existsSync(origAsar)) {
      return { success: false, error: 'app.asar not found in template. Please reinstall the admin dashboard.' };
    }

    log('▶ Extracting app.asar…\n');
    const extractDir = tmpBase + '-extracted';
    await asar.extractAll(origAsar, extractDir);
    log('  ✓ Extracted\n\n');

    // 3. Inject the business logo as brand-logo.png
    log('▶ Injecting business logo…\n');
    if (logoSrc) {
      fs.copyFileSync(logoSrc, path.join(extractDir, 'out', 'brand-logo.png'));
      log(`  ✓ Logo set: ${path.basename(logoSrc)}\n\n`);
    } else {
      log('  ℹ No logo uploaded — using default app logo\n\n');
    }

    // 4. Repack the patched asar
    // Use .tmp extension so Electron's asar interceptor doesn't interfere during createPackage
    log('▶ Repacking asar…\n');
    const patchedAsar = tmpBase + '-app.tmp';
    await asar.createPackage(extractDir, patchedAsar);
    log('  ✓ Repacked\n\n');

    // 5. Replace app.asar in staged copy using original-fs to bypass Electron's asar interception
    originalFs.copyFileSync(patchedAsar, origAsar);
    log('▶ Compiling installer…\n');

    // 6. Ensure output business folder exists
    const bizDir = path.join(ROOT, bizName);
    if (!fs.existsSync(bizDir)) fs.mkdirSync(bizDir, { recursive: true });

    const outExe    = path.join(bizDir, `${bizName} - Motif Analyzer Setup.exe`);
    const nsisDir   = getNsisDir();
    const nsisScript = tmpBase + '.nsi';

    // Escape backslashes for NSIS
    const stageDirNsis    = stageDir.replace(/\\/g, '\\\\');
    const outExeNsis      = outExe.replace(/\\/g, '\\\\');
    const bizNameEscaped  = bizName.replace(/"/g, '""');

    fs.writeFileSync(nsisScript, `
Unicode true
!define APPNAME "Motif Analyzer"
!define INSTDIR_DEFAULT "$PROGRAMFILES64\\\\Motif Analyzer"
!define UNINSTALLER "Uninstall Motif Analyzer.exe"

Name "${bizNameEscaped} - Motif Analyzer"
OutFile "${outExeNsis}"
InstallDir "\${INSTDIR_DEFAULT}"
InstallDirRegKey HKLM "Software\\\\Motif Analyzer" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${stageDirNsis}\\\\*.*"
  CreateShortCut "$DESKTOP\\\\Motif Analyzer.lnk" "$INSTDIR\\\\Motif Analyzer.exe"
  CreateDirectory "$SMPROGRAMS\\\\Motif Analyzer"
  CreateShortCut "$SMPROGRAMS\\\\Motif Analyzer\\\\Motif Analyzer.lnk" "$INSTDIR\\\\Motif Analyzer.exe"
  CreateShortCut "$SMPROGRAMS\\\\Motif Analyzer\\\\Uninstall.lnk" "$INSTDIR\\\\\${UNINSTALLER}"
  WriteRegStr HKLM "Software\\\\Motif Analyzer" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\MotifAnalyzer" "DisplayName" "Motif Analyzer"
  WriteRegStr HKLM "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\MotifAnalyzer" "UninstallString" "$\\"$INSTDIR\\\\\${UNINSTALLER}$\\""
  WriteUninstaller "$INSTDIR\\\\\${UNINSTALLER}"
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\\\\Motif Analyzer.lnk"
  RMDir /r "$SMPROGRAMS\\\\Motif Analyzer"
  DeleteRegKey HKLM "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\MotifAnalyzer"
  DeleteRegKey HKLM "Software\\\\Motif Analyzer"
SectionEnd
`, 'utf8');

    // 7. Run makensis
    execFileSync(makeNsis,
      [`/DNSISDIR=${nsisDir}`, nsisScript],
      { windowsHide: true, env: { ...process.env, NSISDIR: nsisDir } }
    );
    log('  ✓ Installer compiled\n\n');
    log(`✅ Done!\n   ${outExe}\n`);

    return { success: true, exePath: outExe, folderPath: bizDir };

  } catch (err) {
    log(`\n✕ Error: ${err.message}\n`);
    return { success: false, error: err.message };
  } finally {
    for (const p of [
      tmpBase + '-stage',
      tmpBase + '-extracted',
      tmpBase + '-app.tmp',
      tmpBase + '.nsi',
    ]) {
      try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
    }
  }
});

// ── Lifecycle ──
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureRoot();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
