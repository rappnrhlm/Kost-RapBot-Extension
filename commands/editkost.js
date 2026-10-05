// Kost/commands/editkost.js - Handler for !editkost, !ubahkost, !updatekost, !kostedit
const kostRepo = require('../database/kostRepository');
const { parseContacts } = require('../utils/contactParser');
const { formatInstagramUrl, formatWhatsappUrl, formatTiktokUrl } = require('../utils/formatters');

async function handleEditKostCommand({ args, context }) {
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

    const raw = args.join(' ').trim();
    if (!raw) {
        const guide =
`❌ *Format Edit Kost:*
\`!editkost <ID> <Nama Baru> > <Kontak Baru>\`

_Contoh:_
• \`!editkost 16 Kost Al-Mubarak Baru > ig: @almubarak | wa: 08123456789\`
• \`!editkost KST-000016 Kost Mawar Indah > ig: @kostmawar\``;
        return { type: 'reply', text: guide };
    }

    const firstSpaceIdx = raw.indexOf(' ');
    if (firstSpaceIdx === -1) {
        return { type: 'reply', text: '❌ Masukkan nama dan kontak baru setelah ID kost.\n_Contoh:_ `!editkost 16 Kost Mawar > ig: mawar`' };
    }

    const targetId = raw.substring(0, firstSpaceIdx).trim();
    const restContent = raw.substring(firstSpaceIdx + 1).trim();

    const parts = restContent.split('>');
    const newName = parts[0]?.trim();
    const contactStr = parts.slice(1).join('>').trim();

    if (!newName) {
        return { type: 'reply', text: '❌ Nama kost baru wajib diisi.' };
    }

    const currentItem = await kostRepo.getKostById(targetId, from);
    if (!currentItem) {
        return { type: 'reply', text: `❌ Kost dengan ID "${targetId}" tidak ditemukan.` };
    }

    let parsedContacts = {
        instagram: currentItem.instagram,
        tiktok: currentItem.tiktok,
        whatsapp: currentItem.whatsapp
    };

    if (contactStr) {
        parsedContacts = parseContacts(contactStr);
    }

    const updateResult = await kostRepo.updateKost(currentItem.id, {
        name: newName,
        instagram: parsedContacts.instagram,
        tiktok: parsedContacts.tiktok,
        whatsapp: parsedContacts.whatsapp,
        updatedBy: senderNumber
    });

    if (!updateResult.success) {
        return { type: 'reply', text: `❌ ${updateResult.message}` };
    }

    const item = updateResult.data || currentItem;
    const succMsg =
`✅ *Data Kost Berhasil Diperbarui!*

🆔 *ID:* ${item.id}
🏠 *Nama:* ${item.name}
📸 *IG:* ${item.instagram ? formatInstagramUrl(item.instagram) : '-'}
💬 *WA:* ${item.whatsapp ? formatWhatsappUrl(item.whatsapp) : '-'}
🎵 *TikTok:* ${item.tiktok ? formatTiktokUrl(item.tiktok) : '-'}
📊 *Status:* ${String(item.status).toUpperCase()}`;

    return { type: 'reply', text: succMsg };
}

module.exports = {
    handleEditKostCommand
};
