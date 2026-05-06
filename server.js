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
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');
const Anthropic  = require('@anthropic-ai/sdk');

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

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

// ── Claude API — streaming SSE ────────────────────────────────────────────────
app.post('/api/claude', apiLimiter, async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const stream = anthropic.messages.stream({
      model      : req.body.model      || 'claude-sonnet-4-6',
      max_tokens : req.body.max_tokens || 8000,
      system     : req.body.system,
      messages   : req.body.messages,
    });

    stream.on('text', (text) => send({ text }));

    stream.on('error', (err) => {
      console.error('[Claude stream error]', err.message);
      send({ error: err.message });
      res.end();
    });

    const final = await stream.finalMessage();
    send({ done: true, usage: final.usage });
    res.end();

  } catch (err) {
    console.error('[Claude API error]', err.message);
    send({ error: err.message });
    res.end();
  }
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
