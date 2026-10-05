# PayPal booking checkout

Customers can choose Card (Stripe) or PayPal on the checkout page. Stripe remains the default. The existing booking endpoints accept PayPal without changing the booking confirmation flow.

Add these settings to `backend/.env` and restart the backend:

```dotenv
PAYPAL_CLIENT_ID=your_paypal_app_client_id
PAYPAL_CLIENT_SECRET=your_paypal_app_client_secret
PAYPAL_ENV=sandbox
PAYPAL_CURRENCY=USD
```

Create a REST app in the [PayPal Developer dashboard](https://developer.paypal.com/dashboard/). Use sandbox credentials and a sandbox personal buyer account for testing. To accept real payments, replace both credentials with live app credentials and set `PAYPAL_ENV=live`. Keep the client secret on the backend; no frontend environment variables or new packages are needed. Node.js 18+ is required for server fetch.

Use USD to match the current storefront's dollar prices. This checkout supports currencies with two decimal places; changing the storefront currency requires updating its price display too.

API:
- `POST /api/bookings`: include `paymentProvider: "paypal"` (or `"stripe"`) with the existing booking payload. Returns `paymentOrder` with `provider`, `id`, `amount` in cents, `currency`, and public `clientId`.
- `POST /api/bookings/verify`: send `paymentAttemptId` and `paypalOrderId`. The authenticated backend checks ownership, order identity, amount and currency, captures approved orders, and creates a booking only after a completed capture. Retrying verification retrieves completed orders instead of capturing twice.
- Existing clients that omit `paymentProvider` retain the existing gateway selection.

Sandbox checks: pay successfully; cancel and retry; retry confirmation after a connection error; confirm that failed/pending payments do not create bookings. Run automated verification tests with `node --test backend/test/paypalPayment.test.js`.

Implementation follows [PayPal's standard integration](https://developer.paypal.com/platforms/checkout/standard/integrate): server order creation/capture and browser SDK approval.
