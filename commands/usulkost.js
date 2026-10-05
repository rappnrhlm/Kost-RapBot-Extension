// Kost/commands/usulkost.js - Handler for !usulkost, !submitkost, !usul, !suggest, !daftarkost
const submissionRepo = require('../database/submissionRepository');
const { checkCooldown } = require('../utils/cooldown');
const { formatWhatsappUrl } = require('../utils/formatters');

async function handleUsulkostCommand({ args, context }) {
    const from = context.from;
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};
    const senderNumber = context.senderNumber || 'unknown';

    if (!isGroup && !isOwner) {
        return { type: 'reply', text: '❌ Command ini hanya bisa digunakan di dalam grup.' };
    }

    if (isGroup && !group.isInitialized) {
        return { type: 'reply', text: '❌ Grup ini belum diinisialisasi.\n\nGunakan: `!initgroup <nama grup>`' };
    }

    if (group.role === 'public') {
        const cdKey = `usul:${from}:${senderNumber}`;
        const cd = checkCooldown(cdKey, 30);
        if (!cd.allowed) {
            return { type: 'reply', text: `⏳ Mohon tunggu *${cd.remainingSeconds} detik* sebelum mengirim usulan lagi.` };
        }
    }

    const raw = args.join(' ').trim();
    const parts = raw.split('>');
    const name = parts[0]?.trim();
    const contactsRaw = parts.slice(1).join('>').trim();

    if (!name || !contactsRaw) {
        const guide =
`❌ *Format Usulan Kos Salah*

Format:
\`!usulkost <Nama Kos> > <Kontak (IG / WA / TikTok)>\`

Contoh:
• \`!usulkost Kost Flamboyan > wa: 08123456789\`
• \`!usulkost Kost Anggrek Putri > ig: anggrekkos | wa: 082198765432\`
• \`!usulkost Rumah Sewa Ibu Ani > 085211223344\``;
        return { type: 'reply', text: guide };
    }

    const result = await submissionRepo.addKostSubmission({
        groupId: from,
        name,
        contactsRaw,
        submittedBy: senderNumber
    });

    if (!result.success) {
        return { type: 'reply', text: `⚠️ Gagal mengirim usulan: ${result.message}` };
    }

    const sub = result.submission;
    const confirmText =
`✅ *Usulan Kos Berhasil Terkirim!*

🏠 Nama: *${sub.name}*
📞 Kontak: ${sub.contactsRaw}
🆔 No Usulan: *#${sub.id}*

Terima kasih atas kontribusinya! Usulan ini akan diverifikasi oleh tim admin *@bukittinggikos* sebelum resmi dipublikasikan. 🙏`;

    const actions = [];
    if (group.parentGroupId) {
        const pengirimUrl = senderNumber ? (formatWhatsappUrl(senderNumber) || senderNumber) : 'unknown';
        const adminNotify =
`📥 *USULAN KOS BARU MASUK DARI WARGA!*

🆔 No Usulan: *#${sub.id}*
🏠 Nama Kos: *${sub.name}*
📞 Kontak: ${sub.contactsRaw}
👥 Dari Grup: *${group.name || 'Grup Komunitas'}*
👤 Pengirim: ${pengirimUrl}

Ketik \`!acc ${sub.id}\` untuk menyetujui & masukkan ke database.
Ketik \`!tolak ${sub.id}\` untuk menolak.`;

        actions.push({
            type: 'send_message',
            target: group.parentGroupId,
            text: adminNotify
        });
    }

    return {
        type: 'reply',
        text: confirmText,
        actions
    };
}

module.exports = {
    handleUsulkostCommand
};
