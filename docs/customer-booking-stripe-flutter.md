# Customer service booking with Stripe: Flutter integration

> **Superseded:** the booking/payment API contract in this older guide no longer applies. Use [booking-flow-flutter.md](booking-flow-flutter.md) for the current flow, where the backend creates a Booking only after payment verification succeeds. The sections below are retained as historical integration notes and may describe the previous contract.

This guide described an earlier React checkout and Express backend implementation.

**Flow:** select services → choose booking period → enter address/contact details → create booking → pay through Stripe → verify payment with backend → clear cart → display booking.

Examples use fictional IDs and keys. Response examples show relevant fields; MongoDB documents can contain additional fields. The API contracts were checked against source code, not a live payment transaction.

## 1. Connection and authentication

Configure `API_BASE_URL` as the backend origin plus `/api`, for example `https://your-backend.example/api`. All paths below are relative to this value. Do not append `/api` twice. Obtain the deployed backend URL from the backend team.

Send these headers for authenticated JSON requests:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

All `/bookings` and `/cart` endpoints require authentication. Service browsing and login are public.

### Login, if the app does not already have a session

`POST /auth/login`

```json
{
  "email": "customer@example.com",
  "password": "<customer-password>"
}
```

Alternatively send `phone` instead of `email`, with the password. Optional `fcmToken` is supported.

Response — `200`:

```json
{
  "success": true,
  "accessToken": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "expiresIn": "15m",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Example Customer",
      "email": "customer@example.com",
      "phone": "+12025550123",
      "address": "123 Example Street, Apt 4"
    }
  }
}
```

`expiresIn` is configured by the server; `15m` is its default. Use **`accessToken`**, not `refreshToken`, in the bearer header. `GET /auth/me` returns `{ "success": true, "data": { "user": ... } }` and can prefill the address and phone.

## 2. API call order

| Step | Call/action | Result |
| --- | --- | --- |
| 1 | Login if needed | Access token |
| 2 | `GET /services?status=active` | Services to select |
| 3 | `POST /cart`, then `GET /cart` | Selected services and quantities; optional if using a local cart |
| 4 | Local form: booking period, address, phone, instructions | Checkout payload |
| 5 | `POST /bookings` **once per new checkout** | Booking ID and Stripe PaymentIntent data |
| 6 | Flutter Stripe SDK: initialize and present PaymentSheet | Customer completes card payment/authentication |
| 7 | `POST /bookings/verify` after Stripe succeeds | Backend records `paymentStatus: "Paid"` |
| 8 | `DELETE /cart` if using server cart; clear local checkout selection | Cart reset |
| 9 | `GET /bookings/my-bookings` or `GET /bookings/{bookingId}` | Display current booking |

```mermaid
sequenceDiagram
    actor Customer
    participant App as Flutter app
    participant API as Backend
    participant Stripe
    Customer->>App: Select services and enter booking details
    App->>API: POST /api/bookings
    API->>Stripe: Create PaymentIntent with server-calculated amount
    API->>API: Save Pending booking
    API->>Stripe: Add bookingId to PaymentIntent metadata
    API-->>App: booking + paymentOrder (clientSecret, id, publishableKey)
    App->>Stripe: Present PaymentSheet and confirm payment
    Stripe-->>App: Payment outcome
    App->>API: POST /api/bookings/verify (after succeeded)
    API->>Stripe: Retrieve PaymentIntent and check status
    API->>API: Save paymentStatus Paid, status Pending
    API-->>App: Verified booking
    App->>API: DELETE /api/cart
    App->>API: GET /api/bookings/my-bookings
    App-->>Customer: Payment completed; awaiting booking confirmation
```

## 3. Browse services and build the cart

### Browse

`GET /services?status=active` — no body, no authentication required.

Optional query parameters: `category`, `subcategory` (IDs), `status`, `search`. The current endpoint does not paginate.

Response — `200`:

```json
{
  "success": true,
  "count": 1,
  "data": {
    "services": [
      {
        "_id": "507f1f77bcf86cd799439021",
        "name": "Home cleaning",
        "price": 50,
        "actualPrice": 50,
        "offerPrice": 0,
        "hasVariants": false,
        "isActive": true,
        "status": "active"
      }
    ]
  }
}
```

`GET /services/{serviceId}` returns `200` with `{ "success": true, "data": { "service": ... } }`; an unknown service returns `404` with `message: "Service not found"`.

Use the full service `_id` in bookings. Only book active services with a numeric `price`. Variant price ranges and addon selections are not supported by the current booking payload; see section 10.

