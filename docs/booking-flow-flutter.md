# 1App Booking and Payment Flow (Flutter)

This guide documents the current customer booking API. A `Booking` is created only after the backend confirms that the payment provider reports a completed payment. Starting checkout creates a separate internal payment attempt, which is not returned by the booking-list APIs.

## Request setup

Use the backend URL with `/api` included, for example `https://api.example.com/api`. All endpoints below require a logged-in customer. Send the access token, not the refresh token:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Flow at a glance

1. Load active services and collect selected service IDs and quantities.
2. Collect the address, contact phone, and optional instructions.
3. Call `POST /bookings` once for this checkout. The backend recalculates prices, creates a payment order, and stores a payment attempt. It does **not** create a booking yet.
4. Use the returned payment provider's SDK to complete payment. For Stripe, use `paymentOrder.clientSecret` with `flutter_stripe` PaymentSheet.
5. After the SDK reports success, call `POST /bookings/verify` with the payment attempt ID and provider payment ID. The backend independently checks the payment with Stripe/Razorpay and creates the booking only when payment is complete.
6. On verification success, show the booking and refresh `GET /bookings/my-bookings`. Clear the cart only after this response succeeds.

```mermaid
sequenceDiagram
    actor Customer
    participant App as Flutter app
    participant API as 1App API
    participant Provider as Payment provider
    Customer->>App: Select services and enter booking details
    App->>API: POST /bookings
    API->>API: Recalculate prices and save PaymentAttempt only
    API->>Provider: Create payment order / PaymentIntent
    API-->>App: paymentAttempt + paymentOrder
    App->>Provider: Collect and confirm payment
    Provider-->>App: Payment result
    App->>API: POST /bookings/verify
    API->>Provider: Retrieve and validate payment status and amount
    alt Payment succeeded
        API->>API: Create Booking with paymentStatus Paid
        API-->>App: 201 with booking
        App->>API: GET /bookings/my-bookings
    else Payment not completed
        API-->>App: 409; no Booking created
    end
```

## 1. Start checkout

`POST /bookings`

```json
{
  "services": [
    {
      "service": "507f1f77bcf86cd799439021",
      "quantity": 2
    }
  ],
  "address": {
    "label": "Home",
    "name": "",
    "addressLine": "123 Example Street, Apt 4",
    "city": "Example City",
    "state": "CA",
    "zipcode": "90001",
    "coordinates": { "lat": 34.05, "lng": -118.25 }
  },
  "phone": "+12025550123",
  "specialInstructions": "Please ring the doorbell."
}
```

`services` must contain at least one active service. `quantity` must be a positive integer. `address` can also be a nonempty string. The server uses its service catalog for prices; do not send or trust a client-calculated total. `serviceDate` is currently set by the backend to the current date at midnight in the server's local timezone.

Response — `201`:

```json
{
  "success": true,
  "data": {
    "paymentAttempt": {
      "_id": "507f1f77bcf86cd799439041",
      "totalAmount": 100,
      "serviceDate": "2026-09-26T00:00:00.000Z"
    },
    "paymentOrder": {
      "provider": "stripe",
      "id": "pi_example",
      "clientSecret": "pi_example_secret_example",
      "amount": 10000,
      "currency": "usd",
      "publishableKey": "pk_test_example"
    }
  }
}
```

The response fields vary by provider. For Stripe, `amount` is in the currency's smallest unit (`10000` means USD 100.00). Use the returned `provider` to choose the correct SDK. The current Flutter Stripe flow requires `provider: "stripe"`, a valid publishable key, and a nonempty client secret. Do not use Stripe with a Razorpay order. If the API returns another provider, show an unsupported-payment message unless that provider's Flutter SDK is integrated.

Keep `paymentAttempt._id` and `paymentOrder.id` for verification. Do not treat the payment attempt as a booking or show it in My Bookings.

## 2. Complete payment in Flutter

For Stripe, configure `flutter_stripe` and present PaymentSheet using the server-returned client secret. Do not send card data, the client secret, a client-provided success flag, or a client-calculated amount to the backend.

Only proceed to verification after the SDK reports the PaymentIntent succeeded. A cancelled or failed payment is not a successful booking. The customer may retry payment where the provider allows it, or start a new checkout. Do not call booking verification with a fabricated status.

## 3. Verify payment and create the booking

`POST /bookings/verify`

Stripe request:

```json
{
  "paymentAttemptId": "507f1f77bcf86cd799439041",
  "stripePaymentIntentId": "pi_example"
}
```

The backend verifies that the attempt belongs to the authenticated user, the PaymentIntent belongs to that attempt, and Stripe reports `succeeded` with the expected amount. Only then does it save a `Booking` with `paymentStatus: "Paid"` and `status: "Pending"`.

Response — `201`:

```json
{
  "success": true,
  "message": "Payment verified and booking created",
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439051",
      "totalAmount": 100,
      "serviceDate": "2026-09-26T00:00:00.000Z",
      "status": "Pending",
      "paymentStatus": "Paid",
      "paymentDetails": {
        "provider": "stripe",
        "orderId": "pi_example",
        "paymentId": "ch_example",
        "transactionId": "ch_example"
      }
    }
  }
}
```

A repeated verification for a completed attempt returns the existing booking rather than creating another one. If payment is not yet complete, verification returns `409` with `"Payment is not completed. No booking has been created."` The attempt remains available for a later verification; a failed/cancelled checkout does not appear in `GET /bookings/my-bookings`.

For Razorpay, send `paymentAttemptId`, `razorpayOrderId`, and `razorpayPaymentId`. The backend fetches the payment itself and requires a captured payment for the matching order and amount. The client must not send `status: "success"` as proof of payment.

## 4. After successful verification

Only after `/bookings/verify` returns success:

- Clear local cart state and call `DELETE /cart` if using the server cart.
- Navigate to bookings or show the returned booking.
- Refresh `GET /bookings/my-bookings` or request `GET /bookings/{bookingId}`.

The booking's `status` remains `Pending` until the operations/admin workflow confirms it. This is separate from payment: `paymentStatus: "Paid"` means the charge completed; `status: "Pending"` means the booking awaits service confirmation.

## Error handling

- `400`: malformed or mismatched attempt/payment IDs. Keep checkout details and surface the API message.
- `404`: attempt not found for this signed-in user. Do not create a local booking.
- `409`: payment is not complete or verification is in progress. Do not clear the cart or show booking success. Once the provider reports success, retry verification with the same IDs.
- Network timeout after payment: retry verification with the same `paymentAttemptId` and provider payment ID. Verification is idempotent after the booking is created.
- Other `5xx`: retain checkout state and retry/reconcile; do not assume payment failed or create a second checkout automatically.

Never log access tokens, Stripe client secrets, or payment credentials. The backend's Stripe secret key remains server-side.
