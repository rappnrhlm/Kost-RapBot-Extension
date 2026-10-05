// Kost/web/apiRouter.js - REST API router for Kost standalone service
const kostRepo = require('../database/kostRepository');
const submissionRepo = require('../database/submissionRepository');

async function handleApiRequest(req, res, urlObj, body) {
    const pathname = urlObj.pathname;
    const method = req.method;
    const query = Object.fromEntries(urlObj.searchParams.entries());

    // GET /api/kost
    if (method === 'GET' && pathname === '/api/kost') {
        const { status, query: q, search, groupId } = query;
        const searchQuery = (q || search || '').trim();
        let list = [];

        if (searchQuery) {
            list = await kostRepo.searchKost(searchQuery, groupId || null, { status: status && status !== 'all' ? status : null });
        } else if (status && status !== 'all') {
            list = await kostRepo.getKostByStatus(status, groupId || null);
        } else {
            list = await kostRepo.getKostList(groupId || null);
        }

        const stats = await kostRepo.getKostStats(groupId || null);
        res.writeHead(200);
        return res.end(JSON.stringify({
            success: true,
            stats,
            total: list.length,
            data: list,
            kost: list
        }));
    }

    // GET /api/kost/:id
    const singleKostMatch = pathname.match(/^\/api\/kost\/([A-Za-z0-9-_]+)$/);
    if (method === 'GET' && singleKostMatch) {
        const id = singleKostMatch[1];
        const item = await kostRepo.getKostById(id, query.groupId || null);
        if (!item) {
            res.writeHead(404);
            return res.end(JSON.stringify({ success: false, message: 'Kost tidak ditemukan.' }));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: item, kost: item }));
    }

    // POST /api/kost
    if (method === 'POST' && pathname === '/api/kost') {
        const payload = JSON.parse(body || '{}');
        const result = await kostRepo.addKost(payload);
        res.writeHead(result.success ? 201 : 400);
        return res.end(JSON.stringify(result));
    }

    // PUT /api/kost/:id
    if (method === 'PUT' && singleKostMatch) {
        const id = singleKostMatch[1];
        const payload = JSON.parse(body || '{}');
        const result = await kostRepo.updateKost(id, payload);
        res.writeHead(result.success ? 200 : 400);
        return res.end(JSON.stringify(result));
    }

    // DELETE /api/kost/:id
    if (method === 'DELETE' && singleKostMatch) {
        const id = singleKostMatch[1];
        const result = await kostRepo.deleteKost(id, query.groupId || null);
        res.writeHead(result.success ? 200 : 400);
        return res.end(JSON.stringify(result));
    }

    // GET /api/submissions
    if (method === 'GET' && pathname === '/api/submissions') {
        const list = await submissionRepo.getKostSubmissions({
            groupId: query.groupId || null,
            status: query.status || 'all'
        });
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, total: list.length, data: list }));
    }

    // POST /api/submissions/:id/review
    const reviewMatch = pathname.match(/^\/api\/submissions\/(\d+)\/review$/);
    if (method === 'POST' && reviewMatch) {
        const id = reviewMatch[1];
        const payload = JSON.parse(body || '{}');
        const action = payload.action === 'approve' || payload.action === 'approved' ? 'approved' : 'rejected';
        const result = await submissionRepo.reviewKostSubmission(id, action, 'web-admin');

        if (result.success && action === 'approved' && result.submission && payload.autoAddKost !== false) {
            const sub = result.submission;
            const contacts = require('../utils/contactParser').parseContacts(sub.contactsRaw);
            await kostRepo.addKost({
                name: sub.name,
                instagram: contacts.instagram,
                whatsapp: contacts.whatsapp,
                tiktok: contacts.tiktok,
                groupId: sub.groupId,
                addedBy: `usul:${sub.submittedBy || 'warga'}`
            });
        }

        res.writeHead(result.success ? 200 : 400);
        return res.end(JSON.stringify(result));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Not Found' }));
}

module.exports = {
    handleApiRequest
};
