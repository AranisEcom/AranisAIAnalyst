// ==========================================
// File: /api/create-bill.js
// ==========================================
// This file ONLY handles the ToyyibPay API request.
// The Frontend (checkout.html) handles saving
// customer data to Google Sheets FIRST, then
// calls this endpoint with the generated Order ID.
// ==========================================

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method Not Allowed' 
        });
    }

    try {
        const now = new Date();
        console.log('=== Backend: Creating ToyyibPay Bill ===');
        console.log('Time:', now.toISOString());
        console.log('Request Body:', JSON.stringify(req.body, null, 2));

        // --------------------------------------------------
        // Field names must match what checkout.html sends:
        // { id, name, email, phone, amount, billDescription }
        // --------------------------------------------------
        const { id, name, email, phone, amount, billDescription } = req.body;

        // Validate required fields
        if (!id || !name || !email || !phone || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: id, name, email, phone, amount' 
            });
        }

        // ==========================================
        // TOYYIBPAY CONFIGURATION
        // ==========================================
        const categoryCode  = '2mk6qgyo';
        const userSecretKey = 'b2kcp05o-b5m0-q000-55i7-w3j57riufv7h';
        const billName      = 'ARANIS ECOM';

        // Convert RM to cents (RM 35.90 = 3590)
        const billAmount = `${Math.round(parseFloat(amount) * 100)}`;

        // URLs — make sure these match your Vercel deployment
        const billReturnUrl   = 'https://aranis-aiadsanalyst.vercel.app/payment-successful.html';
        const billCallbackUrl = 'https://aranis-aiadsanalyst.vercel.app/api/payment-callback';

        // Use the Order ID from Google Sheets as reference
        // This links the ToyyibPay payment to the correct row
        const billExternalReferenceNo = id.toString();

        // ==========================================
        // BUILD FORM DATA (use FormData — proven stable)
        // ==========================================
        const body = new FormData();
        body.append('userSecretKey',            userSecretKey);
        body.append('categoryCode',             categoryCode);
        body.append('billName',                 billName);
        body.append('billDescription',          billDescription || `Pembelian ARANIS - RM${amount}`);
        body.append('billPriceSetting',         '1');
        body.append('billPayorInfo',            '1');
        body.append('billAmount',               billAmount);
        body.append('billReturnUrl',            billReturnUrl);
        body.append('billCallbackUrl',          billCallbackUrl);
        body.append('billExternalReferenceNo',  billExternalReferenceNo);
        body.append('billTo',                   name);
        body.append('billEmail',                email);
        body.append('billPhone',                phone);
        body.append('billSplitPayment',         '0');
        body.append('billSplitPaymentArgs',     '');
        body.append('billPaymentChannel',       '0');
        body.append('billChargeToCustomer',     '1');
        body.append('billExpiryDays',           '1');
        body.append('billContentEmail',         'Terima kasih atas pembayaran anda. Prompt AI anda sedia untuk dimuat turun. Sila semak e-mel anda.');

        // Log what's being sent (hide secret key)
        const logData = {};
        for (const [key, value] of body.entries()) {
            logData[key] = key === 'userSecretKey' ? '***HIDDEN***' : value;
        }
        console.log('Sending to ToyyibPay:', JSON.stringify(logData, null, 2));

        // ==========================================
        // CALL TOYYIBPAY API
        // ==========================================
        const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
            method: 'POST',
            body: body, // No Content-Type header needed — browser sets multipart/form-data automatically
        });

        const textResult = await response.text();
        console.log('ToyyibPay Status:', response.status);
        console.log('ToyyibPay Raw:', textResult);

        // ==========================================
        // PARSE RESPONSE
        // ==========================================
        let result;
        try {
            result = JSON.parse(textResult);
        } catch (e) {
            console.error('Failed to parse ToyyibPay response:', e);

            // Check for FPX maintenance message
            if (textResult.toLowerCase().includes('fpx') && 
                textResult.toLowerCase().includes('maintenance')) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'FPX_MAINTENANCE',
                    message: 'Online Transfer FPX sedang maintenance. Sila cuba sebentar lagi.'
                });
            }

            return res.status(500).json({ 
                success: false, 
                error: 'Invalid response from payment provider.',
                details: textResult
            });
        }

        // ==========================================
        // CHECK SUCCESS
        // ==========================================
        if (result && Array.isArray(result) && result.length > 0 && result[0].BillCode) {
            const billCode = result[0].BillCode;
            const billUrl  = `https://toyyibpay.com/${billCode}`;

            console.log('Bill created successfully!');
            console.log('Bill Code:', billCode);
            console.log('Reference No:', billExternalReferenceNo);

            return res.status(200).json({ 
                success:                true,
                billCode:               billCode,
                billUrl:                billUrl,
                billExternalReferenceNo: billExternalReferenceNo,
                orderId:                id
            });

        } else {
            console.error('ToyyibPay returned error:', result);

            // Check for FPX maintenance in parsed JSON
            const resultStr = JSON.stringify(result).toLowerCase();
            if (resultStr.includes('fpx') && resultStr.includes('maintenance')) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'FPX_MAINTENANCE',
                    message: 'Online Transfer FPX sedang maintenance. Sila gunakan kaedah pembayaran lain.'
                });
            }

            return res.status(400).json({ 
                success: false, 
                error: 'Failed to create payment bill.',
                details: result
            });
        }

    } catch (error) {
        console.error('=== SERVER ERROR ===');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        return res.status(500).json({ 
            success: false, 
            error: 'An internal server error occurred.',
            details: error.message
        });
    }
}
