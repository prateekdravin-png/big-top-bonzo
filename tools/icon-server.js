// Renders the app icons from the game's own vector art.
// Usage: node tools/icon-server.js   then open http://localhost:8765/icons.html
// The page paints every icon size and posts the PNGs back here, which writes them into the project.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf' };
// only these files may be written
const TARGETS = new Set([
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'android/res/mipmap-mdpi/ic_launcher.png', 'android/res/mipmap-hdpi/ic_launcher.png', 'android/res/mipmap-xhdpi/ic_launcher.png',
  'android/res/mipmap-xxhdpi/ic_launcher.png', 'android/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/res/drawable-xxxhdpi/ic_launcher_fg.png', 'android/res/drawable-xxxhdpi/ic_launcher_bg.png'
]);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = url.searchParams.get('name');
    if (!TARGETS.has(name)) { res.writeHead(400); return res.end('unknown target'); }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const file = path.join(ROOT, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(body.replace(/^data:image\/png;base64,/, ''), 'base64'));
      console.log('wrote', name);
      res.end('ok');
    });
    return;
  }
  let p = url.pathname === '/' || url.pathname === '/icons.html' ? '/index.html' : url.pathname;
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    if (url.pathname === '/icons.html') data = Buffer.from(String(data).replace('</body>', '<script src="/tools/paint-icons.js"></script></body>'));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8765, () => console.log('open http://localhost:8765/icons.html'));
