# Flutter developer README: Stripe and PayPal checkout

This document describes the current **customer service booking** API in this repository, including the Stripe/PayPal selector. It does not describe subscription-plan purchases. API examples use fictional IDs and show selected response fields.

Starting checkout creates a **PaymentAttempt**, not a Booking. A Booking is created only after successful backend payment verification. Never display a payment attempt as a confirmed booking.

## 1. Connection and authentication

Use a configurable base URL ending in `/api`, for example `https://your-backend.example/api`. All endpoint paths below are relative to that URL. Obtain the deployed URL from the backend team.

Authenticated requests need:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Use the existing customer's access token. Login is `POST /auth/login` with `email` (or `phone`) and `password`; the response includes `accessToken`, `refreshToken`, and `data.user`. Refresh an expired access token through `POST /auth/refresh-token` with `{ "refreshToken": "..." }`. Do not use the refresh token as the bearer token. `GET /auth/me` supplies the customer profile for prefilling checkout.

## 2. Checkout sequence

1. Load the service catalog and collect service IDs, quantities, variants, and add-ons.
2. Collect the service address, phone, and optional instructions.
3. Show a payment selector: **Card (Stripe)** or **PayPal**.
4. Submit `POST /bookings` once with the selected `paymentProvider`.
5. Retain the returned attempt ID and payment order ID before opening payment UI.
6. Complete Stripe payment or obtain PayPal buyer approval.
7. Call `POST /bookings/verify` with the same IDs and the provider-specific field.
8. Only after successful verification, clear the cart and display the returned booking.

Disable duplicate submission while creating, paying, or verifying. If the customer changes provider, create a new attempt for that provider; an existing order cannot be converted. First reconcile any payment that may already have completed.

## 3. Create a payment attempt

`POST /bookings`

```json
{
  "paymentProvider": "paypal",
  "services": [
    {
      "service": "507f1f77bcf86cd799439021",
      "quantity": 2
    }
  ],
  "address": {
    "label": "Home",
    "name": "My Home",
    "addressLine": "123 Example Street",
    "city": "Example City",
    "state": "CA",
    "zipcode": "90001",
    "coordinates": { "lat": 34.05, "lng": -118.25 }
  },
  "phone": "+12025550123",
  "specialInstructions": "Please ring the doorbell."
}
```

| Field | Contract |
| --- | --- |
| `paymentProvider` | Send `stripe` or `paypal` explicitly. Omitting it retains legacy server gateway selection, including a possible Razorpay fallback. |
| `services` | Nonempty array; each `service` is an active catalog MongoDB ID. |
| `services[].quantity` | Required positive integer. |
| `services[].variantId` | Optional active variant ID. For a service with variants, omission selects its first active variant. |
| `services[].addonIds` | Optional array of active add-on IDs belonging to that service. |
| `address.addressLine` | Required nonempty string. A nonempty address string is also accepted. |
| Other address fields | Optional; use the structure above. |
| `phone` | Required nonempty string. |
| `specialInstructions` | Optional string. |

The backend calculates prices from its catalog, including variants and add-ons. Do not send prices, amounts, user IDs, or payment status as checkout inputs. It currently sets `serviceDate` to today's midnight in the **server's timezone**; a submitted `serviceDate` or `bookingPeriod` does not control scheduling.

Both providers return `201` with this envelope:

```json
{
  "success": true,
  "data": {
    "paymentAttempt": {
      "_id": "507f1f77bcf86cd799439041",
      "totalAmount": 100,
      "serviceDate": "2026-10-03T00:00:00.000Z"
    },
    "paymentOrder": {
      "provider": "paypal",
      "id": "PAYPAL_ORDER_ID",
      "amount": 10000,
      "currency": "USD",
      "clientId": "public_paypal_app_client_id"
    }
  }
}
```

For `paymentProvider: "stripe"`, the `paymentOrder` object instead contains:

```json
{
  "provider": "stripe",
  "id": "pi_example",
  "clientSecret": "pi_example_secret_example",
  "amount": 10000,
  "currency": "usd",
  "publishableKey": "pk_test_example"
}
```

