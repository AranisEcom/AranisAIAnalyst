import { createClient } from '@supabase/supabase-js';

// === SUPABASE CONFIGURATION (Same as before) ===
const supabaseUrl = 'https://ouijqobcjwmclrdmtfxf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91aWpxb2JjandtY2xyZG10ZnhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTA0MSwiZXhwIjoyMDgzMzc1MDQxfQ.PDa6vUYNtdUCdXD0a5ycKC6WfuqiYGfK4LcDSghvszw';
const supabase = createClient(supabaseUrl, supabaseKey);

// === BREVO CONFIGURATION ===
// REPLACE THIS WITH YOUR BREVO API KEY
const BREVO_API_KEY = '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'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }

        console.log(`Processing payment for Order ID: ${orderId}`);

        // 1. Fetch Order Details from Supabase
        const { data: orderData, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchError || !orderData) {
            console.error('Order not found:', fetchError);
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // 2. Check if already paid to avoid duplicate emails
        if (orderData.status === 'paid') {
            console.log('Order already paid. Skipping email send.');
            return res.status(200).json({ success: true, message: 'Already processed' });
        }

        // 3. Update Status to 'paid' in Supabase
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', orderId);

        if (updateError) {
            throw new Error('Failed to update order status');
        }
        console.log('Order status updated to PAID.');

        // 4. Send Email via Brevo
        const emailSent = await sendBrevoEmail(orderData);

        if (emailSent) {
            return res.status(200).json({ success: true, message: 'Payment processed and email sent.' });
        } else {
            // Payment updated, but email failed. Log it but don't fail the request completely for the user.
            return res.status(200).json({ success: true, warning: 'Payment processed but email failed.' });
        }

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// --- HELPER FUNCTION: SEND BREVO EMAIL ---
async function sendBrevoEmail(order) {
    const emailData = {
        sender: { 
            email: 'no-reply@aranis.com', // REPLACE WITH YOUR VERIFIED SENDER EMAIL
            name: 'ARANIS ECOM' 
        },
        to: [{ email: order.email, name: order.name }],
        subject: 'Akses Anda Sedia! Master Prompt Meta Analyst AI',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="background-color: #181b21; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">ARANIS ECOM</h1>
                </div>
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2>Terima Kasih, ${order.name}!</h2>
                    <p>Pembayaran anda untuk <strong>Master Prompt: Meta Analyst AI</strong> telah berjaya.</p>
                    <p>Berikut adalah butiran pesanan anda:</p>
                    <ul>
                        <li><strong>ID Pesanan:</strong> ${order.id}</li>
                        <li><strong>Jumlah:</strong> RM${order.amount}</li>
                    </ul>
                    
                    <div style="background: #e1f5fe; padding: 15px; border-left: 4px solid #03a9f4; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Cara Akses Prompt:</strong></p>
                        <p style="margin: 5px 0 0 0;">Kami akan menghantar katalaluan login anda melalui WhatsApp dalam masa 1-24 jam. Sila pastikan nombor telefon ${order.phone} adalah aktif.</p>
                    </div>

                    <p>Jika anda mempunyai sebarang pertanyaan, sila hubungi kami.</p>
                    <p>Terima kasih kerana memilih ARANIS ECOM!</p>
                </div>
                <div style="background-color: #181b21; padding: 20px; text-align: center; color: white; font-size: 12px;">
                    &copy; 2024 Aranis Ecom Hub. All rights reserved.
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

        const result = await response.json();
        if (response.ok) {
            console.log('Email sent successfully via Brevo');
            return true;
        } else {
            console.error('Brevo API Error:', result);
            return false;
        }
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}
