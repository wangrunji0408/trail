// save-server.js - 本地关卡保存接口
// POST /save-level { filename, content } → 写入 levels/filename
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const LEVELS_DIR = path.join(__dirname, 'levels');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/list-levels') {
    try {
      const files = fs.readdirSync(LEVELS_DIR)
        .filter(f => f.endsWith('.txt'))
        .sort();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/save-level') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename, content } = JSON.parse(body);
        if (!filename || typeof content !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filename or content' }));
          return;
        }
        // 安全检查：只允许写 levels/ 目录下的 .txt 文件
        const basename = path.basename(filename);
        if (!basename.endsWith('.txt') || basename.includes('..')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid filename' }));
          return;
        }
        const filepath = path.join(LEVELS_DIR, basename);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`[save-server] Saved: ${basename}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, saved: basename }));
      } catch (e) {
        console.error('[save-server] Error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[save-server] Listening on http://localhost:${PORT}`);
});
