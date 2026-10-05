// Kost/commands/delusul.js - Handler for !delusul, !hapususul
const submissionRepo = require('../database/submissionRepository');

async function handleDelUsulCommand({ args, context }) {
    const isGroup = context.isGroup;
    const isOwner = context.isOwner;
    const group = context.group || {};

    if (!isGroup && !isOwner) {
        return { type: 'reply', text: '❌ Command ini hanya bisa digunakan di dalam grup.' };
    }

    if (isGroup && !group.isInitialized) {
        return { type: 'reply', text: '❌ Grup ini belum diinisialisasi.' };
    }

    if (group.role === 'public') {
        return { type: 'reply', text: '❌ Perintah ini khusus untuk grup internal admin.' };
    }

    const targetId = args[0]?.trim().replace(/^#/, '');
    if (!targetId) {
        return { type: 'reply', text: '❌ Format: `!delusul <ID>`\n_Contoh:_ `!delusul 3`' };
    }

    const result = await submissionRepo.deleteKostSubmission(targetId);
    if (!result.success) {
        return { type: 'reply', text: `❌ ${result.message}` };
    }

    return {
        type: 'reply',
        text: `✅ Usulan #${targetId} berhasil dihapus dari sistem.`
    };
}

module.exports = {
    handleDelUsulCommand
};
