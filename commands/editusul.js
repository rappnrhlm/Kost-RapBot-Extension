// Kost/commands/editusul.js - Handler for !editusul, !ubahusul, !updateusul
const submissionRepo = require('../database/submissionRepository');

async function handleEditUsulCommand({ args, context }) {
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};
    const senderNumber = context.senderNumber || 'admin';

    if (!isGroup && !isOwner) {
        return { type: 'reply', text: '❌ Command ini hanya bisa digunakan di dalam grup.' };
    }

    if (isGroup && !group.isInitialized) {
        return { type: 'reply', text: '❌ Grup ini belum diinisialisasi.' };
    }

    if (group.role === 'public') {
        return { type: 'reply', text: '❌ Perintah ini khusus untuk grup internal admin.' };
    }

    const raw = args.join(' ').trim();
    if (!raw) {
        const guide =
`❌ *Format Edit Usulan:*
\`!editusul <ID> <Nama Baru> > <Kontak Baru>\`

_Contoh:_
• \`!editusul 3 Kost Sakura Indah > wa: 08123456789 | ig: @kostsakura\``;
        return { type: 'reply', text: guide };
    }

    const firstSpaceIdx = raw.indexOf(' ');
    if (firstSpaceIdx === -1) {
        return { type: 'reply', text: '❌ Masukkan nama dan kontak usulan baru setelah nomor ID usulan.' };
    }

    const targetId = raw.substring(0, firstSpaceIdx).trim().replace(/^#/, '');
    const restContent = raw.substring(firstSpaceIdx + 1).trim();

    const parts = restContent.split('>');
    const newName = parts[0]?.trim();
    const contactStr = parts.slice(1).join('>').trim();

    if (!newName) {
        return { type: 'reply', text: '❌ Nama usulan baru wajib diisi.' };
    }

    const existing = await submissionRepo.getKostSubmissionById(targetId);
    if (!existing) {
        return { type: 'reply', text: `❌ Usulan #${targetId} tidak ditemukan.` };
    }

    const newContacts = contactStr || existing.contactsRaw;
    const result = await submissionRepo.updateKostSubmission(targetId, {
        name: newName,
        contactsRaw: newContacts,
        reviewedBy: senderNumber
    });

    if (!result.success) {
        return { type: 'reply', text: `❌ ${result.message}` };
    }

    const succMsg =
`✅ *Usulan #${targetId} Berhasil Diperbarui!*

🏠 *Nama:* ${newName}
📱 *Kontak:* ${newContacts}
📊 *Status:* ${String(result.data.status).toUpperCase()}`;

    return { type: 'reply', text: succMsg };
}

module.exports = {
    handleEditUsulCommand
};
