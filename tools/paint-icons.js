// Loaded into the game page by tools/icon-server.js. Paints Bonzo's icon at every size the
// web app and the Android app need, using the game's own drawing functions, and saves them.
(async () => {
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  const ICON = (size, art, layer) => { // art: how much of the icon Bonzo's head fills; layer: 'full' | 'fg' | 'bg'
    cv.width = size; cv.height = size;
    ctx.setTransform(size / 100, 0, 0, size / 100, 0, 0); // paint in a 100x100 box
    ctx.clearRect(0, 0, 100, 100);
    if (layer !== 'fg') {
      ctx.fillStyle = radg(50, 38, 2, 50, 50, 78, ['#5a2aa8', '#26125c', '#0b0620']); ctx.fillRect(0, 0, 100, 100);
      for (let i = -9; i < 9; i += 2) {
        const a0 = i * 0.17, a1 = (i + 1) * 0.17;
        poly([50, -30, 50 + Math.sin(a0) * 200, -30 + Math.cos(a0) * 200, 50 + Math.sin(a1) * 200, -30 + Math.cos(a1) * 200], 'rgba(255,255,255,0.05)');
      }
      for (let i = 0; i < 14; i++) { const x = 6 + i * 6.8, y = 9 + Math.sin(i / 13 * Math.PI) * 7; glow(x, y, 4, BULBS[i % 4], 0.6); circle(x, y, 0.8, rgba(BULBS[i % 4], 1)); }
    }
    if (layer === 'bg') return cv.toDataURL('image/png');
    const k = art / 0.6, cx = 50, cy = 54;
    glow(cx, cy, 34 * k, [255, 150, 210], 0.35);
    ctx.beginPath(); ctx.arc(cx, cy, 27 * k, 0, 7); ctx.lineWidth = 3 * k;
    ctx.strokeStyle = lin(0, cy - 27 * k, 0, cy + 27 * k, ['#fff1b8', '#ffc84a', '#e8891c']); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 25.5 * k, 0, 7); ctx.fillStyle = 'rgba(11,6,32,0.55)'; ctx.fill();
    // Bonzo's head: art units are tiny, so scale them up into the ring
    // the head + hat + collar span about 19 x 12 art units, centred 2.6 units above the head's middle
    const s = 2.55 * k;
    ctx.save(); ctx.translate(cx + 0.65 * s, cy - 2 + 2.6 * s); ctx.scale(s, s);
    for (let i = 0; i < 6; i++) circle(-3.6 + i * 1.5, 5.6 + (i % 2) * 0.35, 1.25, i % 2 ? '#f0ecff' : '#ffffff');
    gt = 1; drawHead(0, 0, OUTFIT.bonzo, 'happy');
    ctx.restore();
    return cv.toDataURL('image/png');
  };
  const jobs = [
    ['icons/icon-192.png', 192, 0.62, 'full'], ['icons/icon-512.png', 512, 0.62, 'full'],
    ['icons/icon-maskable-512.png', 512, 0.48, 'full'], ['icons/apple-touch-icon.png', 180, 0.6, 'full'],
    ['android/res/mipmap-mdpi/ic_launcher.png', 48, 0.62, 'full'], ['android/res/mipmap-hdpi/ic_launcher.png', 72, 0.62, 'full'],
    ['android/res/mipmap-xhdpi/ic_launcher.png', 96, 0.62, 'full'], ['android/res/mipmap-xxhdpi/ic_launcher.png', 144, 0.62, 'full'],
    ['android/res/mipmap-xxxhdpi/ic_launcher.png', 192, 0.62, 'full'],
    ['android/res/drawable-xxxhdpi/ic_launcher_fg.png', 432, 0.44, 'fg'], ['android/res/drawable-xxxhdpi/ic_launcher_bg.png', 432, 0.44, 'bg']
  ];
  window.__iconsDone = false;
  const rendered = jobs.map(([name, size, art, layer]) => [name, ICON(size, art, layer)]);
  resize();
  for (const [name, data] of rendered) await fetch('/save?name=' + encodeURIComponent(name), { method: 'POST', body: data });
  window.__iconsDone = rendered.map(([n]) => n);
})();
