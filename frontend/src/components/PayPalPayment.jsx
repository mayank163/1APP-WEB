import React, { useEffect, useRef, useState } from 'react';
import bookingService from '../services/bookingService';

let sdkPromise;
let sdkKey;
function loadPayPal(clientId, currency) {
    const key = `${clientId}:${currency}`;
    if (sdkPromise && sdkKey === key) return sdkPromise;
    sdkKey = key;
    sdkPromise = new Promise((resolve, reject) => {
        document.getElementById('paypal-checkout-sdk')?.remove();
        const script = document.createElement('script');
        script.id = 'paypal-checkout-sdk';
        script.src = `https://www.paypal.com/sdk/js?${new URLSearchParams({ 'client-id': clientId, currency, intent: 'capture', components: 'buttons' })}`;
        script.onload = () => resolve(window.paypal);
        script.onerror = () => { sdkPromise = null; reject(new Error('Unable to load PayPal. Please retry.')); };
        document.body.appendChild(script);
    });
    return sdkPromise;
}

export default function PayPalPayment({ paymentAttempt, paymentOrder, onSuccess, onCancel }) {
    const container = useRef(null);
    const callbacks = useRef({ onSuccess, onCancel });
    callbacks.current = { onSuccess, onCancel };
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [approved, setApproved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);
    const verify = async () => {
        setProcessing(true);
        setError('');
        try {
            const result = await bookingService.verifyPayPalPayment(paymentAttempt._id, paymentOrder.id);
            if (!result.success) throw new Error('Unable to confirm your payment. Please retry.');
            callbacks.current.onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Unable to verify PayPal payment.');
        } finally {
            setProcessing(false);
        }
    };
    const verifyRef = useRef(verify);
    verifyRef.current = verify;

    useEffect(() => {
        let disposed = false;
        let buttons;
        setLoading(true);
        loadPayPal(paymentOrder.clientId, paymentOrder.currency).then(async paypal => {
            if (disposed) return;
            buttons = paypal.Buttons({
                fundingSource: paypal.FUNDING.PAYPAL,
                createOrder: () => paymentOrder.id,
                onApprove: async () => {
                    setApproved(true);
                    await verifyRef.current();
                },
                onCancel: () => setError('Payment cancelled. You can try again or return to checkout.'),
                onError: () => setError('PayPal could not complete the payment. Please try again.')
            });
            await buttons.render(container.current);
            if (!disposed) setLoading(false);
        }).catch(err => {
            if (!disposed) { setError(err.message); setLoading(false); }
        });
        return () => { disposed = true; if (buttons) Promise.resolve(buttons.close()).catch(() => {}); };
    }, [paymentOrder, reload]);

    return (
        <div style={{ padding: 24, textAlign: 'center' }}>
            <p>Amount to pay: <strong>{paymentOrder.currency} {(paymentOrder.amount / 100).toFixed(2)}</strong></p>
            {loading && <p role="status">Loading PayPal…</p>}
            <div ref={container} style={{ display: approved ? 'none' : 'block' }} />
            {processing && <p role="status">Confirming payment…</p>}
            {error && <p role="alert" style={{ color: '#c62828' }}>{error}</p>}
            {error && <button type="button" disabled={processing} onClick={() => approved ? verify() : (setError(''), setReload(v => v + 1))}>Retry {approved ? 'payment verification' : 'PayPal'}</button>}
            <button type="button" disabled={processing || approved} onClick={onCancel} style={{ display: 'block', margin: '18px auto 0', border: 'none', background: 'none', color: '#666', cursor: 'pointer' }}>Back to checkout</button>
        </div>
    );
}
