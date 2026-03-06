const http = require('http');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

// Cloudflare R2 Configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional, e.g., https://pub-xxx.r2.dev

// Ensure image directories exist
function ensureDirectories() {
  const folders = ['today', 'discount', 'stories'];
  folders.forEach(folder => {
    const dir = path.join(BASE_DIR, 'images', folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
}

// Initialize directories on startup
ensureDirectories();

// Convert data URL to buffer
function dataURLToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL format');
  }
  return Buffer.from(matches[2], 'base64');
}

// Get file extension from MIME type
function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return mimeMap[mimeType.toLowerCase()] || 'jpg';
}

// Parse JSON from request body
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Serve static files
function serveStaticFile(filePath, res) {
  const fullPath = path.join(BASE_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Server is running' }));
    return;
  }

  // Presign endpoint for R2
  if (url.pathname === '/presign' && req.method === 'POST') {
    console.log('🔗 Presign request received');
    try {
      const body = await parseJSONBody(req);
      const { filename, contentType, folder } = body;

      if (!filename || !contentType || !folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing required fields: filename, contentType, folder' }));
        return;
      }

      // Validate folder
      const validFolders = ['today', 'discount', 'stories'];
      if (!validFolders.includes(folder)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid folder' }));
        return;
      }

      // Generate unique key
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 1e9);
      const ext = filename.split('.').pop() || 'bin';
      const key = `${folder}/${timestamp}_${randomId}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      // URL valid for 5 minutes
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

      console.log(`✅ Presigned URL generated for: ${key}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        uploadUrl: signedUrl,
        key: key,
        publicUrl: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : null
      }));

    } catch (err) {
      console.error('❌ Presign error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message || 'Presign failed' }));
    }
    return;
  }

  // Upload endpoint
  if (url.pathname === '/upload' && req.method === 'POST') {
    console.log('📤 Upload request received');
    try {
      const body = await parseJSONBody(req);
      const { dataUrl, folder, filename } = body;

      console.log('📥 Upload parameters:', {
        folder: folder,
        filename: filename,
        hasDataUrl: !!dataUrl,
        dataUrlLength: dataUrl ? dataUrl.length : 0
      });

      if (!dataUrl || !folder || !filename) {
        console.error('❌ Missing required fields:', { hasDataUrl: !!dataUrl, folder, filename });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing required fields: dataUrl, folder, filename' }));
        return;
      }

      // Validate folder name (security)
      const validFolders = ['today', 'discount', 'stories'];
      if (!validFolders.includes(folder)) {
        console.error(`❌ Invalid folder: "${folder}". Must be one of: ${validFolders.join(', ')}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Invalid folder. Must be one of: ${validFolders.join(', ')}` }));
        return;
      }

      console.log(`✅ Folder validated: "${folder}"`);

      // Convert data URL to buffer
      let imageBuffer;
      try {
        imageBuffer = dataURLToBuffer(dataUrl);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid data URL format' }));
        return;
      }

      // Ensure directory exists
      const targetDir = path.join(BASE_DIR, 'images', folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`✅ Created directory: ${targetDir}`);
      }

      // Save file
      const filePath = path.join(targetDir, filename);
      fs.writeFileSync(filePath, imageBuffer);

      const relativePath = `images/${folder}/${filename}`;
      console.log(`✅ Image saved: ${relativePath}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        path: relativePath,
        filename: filename,
        folder: folder
      }));

    } catch (err) {
      console.error('❌ Upload error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message || 'Internal server error' }));
    }
    return;
  }

  // Serve static files
  if (req.method === 'GET') {
    // Default to index.html if root
    let filePath = url.pathname === '/' ? '/exemple_dynamic.html' : url.pathname;
    serveStaticFile(filePath, res);
    return;
  }

  // 404 for other requests
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Base directory: ${BASE_DIR}`);
  console.log(`📂 Image folders: images/today, images/discount, images/stories`);
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

