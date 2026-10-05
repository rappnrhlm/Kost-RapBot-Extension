// Kost/database/kostRepository.js - Repository for Bukittinggi Kos listings
const fs = require('fs');
const { getPool } = require('./pool');
const { ensureKostTables, KOST_FILE } = require('./schema');
const {
    cleanInstagramUsername,
    cleanTiktokUsername,
    cleanWhatsappNumber,
    normalizeKostId
} = require('../utils/formatters');

function readJsonData() {
    try {
        if (!fs.existsSync(KOST_FILE)) return [];
        const raw = fs.readFileSync(KOST_FILE, 'utf8');
        return JSON.parse(raw || '[]');
    } catch {
        return [];
    }
}

function writeJsonData(data) {
    try {
        fs.writeFileSync(KOST_FILE, JSON.stringify(data, null, 2));
    } catch {}
}

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        groupId: row.group_id || row.groupId || '',
        name: row.name,
        instagram: row.instagram || null,
        tiktok: row.tiktok || null,
        whatsapp: row.whatsapp || null,
        status: row.status,
        addedBy: row.added_by || row.addedBy || null,
        createdAt: row.created_at || row.createdAt || null,
        sentBy: row.sent_by || row.sentBy || null,
        sentAt: row.sent_at || row.sentAt || null
    };
}

async function generateNextKostId() {
    await ensureKostTables();
    const db = getPool();
    let maxNum = 0;

    if (db) {
        try {
            const [rows] = await db.query(
                "SELECT id FROM kost WHERE id LIKE 'KST-%' ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) DESC LIMIT 1"
            );
            if (rows.length > 0 && rows[0]?.id) {
                const match = String(rows[0].id).match(/^KST-(\d+)$/i);
                if (match) maxNum = parseInt(match[1], 10);
            }
        } catch {}
    }

    if (maxNum === 0) {
        const list = readJsonData();
        list.forEach(k => {
            const match = String(k.id || '').match(/^KST-(\d+)$/i);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
    }

    return `KST-${String(maxNum + 1).padStart(6, '0')}`;
}

async function getKostList(groupId = null) {
    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            if (groupId) {
                const [groupRows] = await db.query(
                    'SELECT * FROM kost WHERE group_id = ? ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC',
                    [groupId]
                );
                if (groupRows.length > 0) return groupRows.map(mapRow);
            }
            const [rows] = await db.query('SELECT * FROM kost ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC');
            return rows.map(mapRow);
        } catch {}
    }

    const list = readJsonData();
    if (groupId) {
        const filtered = list.filter(k => k.groupId === groupId);
        if (filtered.length > 0) return filtered;
    }
    return list;
}

async function getKostByStatus(status, groupId = null) {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'all') {
        return getKostList(groupId);
    }

    const normalizedStatus = (s === 'posted') ? 'published' : s;
    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            if (groupId) {
                const [groupRows] = await db.query(
                    'SELECT * FROM kost WHERE (status = ? OR (status = "posted" AND ? = "published")) AND group_id = ? ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC',
                    [normalizedStatus, normalizedStatus, groupId]
                );
                if (groupRows.length > 0) return groupRows.map(mapRow);
            }
            const [rows] = await db.query(
                'SELECT * FROM kost WHERE (status = ? OR (status = "posted" AND ? = "published")) ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC',
                [normalizedStatus, normalizedStatus]
            );
            return rows.map(mapRow);
        } catch {}
    }

    const list = readJsonData();
    return list.filter(k => (k.status === normalizedStatus || (normalizedStatus === 'published' && k.status === 'posted')));
}

async function getKostById(targetId, groupId = null) {
    if (!targetId) return null;
    const cleanId = normalizeKostId(targetId) || String(targetId).trim().toUpperCase();

    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            if (groupId) {
                const [groupRows] = await db.query('SELECT * FROM kost WHERE id = ? AND group_id = ?', [cleanId, groupId]);
                if (groupRows.length > 0) return mapRow(groupRows[0]);
            }
            const [rows] = await db.query('SELECT * FROM kost WHERE id = ?', [cleanId]);
            if (rows.length > 0) return mapRow(rows[0]);
        } catch {}
    }

    const list = readJsonData();
    return list.find(k => k.id === cleanId) || null;
}

