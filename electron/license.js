// Motif Analyzer — License verification (runs in main process only)
const crypto = require('crypto');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// ── Paste your PUBLIC KEY here (from: node tools/keygen.js --setup) ──────────
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEba3vNO6MYZIT6zOXTfvEH3d9pOcF
9VBp7j5UKXqUuAIWqFX3i8kTp9SyGB968vHm2MRPPAGLEdY90QPhxWhkgg==
-----END PUBLIC KEY-----`;
// ─────────────────────────────────────────────────────────────────────────────

// Collect stable hardware identifiers from Windows and hash them together.
// Result: 8 groups of 8 hex chars, e.g. A1B2C3D4-E5F6A7B8-...
function getMachineId() {
  try {
    const { execSync } = require('child_process');
    const uuid = execSync('wmic csproduct get UUID /value', { timeout: 5000 })
      .toString().match(/UUID=([^\r\n]+)/)?.[1]?.trim() || '';
    const cpu  = execSync('wmic cpu get ProcessorId /value', { timeout: 5000 })
      .toString().match(/ProcessorId=([^\r\n]+)/)?.[1]?.trim() || '';
    const disk = execSync('wmic diskdrive get SerialNumber /value', { timeout: 5000 })
      .toString().match(/SerialNumber=([^\r\n]+)/)?.[1]?.trim().split('\n')[0]?.trim() || '';
    const hash = crypto.createHash('sha256')
      .update(`${uuid}|${cpu}|${disk}`)
      .digest('hex').toUpperCase();
    return hash.match(/.{8}/g).join('-');
  } catch {
    // Fallback for restricted environments: use MAC + hostname
    const ifaces = os.networkInterfaces();
    let mac = '';
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface) {
        if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
          mac = addr.mac; break;
        }
      }
      if (mac) break;
    }
    const hash = crypto.createHash('sha256')
      .update(`${os.hostname()}|${mac}`)
      .digest('hex').toUpperCase();
    return hash.match(/.{8}/g).join('-');
  }
}

// Verify that licenseKey is a valid ECDSA signature of machineId.
function verifyLicense(machineId, licenseKey) {
  try {
    if (!PUBLIC_KEY || PUBLIC_KEY.includes('PASTE_PUBLIC_KEY_HERE')) return false;
    const verify = crypto.createVerify('SHA256');
    verify.update(machineId.toUpperCase().trim());
    return verify.verify(PUBLIC_KEY, Buffer.from(licenseKey, 'base64'));
  } catch {
    return false;
  }
}

function getLicensePath() {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'license.dat');
}

function saveLicense(machineId, licenseKey) {
  fs.writeFileSync(getLicensePath(), JSON.stringify({ machineId, licenseKey }), 'utf8');
}

// Returns true if a saved license exists, matches this machine, and has a valid signature.
function loadAndVerify() {
  try {
    const data      = JSON.parse(fs.readFileSync(getLicensePath(), 'utf8'));
    const currentId = getMachineId();
    if (data.machineId !== currentId) return false;
    return verifyLicense(currentId, data.licenseKey);
  } catch {
    return false;
  }
}

module.exports = { getMachineId, verifyLicense, saveLicense, loadAndVerify };
