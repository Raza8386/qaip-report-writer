/**
 * QAIP Report Writer — Express Server
 * ------------------------------------
 * Serves the frontend and proxies Claude API calls
 * so the API key never touches the browser.
 *
 * Start:  node server.js
 * Dev:    npm run dev   (auto-restarts on changes)
 */

require('dotenv').config();

const express    = require('express');
const path       = require('path');
const https      = require('https');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');

const DATA_FILE = path.join(__dirname, 'data', 'assessment.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ── Validate API key at startup ───────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY is not set.');
  console.error('    Copy .env.example to .env and add your key.\n');
  process.exit(1);
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms   = Date.now() - start;
    const user = req.headers['x-user'] || 'anonymous';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms — ${user}`);
  });
  next();
});

// Rate limiter — 20 report generations per hour per IP
const apiLimiter = rateLimit({
  windowMs : 60 * 60 * 1000,
  max      : 20,
  message  : { error: 'Too many requests. Please wait before generating another report.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

// ── Assessment data (file-based persistence) ──────────────────────────────────
app.get('/api/assessment', (req, res) => {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data);
  } catch {
    res.json({});
  }
});

app.post('/api/assessment', (req, res) => {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Claude API proxy ──────────────────────────────────────────────────────────
app.post('/api/claude', apiLimiter, (req, res) => {
  const body = JSON.stringify(req.body);

  const options = {
    hostname: 'api.anthropic.com',
    path    : '/v1/messages',
    method  : 'POST',
    headers : {
      'Content-Type'      : 'application/json',
      'Content-Length'    : Buffer.byteLength(body),
      'x-api-key'         : ANTHROPIC_API_KEY,
      'anthropic-version' : '2023-06-01',
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    res.status(apiRes.statusCode);
    apiRes.pipe(res);
  });

  apiReq.on('error', (err) => {
    console.error('[Claude API error]', err.message);
    res.status(502).json({ error: 'Failed to reach Anthropic API: ' + err.message });
  });

  apiReq.write(body);
  apiReq.end();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status   : 'ok',
    app      : 'QAIP Report Writer',
    version  : '1.0.0',
    time     : new Date().toISOString(),
    apiReady : !!ANTHROPIC_API_KEY,
  });
});

// ── Catch-all: serve index.html for any unknown route ────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║      QAIP Report Writer — Server Ready       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  ▶  App URL  : http://${HOST}:${PORT}`);
  console.log(`  ▶  Health   : http://${HOST}:${PORT}/health`);
  console.log(`  ▶  API Key  : ${ANTHROPIC_API_KEY.slice(0,8)}…${ANTHROPIC_API_KEY.slice(-4)}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
