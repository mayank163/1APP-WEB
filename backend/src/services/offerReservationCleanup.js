const PaymentAttempt = require('../models/PaymentAttempt');
const Redemption = require('../models/OfferRedemption');
const { settle } = require('./offerService');
// Reservations survive browser exits. Reconcile them against provider state;
// never release a paid or unknown payment merely because time elapsed.
function startOfferReservationCleanup() {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            const records = await Redemption.find({ status: 'reserved', createdAt: { $lt: new Date(Date.now() - 3600000) } }).sort('createdAt').limit(100);
            const controller = require('../controllers/bookingController');
            for (const record of records) {
                const attempt = await PaymentAttempt.findById(record.attempt);
                if (!attempt) continue; // Unknown provider outcome needs investigation.
                if (attempt.status === 'Completed' && attempt.booking) { await settle(attempt._id, attempt.booking); continue; }
                if (attempt.status === 'Cancelled') { await settle(attempt._id); continue; }
                if (attempt.paymentDetails.orderId.startsWith('initializing_')) continue;
                const body = { paymentAttemptId: String(attempt._id) };
                if (attempt.paymentDetails.provider === 'stripe') body.stripePaymentIntentId = attempt.paymentDetails.orderId;
                else if (attempt.paymentDetails.provider === 'paypal') body.paypalOrderId = attempt.paymentDetails.orderId;
                else continue;
                let verified = false;
                await controller.verifyPayment({ body, user: { _id: attempt.user, id: String(attempt.user) } }, { status() { return this; }, json(result) { if (result.success) verified = true; } }, () => {});
                if (verified) continue;
                await controller.cancelPaymentAttempt({ params: { id: attempt._id }, user: { _id: attempt.user } }, { status() { return this; }, json() {} }, () => {});
            }
        } catch (error) { console.error('Coupon reservation reconciliation failed:', error.message); }
        finally { running = false; }
    };
    const timer = setInterval(run, 300000);
    timer.unref();
    run();
}
module.exports = { startOfferReservationCleanup };
