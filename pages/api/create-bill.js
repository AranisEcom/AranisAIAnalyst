// === NO IMPORTS NEEDED ===
// No library needed here.

export default async function handler(req, res) {
    try {
        console.log('=== API STARTED (No Library Mode) ===');

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const { name, email, phone, amount } = req.body;

        if (!name || !email || !phone || !amount) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        // ==========================================
        // === SUPABASE REST API (Manual Fetch) ===
        // ==========================================
        
        const supabaseUrl = 'https://ouijqobcjwmclrdmtfxf.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aWpxb2JjandtY2xyZG10ZnhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTA0MSwiZXhwIjoyMDgzMzc1MDQxfQ.PDa6vUYNtdUCdXD0a5ycKC6WfuqiYGfK4LcDSghvszw'; // Paste your FULL KEY HERE
        const tableName = 'orders';

        console.log('STEP 1: Inserting data via REST...');

        const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=representation' // Ask Supabase to return the inserted row
            },
            body: JSON.stringify({
                name: name,
                email: email,
                phone: phone,
                amount: parseFloat(amount),
                status: 'pending'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('!!! SUPABASE ERROR !!!', data);
            return res.status(500).json({ 
                success: false, 
                error: 'Database error',
                details: data 
            });
        }

        // Get the ID from the returned data (Supabase REST returns an array)
        const dbOrderId = data[0].id;
        console.log('SUCCESS: DB Order ID:', dbOrderId);

        // ==========================================
        // === TOYYIBPAY BILL (Same as before) ===
        // ==========================================
        const params = new URLSearchParams();
        params.append('userSecretKey', 'b2kcp05o-b5m0-q000-55i7-w3j57riufv7h');
        params.append('categoryCode', '2mk6qgyo');
        params.append('billName', 'ARANIS ECOM');
        params.append('billDescription', `Payment for ${name}`);
        params.append('billPriceSetting', '1');
        params.append('billPayorInfo', '1');
        params.append('billAmount', `${parseFloat(amount) * 100}`);
        params.append('billReturnUrl', 'https://aranis-aiadsanalyst.vercel.app/payment-succesful.html');
        params.append('billCallbackUrl', 'https://aranis-aiadsanalyst.vercel.app/api/payment-callback');
        params.append('billExternalReferenceNo', dbOrderId.toString());
        params.append('billTo', name);
        params.append('billEmail', email);
        params.append('billPhone', phone);
        params.append('billSplitPayment', '0');
        params.append('billPaymentChannel', '0');
        params.append('billChargeToCustomer', '1');
        params.append('billExpiryDays', '1');
        params.append('billContentEmail', 'Thank you.');

        const payResponse = await fetch('https://toyyibpay.com/index.php/api/createBill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const textResult = await payResponse.text();
        let result;
        
        try {
            result = JSON.parse(textResult);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid JSON from ToyyibPay', raw: textResult });
        }

        if (result && result[0] && result[0].BillCode) {
            return res.status(200).json({
                success: true,
                billCode: result[0].BillCode,
                billUrl: `https://toyyibpay.com/${result[0].BillCode}`
            });
        } else {
            return res.status(400).json({ success: false, error: 'ToyyibPay failed', details: result });
        }

    } catch (err) {
        console.error('!!! CRASH !!!', err);
        return res.status(500).json({ error: err.message });
    }
}
