// Generates the PWA icon set from the source image.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = path.join(__dirname, '../public/icon-source.png');
const iconsDir = path.join(__dirname, '../public/icons');

const sizes = [192, 512];

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcons() {
  try {
    if (!fs.existsSync(sourceImage)) {
      console.error(`❌ Source image not found at: ${sourceImage}`);
      console.log('Please place a 512x512 PNG image at public/icon-source.png');
      process.exit(1);
    }

    for (const size of sizes) {
      await sharp(sourceImage)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`✅ Generated ${size}x${size} icon`);
    }
    
    console.log('🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
