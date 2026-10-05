// Kost/commands/sent.js - Handler for !sent, !unsent, !pending
const kostRepo = require('../database/kostRepository');
const { parseKostIdTargets, formatIndonesianDateTime } = require('../utils/formatters');

async function handleSentCommand({ command, args, context }) {
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
    const isUnsent = cleanCommand === 'unsent' || cleanCommand === 'pending';

    const rawInput = args.join(' ').trim();
    if (!rawInput) {
        const formatGuide = isUnsent ?
`❌ Format salah.

💡 *Contoh Penggunaan Unsent / Pending:*
• Kembalikan status: \`!unsent KST-000001\` atau \`!pending 1\`
• Beberapa ID: \`!unsent 1, 3, 5\``
        :
`❌ Format salah.

💡 *Contoh Penggunaan:*
• Satu ID: \`!sent KST-000001\` atau \`!sent 1\`
• Range (sampai): \`!sent KST-000002 sampai KST-000020\`
• Range ringkas: \`!sent 2 - 20\` atau \`!sent 2 sampai 20\`
• Beberapa ID: \`!sent 1, 3, 5\` atau \`!sent KST-1, KST-3\`

💡 Gunakan \`!kost pending\` untuk melihat daftar kost yang belum di-DM.`;
        return { type: 'reply', text: formatGuide };
    }

    const parsed = parseKostIdTargets(rawInput);
    if (!parsed.ids || parsed.ids.length === 0) {
        return { type: 'reply', text: '❌ Format ID atau range tidak valid.\n\nContoh:\n• `!sent KST-000002 sampai KST-000020`\n• `!sent 2 - 20`\n• `!sent KST-000001`' };
    }

    // Case A: Single ID
    if (parsed.ids.length === 1) {
        const targetId = parsed.ids[0];

        if (isUnsent) {
            const result = await kostRepo.setKostStatus(targetId, 'pending', senderNumber, from);
            if (result.notFound) {
                return { type: 'reply', text: `❌ Kost dengan ID ${targetId} tidak ditemukan.` };
            }
            if (!result.success) {
                return { type: 'reply', text: `❌ ${result.message}` };
            }
            const succMsg =
`↩️ *KOST DIKEMBALIKAN KE STATUS PENDING*

🆔 ${result.data.id}
🏠 ${result.data.name}
📌 Status: 🟡 BELUM DITAWARKAN (PENDING)
👤 Diubah oleh: ${senderNumber}`;
            return { type: 'reply', text: succMsg };
        }

        const result = await kostRepo.markKostSent(targetId, from, senderNumber);
        if (result.notFound) {
            return { type: 'reply', text: `❌ Kost dengan ID ${targetId} tidak ditemukan.` };
        }
        if (result.alreadySent) {
            const idLabel = result.data?.id || targetId;
            return { type: 'reply', text: `ℹ️ Kost ${idLabel} (*${result.data?.name || ''}*) sudah berstatus SENT sebelumnya.` };
        }
        if (!result.success) {
            return { type: 'reply', text: `❌ ${result.message}` };
        }

        const kost = result.data;
        const sentAtFormatted = formatIndonesianDateTime(kost.sentAt);
        const succMsg =
`✅ *KOST BERHASIL DITANDAI SENT*

🆔 ${kost.id}
🏠 ${kost.name}
📌 Status: 📩 SENT (TERKIRIM DM)
👤 Sent By: ${kost.sentBy || senderNumber}
🕒 Sent At: ${sentAtFormatted}`;

        return { type: 'reply', text: succMsg };
    }

    // Case B: Batch / Range (multiple IDs)
    if (isUnsent) {
        const result = await kostRepo.setKostBatchStatus(parsed.ids, 'pending', senderNumber, from);
        if (!result.success) {
            return { type: 'reply', text: `❌ ${result.message}` };
        }

        let responseText = `↩️ *SELESAI MENGEMBALIKAN KOST KE PENDING (BATCH)*\n\n`;
        responseText += `📊 *Ringkasan:* (${result.total} ID diproses)\n`;
        responseText += `• ✅ Berhasil dikembalikan ke PENDING: *${result.updated.length} kost*\n`;
        responseText += `• ℹ️ Sudah PENDING sebelumnya: *${result.alreadyInStatus.length} kost*\n`;
        if (result.notFound.length > 0) {
            responseText += `• ⚠️ Tidak ditemukan: *${result.notFound.length} ID*\n`;
        }
        responseText += `\n`;

        if (result.updated.length > 0) {
            responseText += `📝 *Daftar Yang Berhasil Diubah ke PENDING:*\n`;
            const displayLimit = 20;
            result.updated.slice(0, displayLimit).forEach((k, idx) => {
                responseText += `${idx + 1}. [${k.id}] *${k.name}*\n`;
            });
            if (result.updated.length > displayLimit) {
                responseText += `...dan ${result.updated.length - displayLimit} kost lainnya.\n`;
            }
            responseText += `\n`;
        }

        responseText += `👤 Diubah oleh: ${senderNumber}`;
        return { type: 'reply', text: responseText.trim() };
    }

    const result = await kostRepo.markKostBatchSent(parsed.ids, from, senderNumber);
    if (!result.success) {
        return { type: 'reply', text: `❌ ${result.message}` };
    }

    let responseText = `✅ *SELESAI MENANDAI KOST (BATCH)*\n\n`;
    responseText += `📊 *Ringkasan:* (${result.total} ID diproses)\n`;
    responseText += `• ✅ Berhasil diubah: *${result.updated.length} kost*\n`;
    responseText += `• ℹ️ Sudah SENT sebelumnya: *${result.alreadySent.length} kost*\n`;
    if (result.notFound.length > 0) {
        responseText += `• ⚠️ Tidak ditemukan: *${result.notFound.length} ID*\n`;
    }
    responseText += `\n`;

    if (result.updated.length > 0) {
        responseText += `📝 *Daftar Yang Berhasil Diubah ke SENT:*\n`;
        const displayLimit = 20;
        result.updated.slice(0, displayLimit).forEach((k, idx) => {
            responseText += `${idx + 1}. [${k.id}] *${k.name}*\n`;
        });
        if (result.updated.length > displayLimit) {
            responseText += `...dan ${result.updated.length - displayLimit} kost lainnya.\n`;
        }
        responseText += `\n`;
    }

    responseText += `👤 Ditandai oleh: ${senderNumber}`;
    return { type: 'reply', text: responseText.trim() };
}

module.exports = {
    handleSentCommand
};
