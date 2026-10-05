# 🏠 Bukittinggi Kos Service

Standalone Microservice for Bukittinggi Kos listing, submissions, and search management. Built for integration with **RapBot** via HTTP Extension Protocol.

---

## 🌟 Features

- **Listing & Search**: Fast lookup of kos data by name, location, and social media / WhatsApp.
- **Admin Workflow**: Command tools for approving (`!acc`), rejecting (`!tolak`), updating (`!editkost`), and broadcasting promo DMs (`!dm`).
- **Community Submissions**: Public submission flow (`!usulkost`) with moderation queue (`!listusul`).
- **Hybrid Storage**: MariaDB/MySQL database with automatic local JSON fallback.

---

## 📁 Directory Structure

```text
Kost/
├── server.js               # Standalone HTTP Server (Port 3005)
├── commands/               # Command handlers (kost, usulkost, acc, tolak, dm, etc.)
├── database/               # MariaDB pool & repositories
├── utils/                  # DM Templates, contact parsers, and formatters
├── web/                    # API endpoints for web integration
├── manifest.json           # Extension descriptor for RapBot
└── data/                   # Local JSON cache fallback (gitignored)
```

---

## 🚀 Setup & Run

### 1. Installation
```bash
cd kost
npm install
```

### 2. Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
```env
PORT=3005
DB_HOST=localhost
DB_PORT=3306
DB_USER=raffa
DB_PASSWORD=your_password
DB_NAME=RapDB
```

### 3. Start Service
```bash
# Production
npm start

# With PM2
pm2 start server.js --name "Kost"
```

---

## 📜 License
ISC License
