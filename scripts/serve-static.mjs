import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const dirArg = argv.find((arg) => !arg.startsWith('--')) ?? 'dist';
const portArg = argv.find((arg) => arg.startsWith('--port='))?.split('=')[1];
const hostArg = argv.find((arg) => arg.startsWith('--host='))?.split('=')[1];
const corsOriginArg = argv.find((arg) => arg.startsWith('--cors-origin='))?.split('=')[1];
const corsHeadersArg = argv.find((arg) => arg.startsWith('--cors-headers='))?.split('=')[1];

const port = Number(portArg ?? process.env.PORT ?? 4179);
const host = hostArg ?? process.env.HOST ?? '127.0.0.1';
const rootDir = path.resolve(repoRoot, dirArg);
const corsOrigin = corsOriginArg ?? process.env.CORS_ORIGIN ?? '*';
const corsHeaders =
  corsHeadersArg ?? process.env.CORS_HEADERS ?? 'Content-Type, Authorization, X-Requested-With';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function safeJoin(base, target) {
  const normalized = path.normalize(target).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(base, `.${path.sep}${normalized}`);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function send(res, status, content, contentType = 'text/plain; charset=utf-8') {
  const contentLength = Buffer.byteLength(content);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': String(contentLength),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': corsHeaders,
    'Access-Control-Max-Age': '86400',
  });
  res.end(content);
}

function escapeHtml(raw) {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function encodePathSegments(rawPath) {
  const normalized = rawPath.replace(/\\/g, '/');
  return normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size < 0) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderDirectoryListing(currentDir, requestPath) {
  const entries = fs
    .readdirSync(currentDir, { withFileTypes: true })
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name, 'en');
    });

  const normalizedPath = requestPath.endsWith('/') ? requestPath : `${requestPath}/`;
  const relCurrent = path.relative(rootDir, currentDir).replace(/\\/g, '/');
  const parentPath = relCurrent ? `/${encodePathSegments(path.posix.dirname(relCurrent))}/` : null;

  const rows = entries
    .map((entry) => {
      const relChild = relCurrent ? `${relCurrent}/${entry.name}` : entry.name;
      const href = `/${encodePathSegments(relChild)}${entry.isDirectory() ? '/' : ''}`;
      const abs = path.join(currentDir, entry.name);
      const size = entry.isDirectory() ? '-' : formatBytes(fs.statSync(abs).size);
      return `<tr><td><a href="${href}">${escapeHtml(entry.name)}${entry.isDirectory() ? '/' : ''}</a></td><td>${entry.isDirectory() ? 'dir' : 'file'}</td><td>${size}</td></tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Index of ${escapeHtml(normalizedPath)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
    code { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; }
    a { color: #0b5fff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Index of <code>${escapeHtml(normalizedPath)}</code></h1>
  <p>root: <code>${escapeHtml(rootDir)}</code></p>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Size</th></tr></thead>
    <tbody>
      ${parentPath ? `<tr><td><a href="${parentPath}">../</a></td><td>dir</td><td>-</td></tr>` : ''}
      ${rows || '<tr><td colspan="3">(empty)</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
  console.error(`[serve-static] Directory not found: ${rootDir}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': corsHeaders,
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const candidate = safeJoin(rootDir, pathname);

  if (!candidate) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    if (!pathname.endsWith('/')) {
      const redirectTo = `${pathname}/${requestUrl.search}`;
      res.writeHead(301, {
        Location: redirectTo,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': corsHeaders,
      });
      res.end();
      return;
    }

    const indexFile = path.join(candidate, 'index.html');
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      const ext = path.extname(indexFile).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': corsHeaders,
      });
      fs.createReadStream(indexFile).pipe(res);
      return;
    }

    const html = renderDirectoryListing(candidate, pathname);
    send(res, 200, html, 'text/html; charset=utf-8');
    return;
  }

  const filePath = candidate;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, `Not Found: ${pathname}`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': corsHeaders,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`[serve-static] Serving ${rootDir}`);
  console.log(`[serve-static] URL: http://${host}:${port}/`);
  console.log(`[serve-static] CORS: ${corsOrigin}`);
});