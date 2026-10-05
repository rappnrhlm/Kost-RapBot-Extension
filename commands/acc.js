// Kost/commands/acc.js - Handler for !acc, !approvekost, !terimakost, !acckost, !terimausul, !setujuiusul
const kostRepo = require('../database/kostRepository');
const submissionRepo = require('../database/submissionRepository');
const { parseContacts } = require('../utils/contactParser');
const {
    formatInstagramUrl,
    formatWhatsappUrl,
    formatTiktokUrl,
    cleanWhatsappNumber
} = require('../utils/formatters');

async function handleAccCommand({ args, context }) {
    const from = context.from;
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
        return { type: 'reply', text: '❌ Perintah `!acc` hanya untuk grup internal admin.' };
    }

    const targetId = args[0]?.replace(/^#/, '').trim();
    if (!targetId || isNaN(Number(targetId))) {
        return { type: 'reply', text: '❌ Format salah.\nContoh: `!acc 1` atau `!acc #1`\n\n💡 Ketik `!listusul` untuk melihat ID usulan.' };
    }

    const sub = await submissionRepo.getKostSubmissionById(targetId);
    if (!sub) {
        return { type: 'reply', text: `❌ Usulan kos #${targetId} tidak ditemukan.` };
    }

    if (sub.status !== 'pending') {
        return { type: 'reply', text: `ℹ️ Usulan #${targetId} sudah diproses sebelumnya dengan status: *${sub.status.toUpperCase()}*.` };
    }

    const parsed = parseContacts(sub.contactsRaw);

    // 1. Add to main kost table
    const addResult = await kostRepo.addKost({
        name: sub.name,
        instagram: parsed.instagram,
        tiktok: parsed.tiktok,
        whatsapp: parsed.whatsapp,
        addedBy: sub.submittedBy ? `usul:${sub.submittedBy}` : 'warga',
        groupId: from
    });

    if (!addResult.success) {
        return { type: 'reply', text: `❌ Gagal memasukkan data kos: ${addResult.message}` };
    }

    // 2. Review submission to approved
    await submissionRepo.reviewKostSubmission(targetId, 'approved', senderNumber);

    const actions = [];
    let japriSent = false;

    if (sub.submittedBy && sub.submittedBy !== 'warga' && sub.submittedBy !== 'unknown') {
        const cleanNum = cleanWhatsappNumber(sub.submittedBy);
        if (cleanNum && cleanNum.length >= 9) {
            const submitterJid = cleanNum + '@s.whatsapp.net';
            const defaultTemplate = 
`Halo Kak, terima kasih banyak atas usulan data *${addResult.data.name}* yang Kakak kirimkan ke tim @bukittinggikos! 🙌

Usulan Kakak sudah kami verifikasi dan resmi disetujui masuk ke database bot WhatsApp kami dengan nomor ID: *${addResult.data.id}*.

Kontribusi Kakak sangat berarti bagi para pencari hunian di Bukittinggi. Semoga harimu menyenangkan! ✨`;

            actions.push({
                type: 'send_message',
                target: submitterJid,
                text: defaultTemplate
            });
            japriSent = true;
        }
    }

    let contactLines = [];
    if (addResult.data.instagram) contactLines.push(`   📸 IG: ${formatInstagramUrl(addResult.data.instagram)}`);
    if (addResult.data.whatsapp) contactLines.push(`   💬 WA: ${formatWhatsappUrl(addResult.data.whatsapp)}`);
    if (addResult.data.tiktok) contactLines.push(`   🎵 TT: ${formatTiktokUrl(addResult.data.tiktok)}`);

    const pengusulDisplay = sub.submittedBy ? (formatWhatsappUrl(sub.submittedBy) || sub.submittedBy) : 'unknown';
    const succMsg =
`✅ *Usulan #${targetId} Berhasil Disetujui!*

Data otomatis masuk ke database:
🆔 ID Kos Baru: *${addResult.data.id}*
🏠 Nama: *${addResult.data.name}*
${contactLines.join('\n')}
📌 Status: ⏳ PENDING
👤 Pengusul: ${pengusulDisplay}${japriSent ? '\n📩 *Notifikasi persetujuan telah otomatis dijapri ke pengusul!*' : ''}`;

    return {
        type: 'reply',
        text: succMsg,
        actions
    };
}

module.exports = {
    handleAccCommand
};
