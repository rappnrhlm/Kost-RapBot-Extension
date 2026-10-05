// Kost/commands/dm.js - Handler for !dm, !dmpromosi, !dmkost
const kostRepo = require('../database/kostRepository');
const {
    normalizeKostId,
    formatInstagramUrl,
    formatWhatsappUrl,
    formatTiktokUrl
} = require('../utils/formatters');
const { generateDmText } = require('../utils/dmTemplate');

async function handleDmCommand({ args, context }) {
    const from = context.from;
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
        return { type: 'reply', text: '❌ Perintah `!dm` hanya untuk grup internal admin.' };
    }

    const rawInput = args.join(' ').trim();
    if (!rawInput) {
        const formatGuide =
`❌ *Format Perintah DM*

Gunakan:
\`!dm <ID Kost>\`

Contoh:
• \`!dm 1\` atau \`!dm KST-000001\`
• \`!dm 12\` atau \`!dm kst 12\`

💡 *Tips:* Bot akan mengirim 2 balon chat. Balon kedua berisi teks template yang bisa langsung kamu tahan (long-press) dan salin ke Instagram!`;
        return { type: 'reply', text: formatGuide };
    }

    const normalizedId = normalizeKostId(rawInput);
    const kost = await kostRepo.getKostById(normalizedId || rawInput, from);

    if (!kost) {
        return {
            type: 'reply',
            text: `❌ Kost dengan ID "${rawInput}" (${normalizedId || rawInput}) tidak ditemukan di database.`
        };
    }

    const igUrl = kost.instagram ? formatInstagramUrl(kost.instagram) : '-';
    const ttUrl = kost.tiktok ? formatTiktokUrl(kost.tiktok) : '-';
    const waDisplay = kost.whatsapp ? formatWhatsappUrl(kost.whatsapp) : '-';
    const statusBadge = (kost.status || 'pending').toLowerCase() === 'sent' ? '✅ SUDAH DI-DM (SENT)' : '⏳ BELUM DI-DM (PENDING)';

    const cardText =
`🏠 *SIAP DM KOST: ${kost.name}*

🆔 ID: \`${kost.id}\`
📌 Status: ${statusBadge}
📸 Instagram: ${igUrl}
💬 WhatsApp: ${waDisplay}
🎵 TikTok: ${ttUrl}

────────────────────
👇 *Teks template promosi ada di balon chat terpisah di bawah.*
Tinggal *tahan (long press)* balon chat di bawah ➡️ Salin ➡️ Paste di DM IG/WA/TikTok!

Setelah selesai di-DM, tandai dengan:
\`!sent ${kost.id}\``;

    const personalizedTemplate = generateDmText(kost.name);

    return {
        type: 'reply',
        text: cardText,
        actions: [
            {
                type: 'send_message',
                target: from,
                text: personalizedTemplate
            }
        ]
    };
}

module.exports = {
    handleDmCommand
};
