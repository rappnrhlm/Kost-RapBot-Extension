// Kost/utils/contactParser.js - Parser for multi-format contact inputs
function parseContacts(rawContacts) {
    if (!rawContacts) return { instagram: null, tiktok: null, whatsapp: null };

    const contacts = {
        instagram: null,
        tiktok: null,
        whatsapp: null
    };

    const tokens = String(rawContacts).split(/[,|]+/).map(t => t.trim()).filter(Boolean);

    for (const token of tokens) {
        const lower = token.toLowerCase();

        if (/^(ig|instagram)\s*[:=]\s*/i.test(token)) {
            contacts.instagram = token.replace(/^(ig|instagram)\s*[:=]\s*/i, '').trim();
        } else if (/^(wa|whatsapp|no|telp|hp)\s*[:=]\s*/i.test(token)) {
            contacts.whatsapp = token.replace(/^(wa|whatsapp|no|telp|hp)\s*[:=]\s*/i, '').trim();
        } else if (/^(tt|tiktok)\s*[:=]\s*/i.test(token)) {
            contacts.tiktok = token.replace(/^(tt|tiktok)\s*[:=]\s*/i, '').trim();
        } else if (lower.includes('instagram.com/')) {
            contacts.instagram = token;
        } else if (lower.includes('tiktok.com/')) {
            contacts.tiktok = token;
        } else if (lower.includes('wa.me/') || lower.includes('api.whatsapp.com/')) {
            contacts.whatsapp = token;
        } else if (/^(\+?62|08)[0-9\s\-]{7,15}$/.test(token.replace(/\s+/g, ''))) {
            contacts.whatsapp = token;
        } else {
            if (!contacts.instagram) {
                contacts.instagram = token;
            } else if (!contacts.tiktok) {
                contacts.tiktok = token;
            } else if (!contacts.whatsapp) {
                contacts.whatsapp = token;
            }
        }
    }

    return contacts;
}

module.exports = {
    parseContacts
};
