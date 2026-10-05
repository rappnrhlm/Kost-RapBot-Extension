// Kost/commands/router.js - Central command router for Kost extension
const kostHandler = require('./kost');
const dmHandler = require('./dm');
const sentHandler = require('./sent');
const postHandler = require('./post');
const editKostHandler = require('./editkost');
const delKostHandler = require('./delkost');
const usulkostHandler = require('./usulkost');
const listUsulHandler = require('./listusul');
const accHandler = require('./acc');
const tolakHandler = require('./tolak');
const delUsulHandler = require('./delusul');
const editUsulHandler = require('./editusul');

async function routeCommand({ command, args = [], context = {} }) {
    const rawCmd = String(command || '').trim().replace(/^!/, '').toLowerCase();

    switch (rawCmd) {
        // Kost, addkost, cari
        case 'kost':
        case 'listkost':
        case 'kos':
        case 'kostdm':
        case 'addkost':
        case 'cari':
        case 'carikost':
        case 'infokost':
            return await kostHandler.handleKostCommand({ command: rawCmd, args, context });

        // DM
        case 'dm':
        case 'dmpromosi':
        case 'dmkost':
            return await dmHandler.handleDmCommand({ command: rawCmd, args, context });

        // Sent / Unsent
        case 'sent':
        case 'kirim':
        case 'unsent':
        case 'pending':
            return await sentHandler.handleSentCommand({ command: rawCmd, args, context });

        // Post / Unpost
        case 'post':
        case 'tayang':
        case 'publikasikan':
        case 'unpost':
        case 'tarik':
            return await postHandler.handlePostCommand({ command: rawCmd, args, context });

        // Edit Kost
        case 'editkost':
        case 'ubahkost':
        case 'updatekost':
        case 'kostedit':
            return await editKostHandler.handleEditKostCommand({ command: rawCmd, args, context });

        // Delete Kost
        case 'delkost':
        case 'hapuskost':
            return await delKostHandler.handleDeleteKostCommand({ command: rawCmd, args, context });

        // Usul Kost
        case 'usulkost':
        case 'submitkost':
        case 'usul':
        case 'suggest':
        case 'daftarkost':
            return await usulkostHandler.handleUsulkostCommand({ command: rawCmd, args, context });

        // List Usul
        case 'listusul':
        case 'usulan':
        case 'daftarusul':
        case 'daftar-usul':
        case 'usulan-kost':
            return await listUsulHandler.handleListUsulCommand({ command: rawCmd, args, context });

        // Acc
        case 'acc':
        case 'approvekost':
        case 'terimakost':
        case 'acckost':
        case 'terimausul':
        case 'setujuiusul':
        case 'acc-usul':
            return await accHandler.handleAccCommand({ command: rawCmd, args, context });

        // Tolak
        case 'tolak':
        case 'tolakusul':
        case 'rejectusul':
        case 'tolak-usul':
        case 'rejectkost':
        case 'tolakkost':
            return await tolakHandler.handleTolakCommand({ command: rawCmd, args, context });

        // Delete Usul
        case 'delusul':
        case 'hapususul':
        case 'usuldel':
            return await delUsulHandler.handleDelUsulCommand({ command: rawCmd, args, context });

        // Edit Usul
        case 'editusul':
        case 'ubahusul':
        case 'updateusul':
        case 'usuledit':
            return await editUsulHandler.handleEditUsulCommand({ command: rawCmd, args, context });

        default:
            return {
                type: 'reply',
                text: `❓ Perintah "!${rawCmd}" tidak dikenali oleh Kost Extension.`
            };
    }
}

module.exports = {
    routeCommand
};
