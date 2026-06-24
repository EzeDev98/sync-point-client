import fs from 'fs';
import { createCanvas } from 'canvas';

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Teal background with rounded corners
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#0F766E';
  ctx.fill();

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 14;

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineCap = 'round';

  // Top arc
  ctx.beginPath();
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([]);
  ctx.arc(cx, cy, 5 * scale, Math.PI + 0.3, Math.PI * 1.85);
  ctx.stroke();

  // Bottom dashed arc
  ctx.beginPath();
  ctx.setLineDash([2 * scale, 2 * scale]);
  ctx.arc(cx, cy, 5 * scale, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Center circle
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  fs.writeFileSync(
    `public/icons/icon-${size}x${size}.png`,
    canvas.toBuffer('image/png')
  );
  console.log(`✅ Created icon-${size}x${size}.png`);
}

createIcon(192);
createIcon(512);