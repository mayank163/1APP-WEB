const Razorpay = require('razorpay');

let razorpayInstance;

try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keyId !== 'your_razorpay_key_id') {
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
        console.log('✅ Razorpay initialized with credentials');
    } else {
        console.log('⚠️ Razorpay Key ID not set. Using mock Razorpay implementation.');
        razorpayInstance = {
            orders: {
                create: async (options) => {
                    return {
                        id: `order_mock_${Math.random().toString(36).substring(2, 15)}`,
                        entity: 'order',
                        amount: options.amount,
                        amount_paid: 0,
                        amount_due: options.amount,
                        currency: options.currency || 'USD',
                        receipt: options.receipt,
                        status: 'created',
                        attempts: 0,
                        notes: options.notes,
                        created_at: Math.floor(Date.now() / 1000)
                    };
                }
            },
            payments: {
                fetch: async (paymentId) => {
                    return {
                        id: paymentId,
                        entity: 'payment',
                        amount: 50000,
                        currency: 'USD',
                        status: 'captured',
                        order_id: 'order_mock_123',
                        invoice_id: null,
                        international: false,
                        method: 'card',
                        amount_refunded: 0,
                        refund_status: null,
                        captured: true
                    };
                }
            }
        };
    }
} catch (error) {
    console.error('❌ Error initializing Razorpay, using mock:', error.message);
    razorpayInstance = {
        orders: {
            create: async (options) => ({ id: `order_mock_${Date.now()}`, amount: options.amount })
        }
    };
}

module.exports = razorpayInstance;
