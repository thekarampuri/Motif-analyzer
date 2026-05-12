#!/usr/bin/env node
//
// Motif Analyzer — License Key Generator  (DEVELOPER TOOL — keep private)
//
// Usage:
//   node tools/keygen.js --setup         → generate key pair (run ONCE, first time)
//   node tools/keygen.js <MACHINE-ID>    → generate a license key for a customer
//
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, 'private.key');

// ── Setup: generate ECDSA P-256 key pair ──────────────────────────────────────
function setup() {
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log('✓ Private key already exists at tools/private.key\n');
    const priv   = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const keyObj = crypto.createPrivateKey(priv);
    const pubKey = crypto.createPublicKey(keyObj).export({ type: 'spki', format: 'pem' });
    console.log('Your PUBLIC KEY (paste this into electron/license.js):\n');
    console.log(pubKey);
    return;
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve:           'P-256',
    privateKeyEncoding:   { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:    { type: 'spki',  format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
  console.log('✓ Private key saved  →  tools/private.key');
  console.log('  ⚠  KEEP THIS SAFE: back it up somewhere secure, never share or commit it!\n');
  console.log('Your PUBLIC KEY (paste this into electron/license.js):\n');
  console.log(publicKey);
  console.log('\nNext steps:');
  console.log('  1. Copy the PUBLIC KEY block above');
  console.log('  2. Open electron/license.js and replace PASTE_PUBLIC_KEY_HERE with it');
  console.log('  3. Rebuild the .exe:  npm run build:next  then  npm run dist');
}

// ── Generate license for a customer machine ID ────────────────────────────────
function generateLicense(rawMachineId) {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('✗ No private key found. Run first:\n  node tools/keygen.js --setup');
    process.exit(1);
  }

  const machineId  = rawMachineId.toUpperCase().trim();
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

  const sign = crypto.createSign('SHA256');
  sign.update(machineId);
  const licenseKey = sign.sign(privateKey).toString('base64');

  console.log('\n' + '─'.repeat(60));
  console.log('Machine ID :', machineId);
  console.log('\nLicense Key (send this to the customer):');
  console.log(licenseKey);
  console.log('─'.repeat(60) + '\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg || arg === '--help') {
  console.log('Motif Analyzer — License Key Generator\n');
  console.log('Usage:');
  console.log('  node tools/keygen.js --setup         Generate key pair (run once)');
  console.log('  node tools/keygen.js <MACHINE-ID>    Generate license for a customer');
} else if (arg === '--setup') {
  setup();
} else {
  generateLicense(arg);
}
