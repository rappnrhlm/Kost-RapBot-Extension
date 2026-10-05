// Kost/server.js - Standalone Bukittinggi Kos Service
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { routeCommand } = require('./commands/router');
const { handleApiRequest } = require('./web/apiRouter');
const { ensureKostTables } = require('./database/schema');

const PORT = process.env.PORT || 3005;

// Initialize database schema on boot
(async () => {
    try {
        await ensureKostTables();
        console.log('✅ Kost database and cache initialized.');
    } catch (err) {
        console.warn('⚠️ Warning initializing Kost database:', err.message);
    }
})();

const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Pin');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Health Check
    if (req.method === 'GET' && pathname === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        return res.end(JSON.stringify({
            status: 'ok',
            service: 'Bukittinggi Kos Standalone Service',
            version: '1.0.0',
            uptime: process.uptime()
        }));
    }

    // Manifest Endpoint
    if (req.method === 'GET' && pathname === '/manifest') {
        const manifestPath = path.join(__dirname, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            return res.end(fs.readFileSync(manifestPath, 'utf8'));
        }
    }

    // Command Dispatch Endpoint (from RapBot Extension Manager)
    if (req.method === 'POST' && pathname === '/command') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body || '{}');
                console.log(`[Kost Server] 📥 Received command: "${payload.command}" from ${payload.context?.senderNumber || 'unknown'}`);

                const result = await routeCommand(payload);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('[Kost Server] ❌ Error executing command:', err);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    type: 'reply',
                    text: '❌ Terjadi kesalahan internal pada Kost Extension.'
                }));
            }
        });
        return;
    }

    // REST API Endpoints (/api/kost, /api/submissions)
    if (pathname.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                res.setHeader('Content-Type', 'application/json');
                await handleApiRequest(req, res, urlObj, body);
            } catch (err) {
                console.error('[Kost Server] ❌ API Error:', err);
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, message: err.message }));
            }
        });
        return;
    }

    // Static Web UI for Kost Dashboard
    if (req.method === 'GET' && (pathname === '/' || pathname === '/kost' || pathname === '/index.html')) {
        const indexPath = path.join(__dirname, 'web', 'public', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.writeHead(200);
            return res.end(fs.readFileSync(indexPath));
        }
    }

    // 404 Fallback
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 Bukittinggi Kos Standalone Service active at http://localhost:${PORT}`);
});