Use the returned provider and currency for payment UI. `paymentOrder.amount` is in minor units; `10000` means USD 100.00. `paymentAttempt.totalAmount` is in major units. The current implementation assumes two decimal currency places. The returned service date above is illustrative; its UTC offset depends on server timezone.

## 4. Stripe in Flutter

Use `flutter_stripe` PaymentSheet. Follow the package's [platform installation requirements](https://github.com/flutter-stripe/flutter_stripe#installation) and [PaymentSheet documentation](https://docs.page/flutter-stripe/flutter_stripe/sheet) for the version used by your app.

```sh
flutter pub add flutter_stripe
```

The following payment-only example runs after a successful create response:

```dart
import 'package:flutter_stripe/flutter_stripe.dart';

Future<void> completeStripePayment(Map<String, dynamic> order) async {
  if (order['provider'] != 'stripe') {
    throw StateError('This order is not a Stripe payment.');
  }
  final key = order['publishableKey'] as String? ?? '';
  final secret = order['clientSecret'] as String? ?? '';
  if (!key.startsWith('pk_') || secret.isEmpty) {
    throw StateError('Missing Stripe configuration.');
  }

  Stripe.publishableKey = key;
  // Register this return scheme in the Android/iOS app first.
  Stripe.urlScheme = 'oneapp';
  await Stripe.instance.applySettings();
  await Stripe.instance.initPaymentSheet(
    paymentSheetParameters: SetupPaymentSheetParameters(
      merchantDisplayName: '1App',
      paymentIntentClientSecret: secret,
      returnURL: 'oneapp://stripe-redirect',
    ),
  );
  await Stripe.instance.presentPaymentSheet();
  // Next call /bookings/verify. Its response determines booking success.
}
```

Handle `StripeException` and cancellation in the caller; keep the cart and attempt IDs. The backend creates card-only PaymentIntents and returns no Stripe Customer or ephemeral key. Do not add saved-card parameters to this example. The snippet is illustrative and has not been compiled in a Flutter project in this repository.

## 5. PayPal approval in Flutter

