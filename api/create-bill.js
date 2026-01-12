import { createClient } from '@supabase/supabase-js';

// ==========================================
// === SUPABASE CONFIGURATION ===
// ==========================================
const supabaseUrl = 'https://ouijqobcjwmclrdmtfxf.supabase.co';
// Ensure you are using the SERVICE_ROLE key (anon key works too, but service_role bypasses RLS for safety)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aWpxb2JjandtY2xyZG10ZnhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTA0MSwiZXhwIjoyMDgzMzc1MDQxfQ.PDa6vUYNtdUCdXD0a5ycKC6WfuqiYGfK4LcDSghvszw';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // Top-level try/catch to prevent HTML crash pages
    try {
        console.log('=== API REQUEST STARTED ===');

        // Only allow POST
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method Not Allowed' });
        }

        // Debug Log: Check if body exists
        console.log('Incoming Body:', req.body);

        // VALIDATION: Check if body exists
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('ERROR: Request body is empty. Check Frontend headers.');
            return res.status(400).json({ 
                success: false, 
                error: 'Request body is empty. Did you send JSON headers?' 
            });
        }

        const { name, email, phone, amount, billDescription } = req.body;

        // VALIDATION: Check required fields
        if (!name || !email || !phone || !amount) {
            console.error('ERROR: Missing fields', { name, email, phone, amount });
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: name, email, phone, amount' 
            });
        }

        // ==========================================
        // === 1. SAVE TO SUPABASE (With Detailed Logs) ===
        // ==========================================
        console.log('STEP 1: Attempting to save order to Supabase...');
        
        let dbOrderId = null;

        try {
            const { data: orderData, error: dbError } = await supabase
                .from('orders')
                .insert([
                    { 
                        name: name, 
                        email: email, 
                        phone: phone, 
                        amount: parseFloat(amount), // Ensure it's a number
                        status: 'pending' 
                    }
                ])
                .select();

            if (dbError) {
                // THIS IS WHERE YOU WILL SEE "FAIL TO SAVE DATA" IN CONSOLE
                console.error('!!! FAIL TO SAVE DATA !!!');
                console.error('Supabase Error Details:', JSON.stringify(dbError, null, 2));
                
                return res.status(500).json({ 
                    success: false, 
                    error: 'Fail to save data to database.',
                    details: dbError.message 
                });
            }

            // Check if data was actually returned
            if (!orderData || orderData.length === 0) {
                console.error('!!! FAIL TO SAVE DATA: No data returned from insert !!!');
                return res.status(500).json({
                    success: false,
                    error: 'Fail to save data: Database did not return an ID.'
                });
            }

            dbOrderId = orderData[0].id;
            console.log(`SUCCESS: Order saved to Supabase. ID: ${dbOrderId}`);

        } catch (error) {
            console.error('!!! CRITICAL SYSTEM ERROR !!!');
            console.error(error.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Server crashed while saving data.',
                details: error.message 
            });
        }

        // ==========================================
        // === 2. CREATE TOYYIBPAY BILL ===
        // ==========================================
        console.log('STEP 2: Creating ToyyibPay Bill...');

        const categoryCode = '2mk6qgyo'; 
        const userSecretKey = 'b2kcp05o-b5m0-q000-55i7-w3j57riufv7h';
        const billName = 'ARANIS ECOM';
        const billPriceSetting = '1';
        const billPayorInfo = '1';
        const billAmount = `${parseFloat(amount) * 100}`; // RM10.00 = 1000
        
        const billReturnUrl = 'https://aranis-aiadsanalyst.vercel.app/payment-successful.html';
        const billCallbackUrl = 'https://aranis-aiadsanalyst.vercel.app/api/payment-callback';
        
        const billExternalReferenceNo = dbOrderId.toString();
        const billTo = name;
        const billEmail = email;
        const billPhone = phone;
        const billSplitPayment = '0';
        const billPaymentChannel = '0';
        const billChargeToCustomer = '1';

        // Use URLSearchParams (Standard Node.js format)
        const params = new URLSearchParams();
        params.append('userSecretKey', userSecretKey);
        params.append('categoryCode', categoryCode);
        params.append('billName', billName);
        params.append('billDescription', billDescription || `Pembelian ARANIS - RM${amount}`);
        params.append('billPriceSetting', billPriceSetting);
        params.append('billPayorInfo', billPayorInfo);
        params.append('billAmount', billAmount);
        params.append('billReturnUrl', billReturnUrl);
        params.append('billCallbackUrl', billCallbackUrl);
        params.append('billExternalReferenceNo', billExternalReferenceNo);
        params.append('billTo', billTo);
        params.append('billEmail', billEmail);
        params.append('billPhone', billPhone);
        params.append('billSplitPayment', billSplitPayment);
        params.append('billSplitPaymentArgs', '');
        params.append('billPaymentChannel', billPaymentChannel);
        params.append('billChargeToCustomer', billChargeToCustomer);
        params.append('billExpiryDays', '1');
        params.append('billContentEmail', 'Terima kasih atas pembayaran anda.');

        try {
            const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });

            const textResult = await response.text();
            console.log('ToyyibPay Response:', textResult);

            let result;
            try {
                result = JSON.parse(textResult);
            } catch (e) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Invalid JSON from ToyyibPay',
                    details: textResult
                });
            }

            if (result && result.length > 0 && result[0].BillCode) {
                return res.status(200).json({ 
                    success: true, 
                    billCode: result[0].BillCode,
                    billUrl: `https://toyyibpay.com/${result[0].BillCode}`,
                    orderId: dbOrderId 
                });
            } else {
                console.error('ToyyibPay API Error:', result);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Failed to create bill with provider.',
                    details: result
                });
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            return res.status(500).json({ success: false, error: 'Network error connecting to ToyyibPay' });
        }

    } catch (error) {
        // This final catch block ensures you ALWAYS get JSON, never HTML
        console.error('=== UNHANDLED SERVER ERROR ===', error);
        return res.status(500).json({ 
            success: false, 
            error: 'An internal server error occurred.',
            details: error.message 
        });
    }
}
