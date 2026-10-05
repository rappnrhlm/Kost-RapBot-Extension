// Kost/commands/delkost.js - Handler for !delkost, !hapuskost
const kostRepo = require('../database/kostRepository');

async function handleDeleteKostCommand({ args, context }) {
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
        return { type: 'reply', text: '❌ Perintah ini khusus untuk grup internal admin.' };
    }

    const targetId = args.join(' ').trim();
    if (!targetId) {
        const formatGuide =
`❌ Format: \`!delkost <ID>\`

Contoh:
• \`!delkost 12\`
• \`!delkost KST-000012\`

💡 Gunakan \`!cari <nama>\` untuk melihat ID kost.`;
        return { type: 'reply', text: formatGuide };
    }

    const result = await kostRepo.deleteKost(targetId, from);
    if (result.notFound) {
        return { type: 'reply', text: `❌ Kost dengan ID "${targetId}" tidak ditemukan.` };
    }
    if (!result.success) {
        return { type: 'reply', text: `❌ ${result.message}` };
    }

    const succMsg =
`✅ Kost berhasil dihapus.

🆔 ${result.data.id}
🏠 ${result.data.name}`;

    return { type: 'reply', text: succMsg };
}

module.exports = {
    handleDeleteKostCommand
};
