// ================================================================
// META CONVERSIONS API — Vercel Serverless Function
// Endpoint: POST /api/conversion-api
// Menerima event data dari browser, forward ke Meta Graph API
// ================================================================

const PIXEL_ID     = '1241100314677442';
const ACCESS_TOKEN = 'EAAcJZCFldLZAYBRNABpO45lJefZAXrVqL4QyVR2azERKMSIZBHKVyFJIUTDTowHzGJVpXnF0lWqwukEYWIsO2nqEYv6nAULArFb0ntqZCxiFpZCnbZAaXmy9O7ZBSv01QZBf2ex5mpnVXYnA08Np0IhZCGIofseNXVgg0WvMTwEsVPRyLQXPYWMTQRZBe53zJlTagZDZD';

module.exports = async function handler(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body;
        const {
            event_name,
            event_id,
            event_source_url,
            action_source,
            user_data,
            custom_data,
            test_event_code
        } = body;

        // Bina payload untuk Meta
        const payload = {
            data: [{
                event_name: event_name,
                event_time: Math.floor(Date.now() / 1000),
                event_source_url: event_source_url || undefined,
                action_source: action_source || 'website',
                user_data: {},
                custom_data: custom_data || {}
            }],
            access_token: ACCESS_TOKEN
        };

        // event_id — WAJIB untuk deduplication
        if (event_id) {
            payload.data[0].event_id = event_id;
        }

        // test_event_code — untuk testing di Events Manager
        if (test_event_code) {
            payload.data[0].test_event_code = test_event_code;
        }

        // User data — hanya masukkan field yang ada
        if (user_data) {
            const ud = {};
            if (user_data.em) ud.em = Array.isArray(user_data.em) ? user_data.em : [user_data.em];
            if (user_data.ph) ud.ph = Array.isArray(user_data.ph) ? user_data.ph : [user_data.ph];
            if (user_data.fn) ud.fn = Array.isArray(user_data.fn) ? user_data.fn : [user_data.fn];
            if (user_data.ln) ud.ln = Array.isArray(user_data.ln) ? user_data.ln : [user_data.ln];
            if (user_data.ct) ud.ct = Array.isArray(user_data.ct) ? user_data.ct : [user_data.ct];
            if (user_data.zp) ud.zp = Array.isArray(user_data.zp) ? user_data.zp : [user_data.zp];
            if (user_data.country) ud.country = Array.isArray(user_data.country) ? user_data.country : [user_data.country];
            if (user_data.fbc) ud.fbc = user_data.fbc;
            if (user_data.fbp) ud.fbp = user_data.fbp;
            if (user_data.external_id) ud.external_id = Array.isArray(user_data.external_id) ? user_data.external_id : [user_data.external_id];

            payload.data[0].user_data = ud;
        }

        // Hantar ke Meta Graph API
        const metaResponse = await fetch(
            `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        const result = await metaResponse.json();
        console.log('[CAPI] Meta response:', JSON.stringify(result));

        return res.status(200).json({
            success: true,
            events_received: result.events_received,
            fbtrace_id: result.fbtrace_id,
            debug: result
        });

    } catch (error) {
        console.error('[CAPI] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
