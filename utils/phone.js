// Kost/utils/phone.js - Phone number normalization utility
function normalizePhoneNumber(input) {
    if (!input) return null;
    let clean = String(input).replace(/[^0-9]/g, '');
    if (!clean) return null;

    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
        clean = '628' + clean.slice(1);
    }

    if (clean.length < 9 || clean.length > 16) {
        return null;
    }

    return clean;
}

module.exports = {
    normalizePhoneNumber
};
