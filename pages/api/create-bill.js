// ==========================================
// === CONFIGURATION ===
// ==========================================
// This file only handles the ToyyibPay request.
// The Frontend (checkout.html) handles saving to Supabase first.

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method Not Allowed' 
        });
    }

    try {
        console.log('=== Backend: Creating ToyyibPay Bill ===');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));

        // Get data from the frontend request
        // The Frontend now sends 'id' because it already saved the order to Supabase
        const { id, name, email, phone, amount, billDescription } = req.body;

        // Validate required fields
        if (!id || !name || !email || !phone || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: id, name, email, phone, amount' 
            });
        }

        // === 1. SUPABASE LOGIC REMOVED ===
        // We removed the database insert here because the Frontend does it.
        // This prevents duplicate orders and dependency errors.

        // === 2. TOYYIBPAY CONFIGURATION ===
        const categoryCode = '2mk6qgyo'; 
        const userSecretKey = 'b2kcp05o-b5m0-q000-55i7-w3j57riufv7h';
        const billName = 'ARANIS ECOM';
        const billPriceSetting = '1';
        const billPayorInfo = '1';
        
        // Convert amount to cents (RM 10.00 = 1000)
        const billAmount = `${parseFloat(amount) * 100}`; 
        
        const billReturnUrl = 'https://aranis-aiadsanalyst.vercel.app/payment-successful.html';
        const billCallbackUrl = 'https://aranis-aiadsanalyst.vercel.app/api/payment-callback';
        
        // Use the ID sent from the Frontend as the reference number
        // This links the ToyyibPay payment directly to the Supabase record
        const billExternalReferenceNo = id.toString();
        
        const billTo = name;
        const billEmail = email;
        const billPhone = phone;
        const billSplitPayment = '0';
        const billPaymentChannel = '0';
        const billChargeToCustomer = '1';

        // === FORM DATA ===
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
        params.append('billContentEmail', 'Terima kasih atas pembayaran anda. Prompt AI anda sedia untuk dimuat turun. Sila semel e-mel anda.');

        console.log('Data being sent to ToyyibPay...');

        // Make the API call to ToyyibPay from the server
        const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const textResult = await response.text();
        console.log('ToyyibPay Raw Response:', textResult);

        let result;
        try {
            result = JSON.parse(textResult);
            console.log('Parsed ToyyibPay Response:', JSON.stringify(result, null, 2));
        } catch (e) {
            console.error("Failed to parse ToyyibPay response:", e);
            
            // Check for maintenance message
            if (textResult.includes('FPX') && (textResult.includes('maintenance') || textResult.includes('maintainance'))) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'FPX_MAINTENANCE',
                    message: 'Online Transfer FPX Sedang maintainance. Sila cuba sebentar tadi.'
                });
            }
            
            return res.status(500).json({ 
                success: false, 
                error: 'Invalid response from payment provider.',
                details: textResult
            });
        }

        // Check if the bill was created successfully
        if (result && result.length > 0 && result[0].BillCode) {
            const billCode = result[0].BillCode;
            const billUrl = `https://toyyibpay.com/${billCode}`;

            console.log('Bill created successfully! Bill Code:', billCode);

            // Send the successful response back to the frontend
            return res.status(200).json({ 
                success: true, 
                billCode: billCode,
                billUrl: billUrl,
                billExternalReferenceNo: billExternalReferenceNo,
                orderId: id 
            });
        } else {
            console.error("ToyyibPay API Error:", result);
            
            if (result && typeof result === 'object' && 
                (JSON.stringify(result).toLowerCase().includes('fpx') && 
                (JSON.stringify(result).toLowerCase().includes('maintenance') || 
                 JSON.stringify(result).toLowerCase().includes('maintainance')))) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'FPX_MAINTENANCE',
                    message: 'Online Transfer FPX Sedang maintainance, Sila gunakan QR untuk Pembayaran. Terima kasih'
                });
            }
            
            return res.status(400).json({ 
                success: false, 
                error: 'Failed to create payment bill.',
                details: result
            });
        }
    } catch (error) {
        // Outer catch block to prevent HTML errors
        console.error('Server Error (Outer Catch):', error);
        return res.status(500).json({ 
            success: false, 
            error: 'An internal server error occurred.',
            details: error.message
        });
    }
}
