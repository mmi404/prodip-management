// One-off script: rasterizes the site's navbar logo mark (white badge + gold
// flame on navy) into real PNG icons for the PWA/push notifications. Not part
// of the app's runtime — run manually with `node scripts/generate-icons.js`
// whenever the mark changes.
const sharp = require('sharp');
const path = require('path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#1E2C4F"/>
  <circle cx="24" cy="24" r="15" fill="#FFFFFF"/>
  <svg x="16" y="16" width="16" height="16" viewBox="0 0 24 24">
    <path d="M12 2C8 6 6 9 6 12.5A6 6 0 0 0 18 12.5C18 9 16 6 12 2Z" fill="#E5A823"/>
    <rect x="10.5" y="18" width="3" height="4" rx="1" fill="#1E2C4F"/>
  </svg>
</svg>
`.trim();

const outDir = path.join(__dirname, '..', 'public');
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 }
];

(async () => {
  for (const t of targets) {
    await sharp(Buffer.from(svg), { density: 384 })
      .resize(t.size, t.size)
      .png()
      .toFile(path.join(outDir, t.file));
    console.log('wrote', t.file);
  }

  // Next.js app-router favicon convention.
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '..', 'app', 'icon.png'));
  console.log('wrote app/icon.png');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
