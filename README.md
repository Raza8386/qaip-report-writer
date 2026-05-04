# QAIP Report Writer

> AI-powered Quality Assurance & Improvement Programme report generator  
> Aligned with **IIA Global Internal Audit Standards 2024**

---

## What it does

Paste your IIA self-assessment data → Claude AI generates a full professional QAIP report → Download as a formatted Word (.docx) file — ready for the Audit Committee.

Sections generated automatically:
- Executive Summary
- Assessment Methodology
- Overall Conformance Rating (GC / PC / DNC)
- Domain-by-Domain Analysis (all 5 IIA 2024 Domains)
- Findings with Condition / Criteria / Impact / Recommendation
- Priority Recommendations with timelines and standard references
- Conclusion & Next Steps

---

## Requirements

| Tool    | Version  | Check with        |
|---------|----------|-------------------|
| Node.js | ≥ 18.0.0 | `node --version`  |
| npm     | ≥ 9.0.0  | `npm --version`   |

Download Node.js (includes npm): https://nodejs.org/

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

**Option A — Interactive wizard (recommended):**
```bash
node scripts/setup.js
```

**Option B — Manual:**
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

Get your API key from: https://console.anthropic.com/

### 3. Start the app

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

### 4. Open in browser

```
http://localhost:3000
```

---

## Project Structure

```
qaip-app/
├── server.js          ← Express server + Claude API proxy
├── package.json       ← Dependencies and scripts
├── .env.example       ← Environment template
├── .env               ← Your config (never commit this)
├── .gitignore
├── scripts/
│   └── setup.js       ← Interactive setup wizard
├── public/
│   └── index.html     ← Full app (UI + Word generator, offline-capable)
└── README.md
```

---

## Configuration

All configuration is in `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...   # Required
PORT=3000                            # Optional, default 3000
HOST=localhost                       # localhost or 0.0.0.0
```

Set `HOST=0.0.0.0` to allow access from other machines on your network (e.g. office colleagues).

---

## Deployment Options

### Option A — Run on your PC (personal use)

```bash
npm start
# Access at http://localhost:3000
```

### Option B — Office server / VM (team access)

1. Copy project folder to the server
2. Set `HOST=0.0.0.0` in `.env`
3. Set `PORT=3000` (or any open port)
4. Run `npm start`
5. Share `http://SERVER_IP:3000` with your team

**Keep running after logout with PM2:**
```bash
npm install -g pm2
pm2 start server.js --name qaip-report-writer
pm2 save
pm2 startup         # auto-start on reboot
```

### Option C — Behind Nginx (company subdomain)

Point `qaip.yourcompany.com` → `localhost:3000` with this Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name qaip.yourcompany.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Restrict to company VPN only (replace with your VPN IP range)
    allow 10.0.0.0/8;
    deny all;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;   # allow time for AI generation
    }
}
```

### Option D — Azure App Service (cloud)

```bash
# Install Azure CLI, then:
az login
az group create --name qaip-rg --location saudiarabia
az appservice plan create --name qaip-plan --resource-group qaip-rg --sku B1 --is-linux
az webapp create --name qaip-report-writer --resource-group qaip-rg --plan qaip-plan --runtime "NODE:20-lts"
az webapp config appsettings set --name qaip-report-writer --resource-group qaip-rg \
  --settings ANTHROPIC_API_KEY="sk-ant-..." HOST="0.0.0.0"
az webapp deploy --name qaip-report-writer --resource-group qaip-rg --src-path .
```

---

## Security

| Control                  | Implementation                                   |
|--------------------------|--------------------------------------------------|
| API key protection       | Server-side only — never sent to browser         |
| Rate limiting            | 20 report generations / IP / hour                |
| Security headers         | X-Frame-Options, X-Content-Type-Options          |
| Network restriction      | Use Nginx `allow/deny` or VPN                    |
| HTTPS                    | Terminate at Nginx or cloud load balancer        |

---

## Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "app": "QAIP Report Writer",
  "version": "1.0.0",
  "time": "2025-11-11T08:00:00.000Z",
  "apiReady": true
}
```

---

## Troubleshooting

**`ANTHROPIC_API_KEY is not set` on startup**  
→ Run `node scripts/setup.js` or check your `.env` file exists.

**`Port 3000 already in use`**  
→ Change `PORT=3001` in `.env` or kill the process using port 3000.

**Report generation fails / times out**  
→ Check your API key has credits at https://console.anthropic.com/  
→ Check internet connectivity from the server.

**Word download doesn't work**  
→ The Word library is embedded in `public/index.html` — no internet needed.  
→ Try a different browser (Chrome / Edge recommended).

---

## Support

Prepared by: **Danish Raza — IAS**  
Standards reference: IIA Global Internal Audit Standards 2024  
Powered by: Anthropic Claude (claude-sonnet-4)