### Server cart (matches the logged-in website)

`POST /cart`

```json
{
  "serviceId": "507f1f77bcf86cd799439021",
  "quantity": 2
}
```

Response — `201` for a new item:

```json
{
  "success": true,
  "duplicate": false,
  "data": {
    "cart": [
      {
        "_id": "507f1f77bcf86cd799439031",
        "service": {
          "_id": "507f1f77bcf86cd799439021",
          "name": "Home cleaning",
          "price": 50,
          "isActive": true
        },
        "quantity": 2
      }
    ]
  }
}
```

Adding an existing service returns `200`, `duplicate: true`, and the unchanged cart. It **does not increment** quantity.

| Action | Endpoint | JSON body | Success response |
| --- | --- | --- | --- |
| Read cart | `GET /cart` | None | `200`, `{ "success": true, "data": { "cart": [...] } }` |
| Set quantity | `PUT /cart/{serviceId}` | `{ "quantity": 3 }` | `200`, same cart envelope |
| Remove service | `DELETE /cart/{serviceId}` | None | `200`, same cart envelope |
| Merge guest cart | `POST /cart/merge` | `{ "items": [{ "serviceId": "507f1f77bcf86cd799439021", "quantity": 2 }] }` | `200`, same cart envelope |
| Clear cart after verification | `DELETE /cart` | None | `200`, `{ "success": true, "data": { "cart": [] } }` |

The quantity update removes an item when quantity is zero or less; the Flutter UI should send positive integers for retained items. Guest merge keeps an existing server item's quantity unchanged. A cart service may be `null` if it was deleted; omit unavailable entries from checkout and ask the customer to review the cart.

The booking endpoint takes an explicit `services` array; it does not read or clear the server cart automatically. A local-only cart can skip all cart endpoints.

## 4. Collect booking information

| Field | Required | Rule |
| --- | --- | --- |
| `services` | Yes | Nonempty array of `{ "service": "<serviceId>", "quantity": 1 }` |
| `services[].service` | Yes | Existing active service's MongoDB ID |
| `services[].quantity` | Yes | Integer, at least `1`; send explicitly |
| `address` | Yes | Nonempty string containing service address |
| `phone` | Yes | Nonempty contact number string |
| `bookingPeriod` | Yes | Exactly `today`, `tomorrow`, `week`, or `month` |
| `specialInstructions` | No | String; use `""` if absent |

The server calculates `serviceDate` in its own local timezone, starting at midnight:

| `bookingPeriod` | Server-selected date |
| --- | --- |
| `today` | Today |
| `tomorrow` | Tomorrow |
| `week` | Next Sunday; if today is Sunday, seven days later |
| `month` | First day of next month |

The React app also sends `serviceDate`, but the controller **ignores it**. Flutter should send `bookingPeriod` and display the returned `serviceDate`. There is no time-slot reservation endpoint mounted in this backend. The older `bookingApi.js` helper's `/api/slots` request falls back to mock data and is not part of this checkout.

## 5. Create the booking and Stripe PaymentIntent

`POST /bookings`

```json
{
  "services": [
    {
      "service": "507f1f77bcf86cd799439021",
      "quantity": 2
    }
  ],
  "address": "123 Example Street, Apt 4",
  "phone": "+12025550123",
  "bookingPeriod": "tomorrow",
  "specialInstructions": "Please ring the doorbell on arrival."
}
```

The backend reads current service prices, calculates the total, creates a Stripe PaymentIntent, saves a pending booking, then attaches the booking ID to the PaymentIntent metadata. Do not send card details, client-calculated prices, a user ID, or payment status.

Response — `201` (example assumes two services at USD 50 each and a server using UTC):