async function searchKost(query, groupId = null, options = {}) {
    if (!query) return [];
    const q = String(query).trim().toLowerCase();
    let targetStatus = typeof options === 'string' ? options : options?.status;
    if (targetStatus === 'posted') targetStatus = 'published';

    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            const likePattern = `%${q}%`;
            let sql = `SELECT * FROM kost WHERE (
                LOWER(name) LIKE ? OR 
                LOWER(COALESCE(instagram, '')) LIKE ? OR 
                LOWER(COALESCE(tiktok, '')) LIKE ? OR 
                LOWER(COALESCE(whatsapp, '')) LIKE ? OR 
                LOWER(id) LIKE ?
            )`;
            const params = [likePattern, likePattern, likePattern, likePattern, likePattern];

            if (targetStatus && targetStatus !== 'all') {
                sql += ' AND (status = ? OR (status = "posted" AND ? = "published"))';
                params.push(targetStatus, targetStatus);
            }
            if (groupId) {
                sql += ' AND group_id = ?';
                params.push(groupId);
            }
            sql += ' ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) ASC';

            const [rows] = await db.query(sql, params);
            if (rows.length > 0 || groupId) return rows.map(mapRow);
        } catch {}
    }

    const list = readJsonData();
    return list.filter(k => {
        const matchesQuery = 
            (k.name && k.name.toLowerCase().includes(q)) ||
            (k.instagram && k.instagram.toLowerCase().includes(q)) ||
            (k.tiktok && k.tiktok.toLowerCase().includes(q)) ||
            (k.whatsapp && k.whatsapp.toLowerCase().includes(q)) ||
            (k.id && k.id.toLowerCase().includes(q));

        if (!matchesQuery) return false;
        if (targetStatus && targetStatus !== 'all' && k.status !== targetStatus) return false;
        return true;
    });
}

