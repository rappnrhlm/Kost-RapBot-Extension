// Kost/database/submissionRepository.js - Repository for crowdsourced kost submissions
const fs = require('fs');
const { getPool } = require('./pool');
const { ensureKostTables, SUBMISSIONS_FILE } = require('./schema');

function readJsonData() {
    try {
        if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
        const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
        return JSON.parse(raw || '[]');
    } catch {
        return [];
    }
}

function writeJsonData(data) {
    try {
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2));
    } catch {}
}

function mapRow(r) {
    if (!r) return null;
    return {
        id: r.id,
        groupId: r.group_id || r.groupId || '',
        name: r.name,
        contactsRaw: r.contacts_raw || r.contactsRaw || '',
        submittedBy: r.submitted_by || r.submittedBy || '',
        submittedAt: r.submitted_at || r.submittedAt || null,
        status: r.status || 'pending',
        reviewedBy: r.reviewed_by || r.reviewedBy || null,
        reviewedAt: r.reviewed_at || r.reviewedAt || null
    };
}

async function addKostSubmission({ groupId = '', name, contactsRaw, submittedBy = '' }) {
    await ensureKostTables();
    const cleanName = String(name || '').trim();
    const cleanContacts = String(contactsRaw || '').trim();
    const cleanSubmitter = String(submittedBy || '').trim();

    if (!cleanName || !cleanContacts) {
        return { success: false, message: 'Nama kos dan kontak wajib diisi.' };
    }

    const now = new Date();
    let insertId = 1;
    try {
        const list = readJsonData();
        let maxId = 0;
        list.forEach(s => {
            const n = Number(s.id);
            if (!isNaN(n) && n > maxId) maxId = n;
        });
        insertId = maxId + 1;
    } catch {}

    const db = getPool();
    if (db) {
        try {
            const [res] = await db.query(
                `INSERT INTO kost_submissions (group_id, name, contacts_raw, submitted_by, submitted_at, status)
                 VALUES (?, ?, ?, ?, ?, 'pending')`,
                [groupId, cleanName, cleanContacts, cleanSubmitter, now]
            );
            if (res && res.insertId) insertId = res.insertId;
        } catch {}
    }

    const submission = {
        id: insertId,
        groupId,
        name: cleanName,
        contactsRaw: cleanContacts,
        submittedBy: cleanSubmitter,
        submittedAt: now.toISOString(),
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null
    };

    const list = readJsonData();
    list.unshift(submission);
    writeJsonData(list);

    return {
        success: true,
        message: 'Usulan kos berhasil dikirim.',
        submission,
        data: submission
    };
}

async function getKostSubmissions({ groupId = null, status = 'pending' } = {}) {
    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            let query = 'SELECT * FROM kost_submissions';
            const params = [];
            const conditions = [];

            if (status && status !== 'all') {
                conditions.push('status = ?');
                params.push(status);
            }
            if (groupId) {
                conditions.push('group_id = ?');
                params.push(groupId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            query += ' ORDER BY id DESC';

            const [rows] = await db.query(query, params);
            if (rows.length > 0 || (conditions.length > 0 && rows)) {
                return rows.map(mapRow);
            }
        } catch {}
    }

    let list = readJsonData();
    if (status && status !== 'all') {
        list = list.filter(s => s.status === status);
    }
    if (groupId) {
        list = list.filter(s => s.groupId === groupId);
    }
    return list;
}

async function getKostSubmissionById(id) {
    const cleanId = Number(id);
    if (!cleanId || isNaN(cleanId)) return null;

    await ensureKostTables();
    const db = getPool();

    if (db) {
        try {
            const [rows] = await db.query('SELECT * FROM kost_submissions WHERE id = ?', [cleanId]);
            if (rows.length > 0) return mapRow(rows[0]);
        } catch {}
    }

    const list = readJsonData();
    return list.find(s => Number(s.id) === cleanId) || null;
}