```json
{
  "success": true,
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439041",
      "user": "507f1f77bcf86cd799439011",
      "services": [
        {
          "service": "507f1f77bcf86cd799439021",
          "quantity": 2,
          "price": 50
        }
      ],
      "totalAmount": 100,
      "address": "123 Example Street, Apt 4",
      "phone": "+12025550123",
      "bookingPeriod": "tomorrow",
      "serviceDate": "2026-09-24T00:00:00.000Z",
      "status": "Pending",
      "paymentStatus": "Pending",
      "paymentDetails": {
        "provider": "stripe",
        "orderId": "pi_example"
      },
      "specialInstructions": "Please ring the doorbell on arrival.",
      "assignedTechnician": { "name": "", "phone": "" },
      "createdAt": "2026-09-23T10:00:00.000Z",
      "updatedAt": "2026-09-23T10:00:00.000Z"
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

Store `booking._id` and `paymentOrder.id` before opening payment UI. Keep `clientSecret` available for the current checkout without logging or sharing it.

| Response field | Flutter usage |
| --- | --- |
| `booking._id` | Backend booking ID; send as `bookingId` during verification |
| `paymentOrder.id` | Stripe PaymentIntent ID; send as `stripePaymentIntentId` |
| `paymentOrder.clientSecret` | Initialize the Stripe payment UI; do not substitute the ID |
| `paymentOrder.publishableKey` | Configure Flutter Stripe |
| `paymentOrder.amount` | Amount in minor units: `10000` = USD `100.00` |
| `paymentOrder.currency` | Actual payment currency; defaults to server `STRIPE_CURRENCY` or `usd` |
| `booking.totalAmount` | Total in major units: `100` in this example |

Use the returned amount for the final payment summary. The current server multiplies prices by `100`; this implementation assumes a currency with two decimal places. The website displays `$`, but Flutter should use the returned currency.

Require `paymentOrder.provider == "stripe"`, a nonempty client secret, and a valid publishable key before opening PaymentSheet. If Stripe is not configured, this backend attempts a Razorpay fallback; that response cannot be used with Flutter Stripe.

## 6. Take payment in Flutter

Use `flutter_stripe` PaymentSheet as the native equivalent of the website's Stripe Payment Element. Follow the package's [installation/platform setup](https://github.com/flutter-stripe/flutter_stripe#installation) for the version selected by the app, including Android activity/theme and iOS deployment requirements.

Install with `flutter pub add flutter_stripe`. PaymentSheet collects and confirms payment. Configure a return URL scheme for the app where required. This backend provides no Stripe Customer or ephemeral key, so omit those optional PaymentSheet parameters; saved cards are outside this flow. See the package's [PaymentSheet guide](https://docs.page/flutter-stripe/flutter_stripe/sheet).

The following is the payment portion only, called **after** a successful create-booking response. It does not create another booking on retry. `createResponse` is the decoded JSON map from section 5. The caller handles SDK exceptions, API verification, and UI state.

```dart
import 'package:flutter_stripe/flutter_stripe.dart';

Future<Map<String, String>> payForCreatedBooking(
  Map<String, dynamic> createResponse,
) async {
  final data = createResponse['data'] as Map<String, dynamic>;
  final booking = data['booking'] as Map<String, dynamic>;
  final order = data['paymentOrder'] as Map<String, dynamic>;

  if (order['provider'] != 'stripe') {
    throw StateError('Stripe is unavailable for this booking.');
  }

  final key = order['publishableKey'] as String? ?? '';
  final secret = order['clientSecret'] as String? ?? '';
  if (!key.startsWith('pk_') || secret.isEmpty) {
    throw StateError('Missing Stripe payment configuration.');
  }

  Stripe.publishableKey = key;
  // Register this example scheme in the native Android/iOS projects first.
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

  final intent = await Stripe.instance.retrievePaymentIntent(secret);
  if (intent.status != PaymentIntentsStatus.Succeeded) {
    throw StateError('Payment is not yet successful; reconcile before retrying.');
  }

  return {
    'bookingId': booking['_id'] as String,
    'stripePaymentIntentId': order['id'] as String,
  };
}
```

SDK calls and types are documented in the [Flutter Stripe API reference](https://pub.dev/documentation/flutter_stripe/latest/flutter_stripe/Stripe-class.html). This illustrative snippet has not been compiled in a Flutter project in this repository.

Send the returned map to `POST /bookings/verify`. A successful SDK result alone must not clear the cart or show backend booking success. Handle `StripeException` cancellation as an interrupted checkout, and show other SDK errors while retaining the existing booking. Keep duplicate payment taps disabled while processing.

The backend creates card-only PaymentIntents (`payment_method_types: ['card']`). This example does not configure wallets or additional payment methods. Stripe secret/restricted keys stay on the backend; the app uses only the publishable key and the checkout's client secret.

## 7. Verify the payment and finish checkout

`POST /bookings/verify`

```json
{
  "bookingId": "507f1f77bcf86cd799439041",
  "stripePaymentIntentId": "pi_example"
}
```

Send only these two fields for Stripe. Do not send `status: "success"`, Razorpay fields, the client secret, or a charge ID. The backend retrieves the PaymentIntent and checks for `status === 'succeeded'`.

Response — `200`:

```json
{
  "success": true,
  "message": "Payment verified and booking confirmed",
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439041",
      "user": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Example Customer"
      },
      "services": [
        {
          "service": {
            "_id": "507f1f77bcf86cd799439021",
            "name": "Home cleaning",
            "price": 50
          },
          "quantity": 2,
          "price": 50
        }
      ],
      "totalAmount": 100,
      "bookingPeriod": "tomorrow",
      "serviceDate": "2026-09-24T00:00:00.000Z",
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