async function addKost({ name, instagram = null, tiktok = null, whatsapp = null, status = 'pending', addedBy = '', groupId = '' }) {
    await ensureKostTables();
    const cleanName = String(name || '').trim();
    const cleanIg = cleanInstagramUsername(instagram);
    const cleanTt = cleanTiktokUsername(tiktok);
    const cleanWa = cleanWhatsappNumber(whatsapp);
    let cleanStatus = String(status || 'pending').toLowerCase();
    if (cleanStatus === 'posted') cleanStatus = 'published';
    if (!['pending', 'sent', 'published'].includes(cleanStatus)) cleanStatus = 'pending';

    if (!cleanName) {
        return { success: false, message: 'Nama kost wajib diisi.' };
    }
    if (!cleanIg && !cleanTt && !cleanWa) {
        return { success: false, message: 'Minimal salah satu kontak (Instagram, TikTok, atau WhatsApp) wajib diisi.' };
    }

    const nextId = await generateNextKostId();
    const now = new Date();
    const isSentOrPub = cleanStatus === 'sent' || cleanStatus === 'published';

    const newRecord = {
        id: nextId,
        groupId: groupId || '',
        name: cleanName,
        instagram: cleanIg,
        tiktok: cleanTt,
        whatsapp: cleanWa,
        status: cleanStatus,
        addedBy: addedBy || null,
        createdAt: now.toISOString(),
        sentBy: isSentOrPub ? (addedBy || 'admin') : null,
        sentAt: isSentOrPub ? now.toISOString() : null
    };

    const db = getPool();
    if (db) {
        try {
            await db.query(
                `INSERT INTO kost (id, group_id, name, instagram, tiktok, whatsapp, status, added_by, created_at, sent_by, sent_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newRecord.id, newRecord.groupId, newRecord.name, newRecord.instagram, newRecord.tiktok, newRecord.whatsapp, newRecord.status, newRecord.addedBy, now, newRecord.sentBy, isSentOrPub ? now : null]
            );
        } catch (err) {
            console.warn('[Kost/Database] Warning inserting to MariaDB, syncing JSON:', err.message);
        }
    }

    const list = readJsonData();
    list.push(newRecord);
    writeJsonData(list);

    return {
        success: true,
        message: `Kost "${cleanName}" berhasil ditambahkan.`,
        data: newRecord
    };
}

async function setKostStatus(targetId, targetStatus, updatedBy = '', groupId = null) {
    if (!targetId) return { success: false, message: 'ID kost wajib diisi.' };
    const cleanId = normalizeKostId(targetId) || String(targetId).trim().toUpperCase();

    let s = String(targetStatus || 'pending').toLowerCase().trim();
    if (s === 'posted') s = 'published';
    if (!['pending', 'sent', 'published'].includes(s)) {
        return { success: false, message: `Status "${targetStatus}" tidak valid.` };
    }

    const current = await getKostById(cleanId, groupId);
    if (!current) {
        return { success: false, notFound: true, message: `Kost dengan ID ${cleanId} tidak ditemukan.` };
    }

    const now = new Date();
    let sentAt = current.sentAt;
    let sentBy = current.sentBy;

    if (s === 'pending') {
        sentAt = null;
        sentBy = null;
    } else if (s === 'sent' || s === 'published') {
        if (!sentAt) sentAt = now.toISOString();
        if (updatedBy) sentBy = updatedBy;
    }

    const db = getPool();
    if (db) {
        try {
            await db.query(
                'UPDATE kost SET status = ?, sent_by = ?, sent_at = ? WHERE id = ?',
                [s, sentBy || null, sentAt ? new Date(sentAt) : null, cleanId]
            );
        } catch {}
    }

    const list = readJsonData();
    const idx = list.findIndex(k => k.id === cleanId);
    if (idx !== -1) {
        list[idx].status = s;
        list[idx].sentBy = sentBy || null;
        list[idx].sentAt = sentAt || null;
        writeJsonData(list);
    }

    const updated = await getKostById(cleanId, groupId);
    return {
        success: true,
        message: `Status kost ${cleanId} berhasil diubah menjadi ${s.toUpperCase()}.`,
        data: updated
    };
}

async function markKostSent(targetId, groupId = null, senderNumber = '') {
    const cleanId = normalizeKostId(targetId) || String(targetId || '').trim().toUpperCase();
    if (!cleanId) return { success: false, message: 'ID kost wajib diisi.' };

    const current = await getKostById(cleanId, groupId);
    if (!current) {
        return { success: false, notFound: true, message: `Kost dengan ID ${cleanId} tidak ditemukan.` };
    }

    if (current.status === 'sent') {
        return {
            success: false,
            alreadySent: true,
            message: `Kost dengan ID ${cleanId} sudah berstatus SENT sebelumnya.`,
            data: current
        };
    }

    return setKostStatus(cleanId, 'sent', senderNumber || 'admin', groupId);
}

async function markKostPublished(targetId, groupId = null, publishedBy = '') {
    const cleanId = normalizeKostId(targetId) || String(targetId || '').trim().toUpperCase();
    if (!cleanId) return { success: false, message: 'ID kost wajib diisi.' };

    const current = await getKostById(cleanId, groupId);
    if (!current) {
        return { success: false, notFound: true, message: `Kost dengan ID ${cleanId} tidak ditemukan.` };
    }

    if (current.status === 'published' || current.status === 'posted') {
        return {
            success: false,
            alreadyPublished: true,
            message: `Kost dengan ID ${cleanId} sudah berstatus PUBLISHED sebelumnya.`,
            data: current
        };
    }

    return setKostStatus(cleanId, 'published', publishedBy || 'admin', groupId);
}

async function markKostBatchSent(ids, groupId = null, senderNumber = '') {
    const cleanIds = Array.isArray(ids) ? [...new Set(ids.map(normalizeKostId).filter(Boolean))] : [];
    if (cleanIds.length === 0) return { success: false, message: 'Tidak ada ID yang valid.' };

    const toUpdate = [];
    const alreadySent = [];
    const notFound = [];

    for (const id of cleanIds) {
        const item = await getKostById(id, groupId);
        if (!item) {
            notFound.push(id);
        } else if (item.status === 'sent') {
            alreadySent.push(item);
        } else {
            toUpdate.push(item);
            await setKostStatus(id, 'sent', senderNumber || 'admin', groupId);
        }
    }

    return {
        success: true,
        updated: toUpdate,
        alreadySent,
        notFound,
        total: cleanIds.length
    };
}

async function setKostBatchStatus(ids, targetStatus, updatedBy = '', groupId = null) {
    const cleanIds = Array.isArray(ids) ? [...new Set(ids.map(normalizeKostId).filter(Boolean))] : [];
    const s = String(targetStatus || 'pending').toLowerCase();
    if (cleanIds.length === 0) return { success: false, message: 'Tidak ada ID yang valid.' };

    const toUpdate = [];
    const alreadyInStatus = [];
    const notFound = [];

    for (const id of cleanIds) {
        const item = await getKostById(id, groupId);
        if (!item) {
            notFound.push(id);
        } else if (item.status === s || (s === 'published' && item.status === 'posted')) {
            alreadyInStatus.push(item);
        } else {
            toUpdate.push(item);
            await setKostStatus(id, s, updatedBy || 'admin', groupId);
        }
    }

    return {
        success: true,
        status: s,
        updated: toUpdate,
        alreadyInStatus,
        notFound,
        total: cleanIds.length
    };
}

async function deleteKost(targetId, groupId = null) {
    if (!targetId) return { success: false, message: 'ID kost wajib diisi.' };
    const cleanId = normalizeKostId(targetId) || String(targetId).trim().toUpperCase();

    const current = await getKostById(cleanId, groupId);
    if (!current) {
        return { success: false, notFound: true, message: `Kost dengan ID ${cleanId} tidak ditemukan.` };
    }

    const db = getPool();
    if (db) {
        try {
            await db.query('DELETE FROM kost WHERE id = ?', [cleanId]);
        } catch {}
    }

    let list = readJsonData();
    list = list.filter(k => k.id !== cleanId);
    writeJsonData(list);

    return { success: true, message: 'Kost berhasil dihapus.', data: current };
}

async function updateKost(id, { name, instagram, tiktok, whatsapp, status, updatedBy = '' }) {
    if (!id) return { success: false, message: 'ID kost wajib diisi.' };
    const cleanId = normalizeKostId(id) || String(id).trim().toUpperCase();

    const current = await getKostById(cleanId);
    if (!current) {
        return { success: false, notFound: true, message: `Kost dengan ID ${cleanId} tidak ditemukan.` };
    }

    const cleanName = name !== undefined ? String(name).trim() : current.name;
    const cleanIg = instagram !== undefined ? cleanInstagramUsername(instagram) : current.instagram;
    const cleanTt = tiktok !== undefined ? cleanTiktokUsername(tiktok) : current.tiktok;
    const cleanWa = whatsapp !== undefined ? cleanWhatsappNumber(whatsapp) : current.whatsapp;
    let cleanStatus = status !== undefined ? String(status).toLowerCase() : current.status;
    if (cleanStatus === 'posted') cleanStatus = 'published';

    const db = getPool();
    if (db) {
        try {
            await db.query(
                'UPDATE kost SET name = ?, instagram = ?, tiktok = ?, whatsapp = ?, status = ? WHERE id = ?',
                [cleanName, cleanIg, cleanTt, cleanWa, cleanStatus, cleanId]
            );
        } catch {}
    }

    const list = readJsonData();
    const idx = list.findIndex(k => k.id === cleanId);
    if (idx !== -1) {
        list[idx] = {
            ...list[idx],
            name: cleanName,
            instagram: cleanIg,
            tiktok: cleanTt,
            whatsapp: cleanWa,
            status: cleanStatus
        };
        writeJsonData(list);
    }

    const updated = await getKostById(cleanId);
    return { success: true, message: 'Data kost berhasil diperbarui.', data: updated };
}

async function getKostStats(groupId = null) {
    const list = await getKostList(groupId);
    return {
        total: list.length,
        pending: list.filter(k => k.status === 'pending').length,
        sent: list.filter(k => k.status === 'sent').length,
        published: list.filter(k => k.status === 'published' || k.status === 'posted').length
    };
}

module.exports = {
    generateNextKostId,
    getKostList,
    getKostByStatus,
    getKostById,
    searchKost,
    addKost,
    setKostStatus,
    markKostSent,
    markKostPublished,
    markKostBatchSent,
    setKostBatchStatus,
    deleteKost,
    updateKost,
    getKostStats
};
