// Kost/database/schema.js - DDL table initialization and auto-seeding for Kost project
const fs = require('fs');
const path = require('path');
const { getPool } = require('./pool');

const KOST_DATA_DIR = path.join(__dirname, '..', 'data');
const KOST_FILE = path.join(KOST_DATA_DIR, 'kost.json');
const SUBMISSIONS_FILE = path.join(KOST_DATA_DIR, 'kost_submissions.json');

function ensureDataFiles() {
    if (!fs.existsSync(KOST_DATA_DIR)) {
        fs.mkdirSync(KOST_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(KOST_FILE)) {
        fs.writeFileSync(KOST_FILE, JSON.stringify([
            {
                id: 'KST-000001',
                name: 'Kost Melati Indah Birugo',
                whatsapp: '081234567890',
                instagram: 'kostmelati_bkt',
                tiktok: null,
                status: 'published',
                createdAt: new Date().toISOString()
            },
            {
                id: 'KST-000002',
                name: 'Kost Mawar Aur Kuning',
                whatsapp: '082198765432',
                instagram: 'kostmawar_aur',
                tiktok: null,
                status: 'published',
                createdAt: new Date().toISOString()
            },
            {
                id: 'KST-000003',
                name: 'Kost Flamboyan Belakang Balok',
                whatsapp: '085211223344',
                instagram: 'flamboyankos',
                tiktok: null,
                status: 'pending',
                createdAt: new Date().toISOString()
            }
        ], null, 2));
    }
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
    }
}

async function ensureKostTables() {
    ensureDataFiles();
    const db = getPool();
    if (!db) return;

    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS kost (
                id VARCHAR(20) NOT NULL PRIMARY KEY,
                group_id VARCHAR(100) DEFAULT '',
                name VARCHAR(255) NOT NULL,
                instagram VARCHAR(100) DEFAULT NULL,
                tiktok VARCHAR(100) DEFAULT NULL,
                whatsapp VARCHAR(50) DEFAULT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                added_by VARCHAR(100) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_by VARCHAR(100) DEFAULT NULL,
                sent_at DATETIME DEFAULT NULL,
                INDEX idx_group_id (group_id),
                INDEX idx_group_status (group_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS kost_submissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id VARCHAR(100) DEFAULT '',
                name VARCHAR(255) NOT NULL,
                contacts_raw TEXT NOT NULL,
                submitted_by VARCHAR(100) NOT NULL,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reviewed_by VARCHAR(100) DEFAULT NULL,
                reviewed_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // ----------------------------------------------------
        // Auto-seed: If DB table is empty, seed from JSON file
        // ----------------------------------------------------
        const [cntRows] = await db.query('SELECT COUNT(*) as cnt FROM kost');
        if (cntRows[0]?.cnt === 0 && fs.existsSync(KOST_FILE)) {
            const raw = fs.readFileSync(KOST_FILE, 'utf8');
            const fileKost = JSON.parse(raw || '[]');
            for (const k of fileKost) {
                if (!k.id || !k.name) continue;
                await db.query(
                    `INSERT IGNORE INTO kost (id, group_id, name, instagram, tiktok, whatsapp, status, added_by, created_at, sent_by, sent_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [k.id, k.groupId || k.group_id || '', k.name, k.instagram || null, k.tiktok || null, k.whatsapp || null, k.status || 'pending', k.addedBy || k.added_by || 'init', k.createdAt || k.created_at ? new Date(k.createdAt || k.created_at) : new Date(), k.sentBy || k.sent_by || null, k.sentAt || k.sent_at ? new Date(k.sentAt || k.sent_at) : null]
                );
            }
            console.log(`[Kost/Database] Auto-seeded ${fileKost.length} kost rows to MariaDB.`);
        } else if (cntRows[0]?.cnt > 0) {
            // ----------------------------------------------------
            // Cache Sync: Dump MariaDB data to local JSON cache
            // ----------------------------------------------------
            const [rows] = await db.query('SELECT * FROM kost ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC');
            const mappedRows = rows.map(r => ({
                id: r.id,
                groupId: r.group_id || '',
                name: r.name,
                instagram: r.instagram || null,
                tiktok: r.tiktok || null,
                whatsapp: r.whatsapp || null,
                status: r.status,
                addedBy: r.added_by || null,
                createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
                sentBy: r.sent_by || null,
                sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null
            }));
            fs.writeFileSync(KOST_FILE, JSON.stringify(mappedRows, null, 2));
            console.log(`[Kost/Database] Synced ${mappedRows.length} rows from MariaDB to ${KOST_FILE}`);
        }

        // Sync Submissions cache as well
        const [subRows] = await db.query('SELECT * FROM kost_submissions ORDER BY id ASC');
        if (subRows.length > 0) {
            const mappedSubRows = subRows.map(s => ({
                id: s.id,
                groupId: s.group_id || '',
                name: s.name,
                contactsRaw: s.contacts_raw,
                submittedBy: s.submitted_by,
                submittedAt: s.submitted_at ? new Date(s.submitted_at).toISOString() : null,
                status: s.status,
                reviewedBy: s.reviewed_by || null,
                reviewedAt: s.reviewed_at ? new Date(s.reviewed_at).toISOString() : null,
                createdAt: s.created_at ? new Date(s.created_at).toISOString() : null
            }));
            fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(mappedSubRows, null, 2));
        }
    } catch (err) {
        console.warn('[Kost/Database] Warning initializing schema, using JSON fallback:', err.message);
    }
}

module.exports = {
    KOST_DATA_DIR,
    KOST_FILE,
    SUBMISSIONS_FILE,
    ensureDataFiles,
    ensureKostTables
};
