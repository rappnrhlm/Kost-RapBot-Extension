// Kost/commands/post.js - Handler for !post, !unpost, !tayang, !tarik, !publikasikan
const kostRepo = require('../database/kostRepository');
const { parseKostIdTargets, formatIndonesianDateTime, cleanWhatsappNumber } = require('../utils/formatters');

async function handlePostCommand({ command, args, context }) {
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
        return { type: 'reply', text: '❌ Perintah ini khusus untuk grup internal admin.' };
    }

    const cleanCommand = String(command || '').replace(/^!/, '').toLowerCase();
    const isUnpost = cleanCommand === 'unpost' || cleanCommand === 'tarik';

    const rawInput = args.join(' ').trim();
    if (!rawInput) {
        const formatGuide =
`❌ Format salah.

💡 *Contoh Penggunaan:*
• Tayangkan kos: \`!post KST-000001\` atau \`!post 1\`
• Tarik dari publik: \`!unpost KST-000001\` atau \`!unpost 1\`

💡 Gunakan \`!kost [sent|pending]\` untuk melihat daftar kos yang siap diposting.`;
        return { type: 'reply', text: formatGuide };
    }

    const parsed = parseKostIdTargets(rawInput);
    if (!parsed.ids || parsed.ids.length === 0) {
        return { type: 'reply', text: '❌ Format ID tidak valid.\nContoh: `!post KST-000001` atau `!post 1`' };
    }

    const targetId = parsed.ids[0];

    if (isUnpost) {
        const updateRes = await kostRepo.updateKost(targetId, { status: 'sent', updatedBy: senderNumber });
        if (!updateRes.success) {
            return { type: 'reply', text: `❌ ${updateRes.message || 'Gagal mengubah status.'}` };
        }

        const succMsg =
`↩️ *KOST BERHASIL DITARIK DARI PUBLIK (UNPOST)*

🆔 ${updateRes.data.id}
🏠 ${updateRes.data.name}
📌 Status: 📩 TERKIRIM PENAWARAN (Hanya Admin)
💡 Kos ini tidak akan muncul lagi di pencarian publik \`!cari\`.`;
        return { type: 'reply', text: succMsg };
    }

    // Normal POST / TAYANG
    const result = await kostRepo.markKostPublished(targetId, from, senderNumber);
    if (result.notFound) {
        return { type: 'reply', text: `❌ Kost dengan ID "${targetId}" tidak ditemukan.` };
    }
    if (result.alreadyPublished) {
        const idLabel = result.data?.id || targetId;
        return { type: 'reply', text: `ℹ️ Kost ${idLabel} (*${result.data?.name || ''}*) sudah berstatus TAYANG / SUDAH DIPOSTING sebelumnya.` };
    }
    if (!result.success) {
        return { type: 'reply', text: `❌ ${result.message}` };
    }

    const kost = result.data;
    const actions = [];
    let japriSentNote = false;

    if (kost.whatsapp) {
        const cleanNum = cleanWhatsappNumber(kost.whatsapp);
        if (cleanNum && cleanNum.length >= 9) {
            const targetJid = cleanNum + '@s.whatsapp.net';
            const confirmMsg =
`Halo Kak dari tim @bukittinggikos! 🎉

Kabar baik, informasi seputar *${kost.name}* sudah resmi dipublikasikan di database & media sosial kami:
🆔 ID Listing: *${kost.id}*
📱 Akun Instagram dan Tiktok Resmi: *@bukittinggikos*

Kini pencari kos dapat menemukan info *${kost.name}* secara otomatis via pencarian bot WhatsApp "!cari ${kost.name}".

Semoga lekas penuh kamarnya ya Kak! Terima kasih banyak atas kerjasamanya. 🙏`;

            actions.push({
                type: 'send_message',
                target: targetJid,
                text: confirmMsg
            });
            japriSentNote = true;
        }
    }

    const succMsg =
`🟢 *KOST BERHASIL DIPOSTING / DITAYANGKAN!*

🆔 ${kost.id}
🏠 ${kost.name}
📌 Status: 🟢 SUDAH DIPOSTING (PUBLIK)
👤 Diposting oleh: ${senderNumber}
🕒 Waktu: ${formatIndonesianDateTime(new Date())}

✨ Kos ini sekarang *resmi aktif* dan dapat dicari oleh seluruh warga grup melalui \`!cari ${kost.name}\`.${japriSentNote ? '\n\n📩 *Notifikasi Konfirmasi Tayang telah otomatis dijapri ke pemilik kos!*' : ''}`;

    return {
        type: 'reply',
        text: succMsg,
        actions
    };
}

module.exports = {
    handlePostCommand
};
