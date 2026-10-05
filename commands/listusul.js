// Kost/commands/listusul.js - Handler for !listusul, !usulan, !daftarusul
const submissionRepo = require('../database/submissionRepository');
const { formatIndonesianDateTime } = require('../utils/formatters');

async function handleListUsulCommand({ args, context }) {
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};

    if (!isGroup && !isOwner) {
        return { type: 'reply', text: '❌ Command ini hanya bisa digunakan di dalam grup.' };
    }

    if (isGroup && !group.isInitialized) {
        return { type: 'reply', text: '❌ Grup ini belum diinisialisasi.\n\nGunakan: `!initgroup <nama grup>`' };
    }

    if (group.role === 'public') {
        return { type: 'reply', text: '❌ Perintah `!listusul` hanya untuk grup internal admin.' };
    }

    const filterStatus = args[0]?.toLowerCase() || 'pending';
    const list = await submissionRepo.getKostSubmissions({ status: filterStatus });

    if (!list || !list.length) {
        return { type: 'reply', text: `📋 Tidak ada usulan kos dengan status *${filterStatus.toUpperCase()}*.` };
    }

    let text = `📥 *DAFTAR USULAN KOS (${filterStatus.toUpperCase()})*\nTotal: ${list.length} usulan\n\n`;
    list.forEach((sub, idx) => {
        const timeStr = sub.submittedAt ? formatIndonesianDateTime(sub.submittedAt) : '-';
        const statusBadge = sub.status === 'approved' ? '✅ Disetujui' : (sub.status === 'rejected' ? '❌ Ditolak' : '⏳ Pending');
        text += `${idx + 1}. *#${sub.id} - ${sub.name}*\n   📞 Kontak: ${sub.contactsRaw}\n   👤 Pengirim: wa.me/${sub.submittedBy || 'anon'}\n   🕒 Waktu: ${timeStr}\n   📌 Status: ${statusBadge}\n\n`;
    });

    text += `────────────────────\n💡 *Aksi Admin:*\n• Menyetujui: \`!acc <ID>\` (contoh: \`!acc 1\`)\n• Menolak: \`!tolak <ID>\` (contoh: \`!tolak 1\`)`;

    return { type: 'reply', text: text.trim() };
}

module.exports = {
    handleListUsulCommand
};