`paymentId`/`transactionId` normally contain Stripe's latest charge ID, with the PaymentIntent ID as fallback. They are different from the booking ID. Populated `user` and `services[].service` are objects here, whereas the create response contains their IDs.

**Despite the response message, the actual booking status remains `Pending`.** Payment success means `paymentStatus: "Paid"`; admin confirmation is a separate step. Match the website message: **“Payment completed. Your booking is pending confirmation.”**

After verification succeeds:

1. Clear the server cart with `DELETE /cart`, if used.
2. Clear local cart and stored booking period/date.
3. Show My Bookings and fetch current data.

If clearing the cart fails, retry cart cleanup separately; payment is already complete. The backend also attempts a confirmation email with an invoice without waiting for email delivery before responding.

## 8. Booking list, details, cancellation, and invoice

### List bookings

`GET /bookings/my-bookings` — no body.

Response — `200`, newest first, no pagination:

```json
{
  "success": true,
  "count": 1,
  "data": {
    "bookings": [
      {
        "_id": "507f1f77bcf86cd799439041",
        "user": "507f1f77bcf86cd799439011",
        "services": [
          {
            "service": {
              "_id": "507f1f77bcf86cd799439021",
              "name": "Home cleaning"
            },
            "quantity": 2,
            "price": 50
          }
        ],
        "totalAmount": 100,
        "status": "Pending",
        "paymentStatus": "Paid",
        "serviceDate": "2026-09-24T00:00:00.000Z"
      }
    ]
  }
}
```

### Get one booking

`GET /bookings/{bookingId}` — no body.

Response — `200`: `{ "success": true, "data": { "booking": ... } }`, with the booking fields illustrated in section 7. Both `user` and `services[].service` are populated. This endpoint only reads the database; it does not reconcile Stripe payment status.

Use each booking line's stored `price` for its purchased unit price; the populated service's current catalog price may have changed.

| Field | Allowed values |
| --- | --- |
| `status` | `Pending`, `Confirmed`, `In Progress`, `Completed`, `Cancelled` |
| `paymentStatus` | `Pending`, `Paid`, `Failed` |

Show payment and booking statuses separately. Allow for missing/deleted populated services and an empty `assignedTechnician` name/phone.

### Cancel a booking

`POST /bookings/{bookingId}/cancel`

Send `{}` for a normal customer cancellation. The controller also accepts an optional `statusNote`, but it is not a field in the Booking schema.

Response — `200` (relevant fields):

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439041",
      "status": "Cancelled",
      "paymentStatus": "Paid"
    }
  }
}
```

Cancellation is allowed for `Pending` and `Confirmed`; `In Progress`, `Completed`, and already `Cancelled` return `400`. **This endpoint does not issue a Stripe refund or cancel a PaymentIntent.** The payment status is unchanged. Closing PaymentSheet is separate from cancelling the booking.

### Download invoice

`GET /bookings/{bookingId}/invoice` — no body; bearer authentication required.

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Disposition: attachment; filename=invoice-507f1f77bcf86cd799439041.txt
```

The body is plain-text invoice content, not JSON or PDF. Download it as bytes/text and offer save/share. Error responses are JSON. Details, cancellation, and invoice routes check booking ownership (or admin access).

## 9. Error handling and payment recovery

Most API errors use this shape:

```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

Booking validation errors instead return `400` with an `errors` array:

```json
{
  "success": false,
  "errors": [
    { "field": "address", "message": "Address is required" },
    { "field": "services[0].quantity", "message": "Quantity must be at least 1" },
    { "field": "bookingPeriod", "message": "Please select a valid booking period" }
  ]
}
```

| HTTP/result | Meaning and action |
| --- | --- |
| `401` | Missing/expired access token; restore the session and resume using the same saved booking/payment IDs |
| `403` | Booking belongs to another user, or account lacks access |
| `404` on create | `Service with ID <id> not found or inactive`; refresh the selected services |
| `404` on booking APIs | `Booking not found` |
| `400` on verify | `Payment does not match this booking`; check the saved ID pair |
| `400` on verify | `Payment verification failed`; the server marks payment `Failed` whenever Stripe is not yet `succeeded` |
| `500` on create | `Stripe publishable key is not configured on the server` or `Failed to create Stripe payment. Try again.`; report configuration/provider failure |
| `500` on verify | `Stripe is not configured on the server`, or an underlying server/provider error |
| SDK cancellation/card error | Keep cart and booking; allow correction/retry on the existing payment attempt after checking its state |

Recovery rules for this implementation:

1. Save the booking ID and PaymentIntent ID associated with the logged-in user before presenting payment. Keep checkout state isolated between users.
2. If payment succeeds but verification times out, show **“Payment received; checking booking status”**. Read `GET /bookings/{id}` first. If already `Paid`, finish checkout without verifying again.
3. If still unpaid and Stripe is known to have succeeded, retry `/bookings/verify` with the **same IDs**. Do not collect payment again. If the outcome is unknown, reconcile the existing PaymentIntent before another payment attempt.
4. If the app closes before verification, resume the saved attempt after login. There is no Stripe webhook route in this backend to mark the booking paid automatically.
5. There is no API to retrieve the original `clientSecret` in booking details, or create a replacement PaymentIntent for an existing booking. If payment still needs completing after losing the secret, recovery requires backend support; do not silently create another paid order.
6. `POST /bookings` has no idempotency key support. A timeout may occur after creating a booking. Inspect My Bookings and reconcile the attempt before submitting a new booking; creation is not safe to retry blindly.
7. Verification is also not side-effect-free on retry: it resets booking `status` to `Pending` and attempts another email. Stop retrying after observing `Paid`, particularly if admin processing has begun.

## 10. Current backend limits relevant to the app

- **Service variants/addons:** there is no `variantId`, addon selection, coupon, or custom-price field in the booking contract. `Service.price` can be a `{ min, max }` object for differing variant prices, but booking creation assumes a number. Those services need a backend change before checkout can reliably support them.
- **Scheduling:** period-based dates only; no selected time, slot capacity, arbitrary date, or coordinates are stored by this booking controller.
- **Payment configuration:** backend needs `STRIPE_PUBLISHABLE_KEY` and `STRIPE_RESTRICTED_KEY` or `STRIPE_SECRET_KEY` from the same Stripe account/environment. Restricted key takes precedence. Currency defaults to `usd`.
- **Verification checks:** the current handler checks Stripe's success status and compares booking metadata when present. Unlike the detail/cancel routes, it does not check booking ownership or enforce stored order ID, amount, and currency matches. The backend team should address these checks before relying on this endpoint for a production mobile rollout; Flutter must always send the original ID pair.
- **Refunds and reconciliation:** no refund API, webhook reconciliation, or idempotent verification implementation is present in this booking flow.

## 11. Integration acceptance checks

Use a test-configured backend and Stripe test mode to check:

| Scenario | Expected app behavior |
| --- | --- |
| Valid card payment | One booking; verification returns `Paid` + `Pending`; cart cleared |
| Card requires authentication | SDK handles authentication, then app verifies through backend |
| Customer closes payment UI | Cart retained; existing booking remains pending |
| Card declined | Error displayed; no booking success or cart clearing |
| Network loss after Stripe success | Same booking/payment IDs reconciled; no second charge attempt |
| App restart after payment | Recover saved IDs and check database/verify as needed |
| Missing address/invalid quantity | Field validation error displayed |
| Service removed before checkout | Refresh cart after `404` |
| Expired access token | Restore session without creating a second checkout |
| Double tap on Pay | Only one creation/payment operation in flight |
| Booking cancellation | Status becomes `Cancelled`; UI does not claim refund |
| Invoice download | Authenticated `.txt` download opens/shares correctly |

## 12. Repository references

- [React checkout](../frontend/src/pages/Checkout.jsx): create → Stripe confirmation → backend verification → cleanup.
- [Frontend booking service](../frontend/src/services/bookingService.js): active API wrapper used by checkout.
- [Cart context](../frontend/src/context/CartContext.jsx): logged-in cart synchronization and cleanup.
- [Booking routes](../backend/src/routes/bookingRoutes.js) and [controller](../backend/src/controllers/bookingController.js): endpoint contracts and payment logic.
- [Booking validation](../backend/src/middleware/validation.js) and [model](../backend/src/models/Booking.js): required fields and statuses.
- [Service model](../backend/src/models/Service.js): price calculation and variant behavior.
- [Cart controller](../backend/src/controllers/cartController.js): cart response shapes.
- [Stripe configuration](../backend/src/config/stripe.js): backend key selection.