async function reviewKostSubmission(id, newStatus, reviewerNumber = '') {
    const cleanId = Number(id);
    if (!cleanId || isNaN(cleanId)) {
        return { success: false, message: 'ID usulan tidak valid.' };
    }

    const cleanStatus = ['approved', 'rejected'].includes(newStatus) ? newStatus : 'pending';
    const sub = await getKostSubmissionById(cleanId);
    if (!sub) {
        return { success: false, message: `Usulan #${cleanId} tidak ditemukan.` };
    }

    if (sub.status !== 'pending') {
        return { success: false, message: `Usulan #${cleanId} sudah di-${sub.status} sebelumnya.` };
    }

    const now = new Date();
    const db = getPool();
    if (db) {
        try {
            await db.query(
                `UPDATE kost_submissions 
                 SET status = ?, reviewed_by = ?, reviewed_at = ?
                 WHERE id = ?`,
                [cleanStatus, reviewerNumber || 'admin', now, cleanId]
            );
        } catch {}
    }

    const list = readJsonData();
    const item = list.find(s => Number(s.id) === cleanId);
    if (item) {
        item.status = cleanStatus;
        item.reviewedBy = reviewerNumber || 'admin';
        item.reviewedAt = now.toISOString();
        writeJsonData(list);
    }

    return {
        success: true,
        status: cleanStatus,
        submission: {
            id: sub.id,
            groupId: sub.groupId,
            name: sub.name,
            contactsRaw: sub.contactsRaw,
            submittedBy: sub.submittedBy
        }
    };
}

async function updateKostSubmission(id, { name, contactsRaw, groupId, status, reviewedBy } = {}) {
    const cleanId = Number(id);
    if (!cleanId || isNaN(cleanId)) return { success: false, message: 'ID usulan tidak valid.' };

    const current = await getKostSubmissionById(cleanId);
    if (!current) {
        return { success: false, notFound: true, message: `Usulan #${cleanId} tidak ditemukan.` };
    }

    const newName = name !== undefined ? String(name).trim() : current.name;
    const newContacts = contactsRaw !== undefined ? String(contactsRaw).trim() : current.contactsRaw;
    const newGroupId = groupId !== undefined ? groupId : current.groupId;
    const newStatus = status !== undefined && ['pending', 'approved', 'rejected'].includes(status) ? status : current.status;
    const newReviewer = reviewedBy !== undefined ? String(reviewedBy).trim() : current.reviewedBy;

    if (!newName) {
        return { success: false, message: 'Nama usulan tidak boleh kosong.' };
    }

    const db = getPool();
    if (db) {
        try {
            await db.query(
                `UPDATE kost_submissions
                 SET name = ?, contacts_raw = ?, group_id = ?, status = ?, reviewed_by = ?
                 WHERE id = ?`,
                [newName, newContacts, newGroupId, newStatus, newReviewer || null, cleanId]
            );
        } catch {}
    }

    const list = readJsonData();
    const item = list.find(s => Number(s.id) === cleanId);
    if (item) {
        item.name = newName;
        item.contactsRaw = newContacts;
        item.groupId = newGroupId;
        item.status = newStatus;
        item.reviewedBy = newReviewer || null;
        writeJsonData(list);
    }

    const updated = await getKostSubmissionById(cleanId);
    return {
        success: true,
        message: `Usulan #${cleanId} berhasil diperbarui.`,
        data: updated,
        submission: updated
    };
}

async function deleteKostSubmission(id) {
    const cleanId = Number(id);
    if (!cleanId || isNaN(cleanId)) return { success: false, message: 'ID usulan tidak valid.' };

    const db = getPool();
    if (db) {
        try {
            await db.query('DELETE FROM kost_submissions WHERE id = ?', [cleanId]);
        } catch {}
    }

    let list = readJsonData();
    list = list.filter(s => Number(s.id) !== cleanId);
    writeJsonData(list);

    return { success: true, message: 'Usulan berhasil dihapus.' };
}

module.exports = {
    addKostSubmission,
    getKostSubmissions,
    getKostSubmissionById,
    reviewKostSubmission,
    updateKostSubmission,
    deleteKostSubmission
};
