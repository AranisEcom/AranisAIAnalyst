import { createClient } from '@supabase/supabase-js';

// === SUPABASE & BREVO CONFIGURATION ===
const supabaseUrl = 'https://ouijqobcjwmclrdmtfxf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aWpxb2JjandtY2xyZG10ZnhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTA0MSwiZXhwIjoyMDgzMzc1MDQxfQ.PDa6vUYNtdUCdXD0a5ycKC6WfuqiYGfK4LcDSghvszw';
const supabase = createClient(supabaseUrl, supabaseKey);

// REPLACE WITH YOUR BREVO API KEY
const BREVO_API_KEY = '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'; 

export default async function handler(req, res) {
    // Only POST requests are valid for Callbacks
    if (req.method !== 'POST') {
        return res.status(405).end('Method Not Allowed');
    }

    try {
        // 1. PARSE THE BODY (ToyyibPay sends form-urlencoded data)
        // We use this robust parsing to handle Vercel/Next.js request bodies properly
        let bodyParams = {};
        
        // Helper to parse x-www-form-urlencoded manually if req.body is empty string or raw
        const parseFormUrlEncoded = (str) => {
            return str.split('&').reduce((acc, pair) => {
                const [key, val] = pair.split('=');
                acc[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, ' '));
                return acc;
            }, {});
        };

        if (typeof req.body === 'string') {
            bodyParams = parseFormUrlEncoded(req.body);
        } else if (req.body && Object.keys(req.body).length > 0) {
            bodyParams = req.body;
        } else if (req.body && typeof req.body.toString === 'function') {
            bodyParams = parseFormUrlEncoded(req.body.toString());
        }

        console.log('🔔 Callback received from ToyyibPay:', bodyParams);

        const {
            billcode,           // ToyyibPay Bill Code
            status_id,          // 1 = Paid
            billto,
            billto_email,
            billto_phone,
            billpaymentamount,
            transaction_id,
            billexternalrefno   // THIS IS OUR SUPABASE ORDER ID
        } = bodyParams;

        // 2. VERIFY PAYMENT STATUS
        // If status is not 1, payment failed/pending. We just acknowledge receipt.
        if (status_id !== '1') {
            console.log(`⚠️ Payment failed or pending for BillCode: ${billcode}. Status: ${status_id}`);
            return res.status(200).send('OK'); // Return 200 so ToyyibPay doesn't retry
        }

        if (!billexternalrefno) {
            console.error('❌ No Bill External Reference No found. Cannot link to Supabase.');
            return res.status(200).send('OK');
        }

        // 3. FETCH ORDER FROM SUPABASE
        const { data: orderData, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', billexternalrefno)
            .single();

        if (fetchError || !orderData) {
            console.error('❌ Order not found in Supabase:', fetchError);
            return res.status(200).send('OK'); // Don't error out, ToyyibPay might retry
        }

        // 4. CHECK IF ALREADY PAID (Prevent duplicate emails)
        if (orderData.status === 'paid') {
            console.log(`✅ Order ${billexternalrefno} already marked as paid. Ignoring duplicate callback.`);
            return res.status(200).send('OK');
        }

        // 5. UPDATE STATUS TO PAID
        const { error: updateError } = await supabase
            .from('orders')
            .update({ 
                status: 'paid',
                bill_code: billcode,
                transaction_id: transaction_id
            })
            .eq('id', billexternalrefno);

        if (updateError) {
            console.error('❌ Failed to update Supabase:', updateError);
            // We proceed to email anyway to ensure customer isn't left hanging
        } else {
            console.log(`✅ Order ${billexternalrefno} updated to PAID.`);
        }

        // 6. SEND BREVO EMAIL
        // We send this here as the primary method. The frontend process-payment is just backup.
        console.log(`📧 Sending Brevo email to ${billto_email}...`);
        await sendBrevoEmail({
            ...orderData,
            status: 'paid',
            bill_code: billcode,
            transaction_id: transaction_id
        });

        // 7. RESPOND "OK" TO TOYYIBPAY
        // IMPORTANT: ToyyibPay expects exactly the string "OK" to stop retrying
        res.status(200).send('OK');

    } catch (error) {
        console.error('💥 Callback Error:', error);
        // Always return 200 to avoid ToyyibPay hammering the server with retries
        res.status(200).send('OK');
    }
}

// --- HELPER FUNCTION: BREVO EMAIL ---
async function sendBrevoEmail(order) {
    const emailData = {
        sender: { 
            email: 'no-reply@aranis.com', // REPLACE WITH YOUR VERIFIED SENDER
            name: 'ARANIS ECOM' 
        },
        to: [{ email: order.email || order.billto_email, name: order.name || order.billto }],
        subject: 'Pembayaran Berjaya: Master Prompt Meta Analyst AI',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="background-color: #181b21; padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif;">ARANIS ECOM</h1>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #333; margin-top: 0;">Terima Kasih, ${order.name || order.billto}!</h2>
                        <p style="color: #555;">Pembayaran anda telah diterima dan disahkan.</p>
                        
                        <!-- Summary Box -->
                        <div style="background-color: #f9f9f9; border: 1px solid #eee; padding: 20px; border-radius: 8px; margin: 25px 0;">
                            <p style="margin: 0 0 10px 0;"><strong>ID Pesanan:</strong> ${order.id || order.billexternalrefno}</p>
                            <p style="margin: 0 0 10px 0;"><strong>Jumlah:</strong> RM${parseFloat(order.billpaymentamount || order.amount).toFixed(2)}</p>
                            <p style="margin: 0;"><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">Lunas / Paid</span></p>
                        </div>

                        <p>Kami akan menghantar butiran login dan akses produk anda melalui WhatsApp dalam masa 1-24 jam.</p>
                        <p>Jika anda mempunyai sebarang pertanyaan, sila hubungi kami di <a href="https://wa.me/60172703949">60172703949</a>.</p>
                        
                        <p style="margin-top: 30px; color: #888; font-size: 14px;">Terima kasih kerana memilih ARANIS ECOM.</p>
                    </div>

                    <!-- Footer -->
                    <div style="background-color: #181b21; padding: 20px; text-align: center; color: #888; font-size: 12px;">
                        &copy; 2024 Aranis Ecom Hub. All rights reserved.
                    </div>
                </div>
            </div>
        `
    };

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (response.ok) {
            console.log('✅ Brevo email sent successfully.');
        } else {
            console.error('❌ Brevo API Error:', await response.json());
        }
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}
