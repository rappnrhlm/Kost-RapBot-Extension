// Kost/commands/kost.js - Handler for !kost, !addkost, !cari
const kostRepo = require('../database/kostRepository');
const { parseContacts } = require('../utils/contactParser');
const { checkCooldown } = require('../utils/cooldown');
const {
    getContactDisplayLines,
    getStatusBadge,
    formatInstagramUrl,
    formatWhatsappUrl,
    formatTiktokUrl,
    formatIndonesianDateTime
} = require('../utils/formatters');
const dmHandler = require('./dm');

async function handleKostCommand({ command, args, context }) {
    const from = context.from;
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};
    const senderNumber = context.senderNumber || '';
    const isPublicGroup = group.role === 'public';
    const isGroupAdmin = !isPublicGroup || isOwner;

    // 1. Must be used in group (or by owner in private)
    if (!isGroup && !isOwner) {
        return {
            type: 'reply',
            text: '❌ Command ini hanya bisa digunakan di dalam grup.'
        };
    }

    // 2. Check if group initialized
    if (isGroup && !group.isInitialized) {
        return {
            type: 'reply',
            text: '❌ Grup ini belum diinisialisasi.\n\nGunakan:\n`!initgroup <nama grup>`'
        };
    }

    const cleanCommand = String(command || '').replace(/^!/, '').toLowerCase();

    // ----------------------------------------------------
    // CASE A: !addkost <Nama Kost> > <kontak>
    // ----------------------------------------------------
    if (cleanCommand === 'addkost') {
        if (isPublicGroup) {
            return {
                type: 'reply',
                text: '❌ Perintah `!addkost` hanya untuk grup internal admin.\n\n💡 Ingin mengusulkan info kos baru? Gunakan:\n`!usulkost <Nama> > <Kontak>`'
            };
        }

        const raw = args.join(' ').trim();
        const parts = raw.split('>');
        const name = parts[0]?.trim();
        const contactStr = parts.slice(1).join('>').trim();

        if (!name || !contactStr) {
            return {
                type: 'reply',
                text: '❌ Format salah.\nContoh:\n• `!addkost Kost Mawar > kostmawar` (Instagram)\n• `!addkost Kost Mawar > wa: 08123456789` (WhatsApp)\n• `!addkost Kost Mawar > ig: mawar | wa: 08123456789 | tt: mawarkos`'
            };
        }

        const parsed = parseContacts(contactStr);
        const result = await kostRepo.addKost({
            name,
            instagram: parsed.instagram,
            tiktok: parsed.tiktok,
            whatsapp: parsed.whatsapp,
            addedBy: senderNumber || 'unknown',
            groupId: from
        });

        if (!result.success) {
            return {
                type: 'reply',
                text: `⚠️ ${result.message}`
            };
        }

        const contactDisplay = getContactDisplayLines(result.data, '');
        const succMsg =
`✅ Kost berhasil ditambahkan.

ID: ${result.data.id}
Nama: ${result.data.name}
${contactDisplay}
Status: 🟡 PROSPEK BARU (BELUM DI-DM)`;

        return {
            type: 'reply',
            text: succMsg
        };
    }

    // ----------------------------------------------------
    // CASE B: !cari <keyword>
    // ----------------------------------------------------
    if (cleanCommand === 'cari' || cleanCommand === 'carikost' || cleanCommand === 'infokost') {
        const query = args.join(' ').trim();
        if (!query) {
            return {
                type: 'reply',
                text: '❌ Masukkan kata kunci pencarian.\nContoh: `!cari mawar` atau `!cari birugo`'
            };
        }

        if (isPublicGroup) {
            const cdKey = `cari:${from}:${senderNumber || 'anon'}`;
            const cd = checkCooldown(cdKey, 10);
            if (!cd.allowed) {
                return {
                    type: 'reply',
                    text: `⏳ Mohon tunggu *${cd.remainingSeconds} detik* sebelum mencari lagi untuk mencegah spam.`
                };
            }
        }

        const results = isPublicGroup
            ? await kostRepo.searchKost(query, from, { status: 'published' })
            : await kostRepo.searchKost(query, from);

        if (!results || results.length === 0) {
            if (isPublicGroup) {
                return {
                    type: 'reply',
                    text: `🔎 Belum ada data kos yang dipublikasikan atau cocok dengan kata kunci "${query}".\n\n💡 Punya info kos? Usulkan via:\n\`!usulkost <Nama> > <Kontak>\``
                };
            }
            return {
                type: 'reply',
                text: `🔎 Tidak ditemukan kos dengan kata kunci "${query}".`
            };
        }

        if (isPublicGroup) {
            const maxRes = 5;
            const displayList = results.slice(0, maxRes);
            let text = `🔎 *HASIL PENCARIAN KOS*\nKata kunci: *${query}*\n\nDitemukan: ${results.length} kos${results.length > maxRes ? ` (menampilkan ${maxRes} teratas)` : ''}\n\n`;
            displayList.forEach((k, idx) => {
                const contacts = getContactDisplayLines(k, '   ');
                text += `${idx + 1}. *${k.name}*\n${contacts}\n\n`;
            });
            text += `────────────────────\n📱 Official Instagram: *@bukittinggikos*\n💡 Punya info kos baru? Usulkan via:\n\`!usulkost <Nama> > <Kontak>\``;
            return { type: 'reply', text: text.trim() };
        }

        let text = `🔎 *HASIL PENCARIAN (ADMIN)*\nKata kunci: ${query}\n\nDitemukan: ${results.length}\n\n`;
        results.forEach((k, idx) => {
            const statusBadge = getStatusBadge(k.status);
            const contacts = getContactDisplayLines(k, '   ');
            text += `${idx + 1}. *${k.name}*\n   🆔 ${k.id}\n${contacts}\n   📌 Status: ${statusBadge}\n\n`;
        });
        text += `────────────────────\n\n💡 Gunakan:\n\`!kost lengkap <ID>\`\n\`!post <ID>\` (tayangkan ke publik)\n\`!sent <ID>\` (tandai sudah di-DM)\n\`!delkost <ID>\``;
        return { type: 'reply', text: text.trim() };
    }

    // ----------------------------------------------------
    // CASE C: !kost lengkap <ID>
    // ----------------------------------------------------
    if (args[0]?.toLowerCase() === 'lengkap') {
        const targetId = args.slice(1).join(' ').trim();
        if (!targetId) {
            return {
                type: 'reply',
                text: '❌ Format: `!kost lengkap <ID>`\n\nContoh:\n• `!kost lengkap 12`\n• `!kost lengkap KST-000012`\n\n💡 Gunakan `!cari <nama>` untuk melihat ID kost.'
            };
        }

        const kost = await kostRepo.getKostById(targetId, from);
        const isPublished = (kost?.status || '').toLowerCase() === 'published' || (kost?.status || '').toLowerCase() === 'posted';

        if (!kost || (isPublicGroup && !isPublished)) {
            return {
                type: 'reply',
                text: `❌ Kost dengan ID "${targetId}" tidak ditemukan atau belum dipublikasikan.`
            };
        }

        const igUrl = kost.instagram ? formatInstagramUrl(kost.instagram) : '-';
        const waUrl = kost.whatsapp ? formatWhatsappUrl(kost.whatsapp) : '-';
        const ttUrl = kost.tiktok ? formatTiktokUrl(kost.tiktok) : '-';

        if (isPublicGroup) {
            const publicDetail =
`🏠 *DETAIL KOST*

🏠 Nama: *${kost.name}*
📸 Instagram: ${igUrl}
💬 WhatsApp: ${waUrl}
🎵 TikTok: ${ttUrl}

────────────────────
📱 Official Instagram: *@bukittinggikos*`;
            return { type: 'reply', text: publicDetail };
        }

        const groupName = group.name || 'Bukittinggi Kos';
        const statusBadge = getStatusBadge(kost.status);
        const sentByDisplay = kost.sentBy ? kost.sentBy : '-';
        const sentAtDisplay = kost.sentAt ? formatIndonesianDateTime(kost.sentAt) : '-';

        const detailText =
`🏠 *DETAIL KOST (ADMIN VIEW)*

🆔 ID: ${kost.id}
🏠 Nama: ${kost.name}
📸 Instagram: ${igUrl}
💬 WhatsApp: ${waUrl}
🎵 TikTok: ${ttUrl}
📌 Status: ${statusBadge}
👤 Ditandai Oleh: ${sentByDisplay}
🕒 Waktu Update: ${sentAtDisplay}
👥 Grup: ${groupName}`;

        return { type: 'reply', text: detailText };
    }

    // ----------------------------------------------------
    // CASE D: Public Group List
    // ----------------------------------------------------
    if (isPublicGroup) {
        const publishedList = await kostRepo.getKostByStatus('published', from);
        if (!publishedList.length) {
            return {
                type: 'reply',
                text: '📋 Belum ada data kos yang dipublikasikan saat ini.\n\n💡 Punya info kos baru? Usulkan via:\n`!usulkost <Nama> > <Kontak>`'
            };
        }

        let text = `🏠 *DAFTAR KOS TERSEDIA*\nTotal: ${publishedList.length} kos\n\n`;
        publishedList.forEach((k, idx) => {
            const contacts = getContactDisplayLines(k, '   ');
            text += `${idx + 1}. *${k.name}*\n${contacts}\n\n`;
        });

        text += `────────────────────\n📱 Official Instagram: *@bukittinggikos*\n💡 Cari kos spesifik? Gunakan: \`!cari <nama/lokasi>\`\n💡 Usulkan kos baru: \`!usulkost <Nama> > <Kontak>\``;
        return { type: 'reply', text: text.trim() };
    }

    // ----------------------------------------------------
    // CASE E: !kost dm / !listkost / !kostdm
    // ----------------------------------------------------
    const isDmMode = cleanCommand === 'listkost' || cleanCommand === 'kostdm' ||
                     ['dm', 'ringkas', 'simple', 'link'].includes(args[0]?.toLowerCase());

    if (isDmMode) {
        const possibleId = ['dm', 'ringkas', 'simple', 'link'].includes(args[0]?.toLowerCase())
            ? args.slice(1).join(' ').trim()
            : args.join(' ').trim();

        if (possibleId && !['all', 'sent', 'pending', 'published', 'posted'].includes(possibleId.toLowerCase())) {
            return await dmHandler.handleDmCommand({ command: 'dm', args: [possibleId], context });
        }

        let filterStatus = 'pending';
        if (['dm', 'ringkas', 'simple', 'link'].includes(args[0]?.toLowerCase())) {
            if (['all', 'sent', 'pending', 'published', 'posted'].includes(args[1]?.toLowerCase())) {
                filterStatus = args[1].toLowerCase();
            }
        } else if (['all', 'sent', 'pending', 'published', 'posted'].includes(args[0]?.toLowerCase())) {
            filterStatus = args[0].toLowerCase();
        }

        const list = await kostRepo.getKostByStatus(filterStatus, from);
        if (!list.length) {
            return {
                type: 'reply',
                text: `📋 Tidak ada data kost dengan status *${filterStatus.toUpperCase()}*.`
            };
        }

        let text = `📋 *DAFTAR KOST ${filterStatus.toUpperCase()} (LINK DM)*\nTotal: ${list.length}\n\n`;
        list.forEach((k, idx) => {
            let contactLines = [];
            if (k.instagram) contactLines.push(`   📸 IG: ${formatInstagramUrl(k.instagram)}`);
            if (k.whatsapp) contactLines.push(`   💬 WA: ${formatWhatsappUrl(k.whatsapp)}`);
            if (k.tiktok) contactLines.push(`   🎵 TT: ${formatTiktokUrl(k.tiktok)}`);
            if (contactLines.length === 0) contactLines.push('   ℹ️ -');

            text += `${idx + 1}. *${k.name}* (\`${k.id}\`)\n${contactLines.join('\n')}\n\n`;
        });

        text += `────────────────────\n💡 *Trik Cepat DM & Posting:*\n• Ketik \`!dm <ID>\` untuk teks pesan ajakan promosi siap kirim.\n• Setelah selesai di-DM, tandai sent:\n\`!sent <ID>\`\n• Jika sudah deal & posting di feed/story:\n\`!post <ID>\``;
        return { type: 'reply', text: text.trim() };
    }

    // ----------------------------------------------------
    // CASE F: Admin List !kost [all|pending|sent|published]
    // ----------------------------------------------------
    const sub = args[0]?.toLowerCase() || 'pending';
    let filter = 'pending';
    if (['all', 'sent', 'pending', 'published', 'posted'].includes(sub)) {
        filter = sub;
    }

    const list = await kostRepo.getKostByStatus(filter, from);
    if (!list.length) {
        return {
            type: 'reply',
            text: `📋 Tidak ada data kost dengan status *${filter.toUpperCase()}*.`
        };
    }

    const groupAlias = group.name ? group.name.toUpperCase() : 'BUKITTINGGI KOS';
    let text = `🏠 *DAFTAR KOST ${groupAlias}* (${filter.toUpperCase()})\nTotal: ${list.length}\n\n`;

    list.forEach((k, idx) => {
        const statusBadge = getStatusBadge(k.status);
        const contacts = getContactDisplayLines(k, '   ');
        text += `${idx + 1}. *${k.name}*\n   🆔 ${k.id}\n${contacts}\n   📌 Status: ${statusBadge}\n\n`;
    });

    text +=
`────────────────────

💡 *PERINTAH TERSEDIA*

\`!kost dm\`
\`!kost all\`
\`!kost pending\`
\`!kost sent\`
\`!kost published\`
\`!kost lengkap <ID>\`
\`!post <ID>\` (tayangkan ke publik)
\`!sent <ID>\` (tandai sudah di-DM)
\`!addkost <Nama> > <kontak (ig/wa/tt)>\`
\`!cari <kata kunci>\`
\`!delkost <ID>\``;

    return { type: 'reply', text: text.trim() };
}

module.exports = {
    handleKostCommand
};
