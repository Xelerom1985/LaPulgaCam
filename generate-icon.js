const { Jimp, loadFont, measureText, measureTextHeight } = require('jimp');
const path = require('path');

const FONT_PATH = path.join(
  path.dirname(require.resolve('@jimp/plugin-print')),
  '..', 'fonts', 'open-sans', 'open-sans-64-white', 'open-sans-64-white.fnt'
);

function floodFillTransparent(bitmap, startX, startY, tolerance) {
  const { width, height, data } = bitmap;
  const si = (startY * width + startX) * 4;
  const sr = data[si], sg = data[si+1], sb = data[si+2];
  const visited = new Uint8Array(width * height);
  const stack = [startY * width + startX];
  while (stack.length > 0) {
    const pos = stack.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const idx = pos * 4;
    const diff = Math.abs(data[idx]-sr) + Math.abs(data[idx+1]-sg) + Math.abs(data[idx+2]-sb);
    if (diff > tolerance * 3) continue;
    data[idx + 3] = 0;
    const x = pos % width, y = Math.floor(pos / width);
    if (x > 0) stack.push(pos - 1);
    if (x < width - 1) stack.push(pos + 1);
    if (y > 0) stack.push(pos - width);
    if (y < height - 1) stack.push(pos + width);
  }
}

function fillRect(bm, x, y, w, h, color) {
  const { width, height, data } = bm;
  const r=(color>>24)&0xff, g=(color>>16)&0xff, b=(color>>8)&0xff, a=color&0xff;
  for (let py=Math.max(0,y); py<Math.min(height,y+h); py++)
    for (let px=Math.max(0,x); px<Math.min(width,x+w); px++) {
      const i=(py*width+px)*4;
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=a;
    }
}

function fillCircle(bm, cx, cy, r, color) {
  const { width, height, data } = bm;
  const cr=(color>>24)&0xff, cg=(color>>16)&0xff, cb=(color>>8)&0xff, ca=color&0xff;
  for (let py=Math.max(0,cy-r); py<=Math.min(height-1,cy+r); py++)
    for (let px=Math.max(0,cx-r); px<=Math.min(width-1,cx+r); px++) {
      if ((px-cx)**2+(py-cy)**2<=r*r) {
        const i=(py*width+px)*4;
        data[i]=cr; data[i+1]=cg; data[i+2]=cb; data[i+3]=ca;
      }
    }
}

function fillTriangle(bm, x1,y1,x2,y2,x3,y3, color) {
  const { width, height, data } = bm;
  const r=(color>>24)&0xff, g=(color>>16)&0xff, b=(color>>8)&0xff, a=color&0xff;
  const minX=Math.max(0,Math.min(x1,x2,x3)), maxX=Math.min(width-1,Math.max(x1,x2,x3));
  const minY=Math.max(0,Math.min(y1,y2,y3)), maxY=Math.min(height-1,Math.max(y1,y2,y3));
  const sign=(px,py,ax,ay,bx,by)=>(px-bx)*(ay-by)-(ax-bx)*(py-by);
  for (let py=minY; py<=maxY; py++)
    for (let px=minX; px<=maxX; px++) {
      const d1=sign(px,py,x1,y1,x2,y2), d2=sign(px,py,x2,y2,x3,y3), d3=sign(px,py,x3,y3,x1,y1);
      if (!((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0))) {
        const i=(py*width+px)*4;
        data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=a;
      }
    }
}

async function main() {
  console.log('Cargando escudo...');
  const shield = await Jimp.read('assets/shield.png');
  console.log(`Escudo: ${shield.width}x${shield.height}`);

  console.log('Quitando fondo blanco...');
  floodFillTransparent(shield.bitmap, 0, 0, 40);
  floodFillTransparent(shield.bitmap, shield.width - 1, 0, 40);
  floodFillTransparent(shield.bitmap, 0, shield.height - 1, 40);
  floodFillTransparent(shield.bitmap, shield.width - 1, shield.height - 1, 40);

  console.log('Redimensionando escudo...');
  shield.resize({ w: 500 });
  console.log(`Escudo redimensionado: ${shield.width}x${shield.height}`);

  console.log('Creando canvas...');
  const icon = new Jimp({ width: 1024, height: 1024, color: 0x0d0d0dff });

  const shieldX = Math.floor((1024 - shield.width) / 2);
  const shieldY = 20;
  console.log(`Escudo en (${shieldX}, ${shieldY})`);
  icon.composite(shield, shieldX, shieldY);

  // Camara de video debajo del escudo
  const camY = shieldY + shield.height + 70;
  const camX = 512;
  console.log(`Camara en (${camX}, ${camY})`);

  fillRect(icon.bitmap, camX-115, camY-52, 190, 104, 0x9b2424ff);
  fillRect(icon.bitmap, camX-108, camY-45, 176, 90, 0xb03030ff);
  fillCircle(icon.bitmap, camX-28, camY, 46, 0x5a1515ff);
  fillCircle(icon.bitmap, camX-28, camY, 34, 0x0d0d0dff);
  fillCircle(icon.bitmap, camX-28, camY, 22, 0x1a0707ff);
  fillCircle(icon.bitmap, camX-37, camY-12, 6, 0xffffff44);
  fillRect(icon.bitmap, camX-50, camY-70, 44, 20, 0x5a1515ff);
  fillCircle(icon.bitmap, camX+70, camY-38, 17, 0xcc2222ff);
  fillCircle(icon.bitmap, camX+70, camY-38, 11, 0xff4444ff);
  fillTriangle(icon.bitmap, camX+94,camY-40, camX+94,camY+40, camX+145,camY, 0x7b1c1cff);

  console.log('Cargando fuente...');
  const font = await loadFont(FONT_PATH);
  const txt = 'LaPulgaCam';
  const tw = measureText(font, txt);
  const th = measureTextHeight(font, txt, 600);
  const textX = Math.floor((1024 - tw) / 2);
  const textY = 1024 - th - 28;
  console.log(`Texto en (${textX}, ${textY}), ${tw}x${th}`);
  icon.print({ font, x: textX, y: textY, text: txt });

  console.log('Guardando icon.png...');
  await icon.write('assets/icon.png');
  await icon.write('assets/android-icon-foreground.png');
  console.log('Listo!');
}

main().catch(e => { console.error(e); process.exit(1); });