The backend supports PayPal **order creation and capture**. The existing React site obtains buyer approval with PayPal's JavaScript SDK, using `paymentOrder.clientId`, `currency`, and `id`. Its `createOrder` callback returns the existing order ID; its `onApprove` callback invokes backend verification. This follows [PayPal's server create/capture integration](https://developer.paypal.com/platforms/checkout/standard/integrate).

**Mobile work still required:** this repository contains no Flutter app, native PayPal platform bridge, or dedicated hosted mobile checkout page. The API does not return `approvalUrl` or configure mobile return/cancel URLs. Do not assume `url_launcher` can open the order ID, or that a Flutter package which creates and captures its own orders matches this API.

Coordinate one buyer-approval implementation with the backend/mobile team:

- Integrate the appropriate PayPal native SDK through a Flutter platform bridge, using the existing server-created order. Consult [PayPal's Android SDK documentation](https://developer.paypal.com/sdk/android/) for the Android integration and use the matching current iOS SDK documentation for iOS.
- Or implement an HTTPS hosted checkout page using the PayPal JavaScript SDK, with secure checkout-session handoff and a registered app return flow. This is additional work; no such endpoint/page is currently provided.

The approval adapter must accept the existing order ID and return approved/cancelled/failed to Flutter. After buyer approval, Flutter calls `/bookings/verify`; the backend captures the order. Keep capture on this backend. Never embed `PAYPAL_CLIENT_SECRET` in Dart, a WebView, or an app asset. A return callback is only a signal to verify, not proof of payment.

## 6. Verify payment and create the booking

`POST /bookings/verify`

Stripe body:

```json
{
  "paymentAttemptId": "507f1f77bcf86cd799439041",
  "stripePaymentIntentId": "pi_example"
}
```

PayPal body:

```json
{
  "paymentAttemptId": "507f1f77bcf86cd799439041",
  "paypalOrderId": "PAYPAL_ORDER_ID"
}
```

Send only the fields for the selected provider. `paymentAttemptId` is not a booking ID. PayPal verification retrieves the server order, checks ownership, order identity, amount and currency, captures an approved order, and requires a completed capture. Stripe verification checks attempt ownership, matching PaymentIntent metadata/order ID, successful status and expected received amount.

Success — `201` for a new booking; `200` for an already verified booking:

```json
{
  "success": true,
  "message": "Payment verified and booking created",
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439051",
      "totalAmount": 100,
      "status": "Pending",
      "paymentStatus": "Paid",
      "paymentDetails": {
        "provider": "paypal",
        "orderId": "PAYPAL_ORDER_ID",
        "paymentId": "PAYPAL_CAPTURE_ID",
        "transactionId": "PAYPAL_CAPTURE_ID"
      }
    }
  }
}
```

Stripe's `paymentId` is its latest charge ID, with the PaymentIntent ID as fallback. Repeated successful verification returns the same booking. Display: **“Payment completed. Your booking is pending confirmation.”** `Paid` and `Pending` describe different things: payment and service confirmation.

## 7. Finish checkout and recover errors

After verification succeeds, clear local cart state and call `DELETE /cart` if using the server cart. Refresh `GET /bookings/my-bookings?page=1&limit=10`; records are in `data.bookings`. Details are available at `GET /bookings/{bookingId}`. Cart cleanup failures should be retried independently of payment.

| Situation | App behavior |
| --- | --- |
| Buyer cancels or card is declined | Retain cart; do not show booking success. |
| `400` | Show API message; fix invalid fields or mismatched IDs. Validation errors may also include an `errors` array. |
| `401` | Refresh session and retry verification using the original IDs. |
| `403` | Show access/account error; do not retry blindly. |
| `404` | Service unavailable or attempt absent for this user; inspect the message. |
| `409` | Payment incomplete or verification in progress; retain state and reconcile before retrying. |
| `503` on creation | Chosen provider is not configured. Offer the other method. |
| Network error or other `5xx` after payment | Retry verification with the same IDs; do not open a new payment automatically. |
| Timeout during creation | Creation has no client idempotency key or lookup endpoint. Do not blindly resubmit; an attempt/order may already exist. |
| App restart after payment | Recover stored attempt/provider/order IDs and verify; do not charge again. |

Store the attempt ID, provider and order ID for recovery until verification completes. Store tokens securely and avoid logging credentials/client secrets. Set verification request timeouts to accommodate PayPal token/order/capture calls; a short timeout can occur even while the server continues processing. Use bounded retry/backoff after timeouts or “verification already in progress” responses.

There is no booking-payment webhook reconciliation or pending-attempt list endpoint in this flow. Flutter must perform verification after provider approval/payment; otherwise a paid attempt can remain absent from My Bookings.

## 8. Backend configuration and acceptance checks

Backend owners configure Stripe with `STRIPE_PUBLISHABLE_KEY` and `STRIPE_RESTRICTED_KEY` or `STRIPE_SECRET_KEY` (restricted key takes precedence), plus optional `STRIPE_CURRENCY` (`usd` default). PayPal requires `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`sandbox` or `live`) and `PAYPAL_CURRENCY` (`USD` default). No provider secrets belong in Flutter. See [PayPal setup](paypal-checkout.md).

Before release, test both providers for success, cancellation, declined/pending payment, expired access token, duplicate taps, app restart, and network loss after payment. Verify that retries produce one paid booking and that cancelled/failed payments leave the cart intact. Verify amount/currency display and PayPal's mobile return flow on Android and iOS.

Backend verification tests: `node --test backend/test/paypalPayment.test.js`. These mocked tests do not replace real Stripe test-mode and PayPal sandbox transactions.

## Source of truth

- [Booking controller](../backend/src/controllers/bookingController.js), [routes](../backend/src/routes/bookingRoutes.js), and [validation](../backend/src/middleware/validation.js)
- [PaymentAttempt model](../backend/src/models/PaymentAttempt.js) and [Booking model](../backend/src/models/Booking.js)
- [React checkout](../frontend/src/pages/Checkout.jsx) and [PayPal component](../frontend/src/components/PayPalPayment.jsx)
- [PayPal server integration](../backend/src/config/paypal.js)

Use this README for the Stripe/PayPal contract. The historical [customer Stripe guide](customer-booking-stripe-flutter.md) describes a superseded booking flow.
