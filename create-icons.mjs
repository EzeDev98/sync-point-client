import fs from 'fs';
import sharp from 'sharp';

if (!fs.existsSync('public/icons')) {
  fs.mkdirSync('public/icons', { recursive: true });
}

async function createIcon(size) {
  await sharp('public/icon-source.png')
    .resize(size, size, { fit: 'cover' })
    // Tint the entire image to force exact teal — this replaces the
    // background color with your exact brand teal #0F766E
    .tint({ r: 15, g: 118, b: 110 })
    .png({ quality: 100 })
    .toFile(`public/icons/icon-${size}x${size}.png`);

  console.log(`✅ Created icon-${size}x${size}.png`);
}

async function createFavicon() {
  await sharp('public/icon-source.png')
    .resize(32, 32)
    .tint({ r: 15, g: 118, b: 110 })
    .png()
    .toFile('public/favicon.png');
  console.log('✅ Created favicon.png');
}

await createIcon(192);
await createIcon(512);
await createFavicon();

console.log('🎉 Done! Check public/icons/');