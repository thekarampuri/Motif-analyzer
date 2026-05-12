/**
 * Usage: node tools/brand.js <path-to-logo>
 *
 * Copies the provided logo file to public/logo.png so it gets bundled
 * into the next `npm run dist` build. Supports any image format.
 *
 * Example:
 *   node tools/brand.js "C:\Logos\AcmeCorp.png"
 *   npm run dist
 */

const fs   = require('fs');
const path = require('path');

const src = process.argv[2];

if (!src) {
  console.error('Usage: node tools/brand.js <path-to-logo-image>');
  console.error('Example: node tools/brand.js "C:\\Logos\\BusinessA.png"');
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error(`File not found: ${src}`);
  process.exit(1);
}

const dest = path.join(__dirname, '..', 'public', 'logo.png');
fs.copyFileSync(src, dest);
console.log(`✓ Logo set: ${path.resolve(dest)}`);
console.log('');
console.log('Now run:  npm run dist');
console.log('The logo will be bundled into the installer.');
