const Stripe = require('stripe');

const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;

let stripe = null;

if (secretKey && !['your_stripe_secret_key', 'your_stripe_restricted_key'].includes(secretKey)) {
    stripe = new Stripe(secretKey);
    console.log('Stripe initialized with secret key');
} else {
    console.log('Stripe secret key not set. Stripe payments are disabled.');
}

module.exports = stripe;
