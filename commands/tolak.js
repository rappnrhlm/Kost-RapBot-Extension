// Kost/commands/tolak.js - Handler for !tolak, !tolakusul, !rejectusul
const submissionRepo = require('../database/submissionRepository');

async function handleTolakCommand({ args, context }) {
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};
    const senderNumber = context.senderNumber || 'admin';

    if (!isGroup && !isOwner) {
        return { type: 'reply', text: '❌ Command ini hanya bisa digunakan di dalam grup.' };
    }

    if (isGroup && !group.isInitialized) {
        return { type: 'reply', text: '❌ Grup ini belum diinisialisasi.\n\nGunakan: `!initgroup <nama grup>`' };
    }

    if (group.role === 'public') {
        return { type: 'reply', text: '❌ Perintah `!tolak` hanya untuk grup internal admin.' };
    }

    const targetId = args[0]?.replace(/^#/, '').trim();
    if (!targetId || isNaN(Number(targetId))) {
        return { type: 'reply', text: '❌ Format salah.\nContoh: `!tolak 1` atau `!tolak #1`\n\n💡 Ketik `!listusul` untuk melihat ID usulan.' };
    }

    const result = await submissionRepo.reviewKostSubmission(targetId, 'rejected', senderNumber);
    if (!result.success) {
        return { type: 'reply', text: `❌ Gagal: ${result.message}` };
    }

    return {
        type: 'reply',
        text: `✅ Usulan kos #${targetId} ("${result.submission.name}") berhasil ditolak.`
    };
}

module.exports = {
    handleTolakCommand
};
