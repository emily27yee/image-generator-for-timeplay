const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PORT = 3456;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.md': 'text/markdown',
    };

    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => resolve(server));
    server.on('error', reject);
  });
}

async function fetchOk(url) {
  const res = await fetch(url);
  assert(res.ok, `Expected 200 for ${url}, got ${res.status}`);
  return res;
}

async function main() {
  const required = ['index.html', 'app.js', 'styles.css', 'assets/frame.png'];
  for (const file of required) {
    assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
  }

  const frame = fs.readFileSync(path.join(root, 'assets', 'frame.png'));
  assert(frame[0] === 0x89 && frame[1] === 0x50, 'frame.png is not a valid PNG');
  assert(frame.length > 500, 'frame.png appears too small');

  if (!fs.existsSync(path.join(root, 'test-photo.png'))) {
    require('./generate-test-photo.js');
  }

  assert(fs.existsSync(path.join(root, 'app.js')), 'app.js missing compose logic');
  const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert(appSource.includes('drawImage'), 'app.js should use canvas drawImage');
  assert(appSource.includes('fillText'), 'app.js should use canvas fillText');
  assert(appSource.includes('toBlob'), 'app.js should support PNG download');

  const server = await startServer();
  try {
    const base = `http://localhost:${PORT}`;
    const html = await (await fetchOk(`${base}/`)).text();
    assert(html.includes('preview-canvas'), 'index.html missing preview canvas');
    assert(html.includes('photo-input'), 'index.html missing photo upload');

    await fetchOk(`${base}/app.js`);
    await fetchOk(`${base}/styles.css`);
    await fetchOk(`${base}/assets/frame.png`);

    console.log('All tests passed');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
