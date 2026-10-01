# Plans and Stripe payments: Flutter integration

This guide describes the plan catalog and verified purchase API for the Flutter app. The customer must be signed in before starting a purchase. All API paths below are relative to the backend `/api` base URL.

## Flow

1. Load public plans with `GET /plans`, optionally filtered by category and term.
2. Start a purchase with `POST /plans/purchases`. The backend reads the current plan price and creates a Stripe PaymentIntent.
3. Present Stripe PaymentSheet using the returned publishable key and client secret.
4. After PaymentSheet succeeds, retrieve the PaymentIntent and call `POST /plans/purchases/verify`.
5. Only after verification succeeds, refresh `GET /plans/my-purchases` and show the activated plan.

The app must never send a price, currency, user ID, or payment status to start or verify a purchase. Stripe secret keys must only exist on the backend.

## Authentication and catalog

Send the access token on protected requests:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

`GET /plans` is public. It returns active plans sorted with featured plans first and then by price. Flutter can request all plans or filter the catalog using query parameters:

```http
GET /plans?category=Residential&durationYears=1
GET /plans?category=Business&durationYears=2
```

`category` is optional and accepts `Residential` or `Business`. `durationYears` is optional and accepts whole years from 1 through 10; it filters the underlying `durationMonths` field to an exact year term (for example, `2` matches 24 months). The web plan selector uses 1, 2, and 3 years. Invalid filters return `400`. Omitting either parameter preserves the unfiltered behavior.

The response retains the same shape for filtered and unfiltered requests:

```json
{
  "success": true,
  "count": 1,
  "data": {
    "plans": [
      {
        "_id": "507f1f77bcf86cd799439021",
        "name": "Pro SOS Plan",
        "tagline": "Support for work and home devices",
        "description": "Priority technical support.",
        "price": 1725,
        "currency": "usd",
        "durationMonths": 12,
        "features": ["Coverage for 3 devices", "8 support tickets per year"],
        "isFeatured": true,
        "isActive": true
      }
    ]
  }
}
```

`price` is the total amount charged once for the entire `durationMonths` term. The API's `currency` is the lowercase Stripe currency code. Plan features and price shown in the app should come from this response.

## Start checkout

`POST /plans/purchases`

Request:

```json
{ "planId": "507f1f77bcf86cd799439021" }
```

Response (`201`):

```json
{
  "success": true,
  "data": {
    "planPurchase": {
      "_id": "507f1f77bcf86cd799439031",
      "plan": "507f1f77bcf86cd799439021",
      "planName": "Pro SOS Plan",
      "price": 1725,
      "currency": "usd",
      "durationMonths": 12,
      "status": "pending",
      "paymentIntentId": "pi_example"
    },
    "paymentOrder": {
      "provider": "stripe",
      "id": "pi_example",
      "clientSecret": "pi_example_secret_example",
      "amount": 172500,
      "currency": "usd",
      "publishableKey": "pk_test_example"
    }
  }
}
```

Keep `planPurchase._id` and `paymentOrder.id` together until verification finishes. If the payment UI is canceled, do not show an active plan. Starting checkout again creates another pending purchase; old pending purchases do not grant access.

## PaymentSheet and verification

Add the package and complete its platform-specific Stripe setup:

```sh
flutter pub add flutter_stripe http
```

Example helper; `apiBaseUrl` is the backend origin plus `/api`, and `accessToken` is the signed-in customer's bearer token.

```dart
import 'dart:convert';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> purchasePlan({
  required String apiBaseUrl,
  required String accessToken,
  required String planId,
}) async {
  final headers = {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  };

  final createResponse = await http.post(
    Uri.parse('$apiBaseUrl/plans/purchases'),
    headers: headers,
    body: jsonEncode({'planId': planId}),
  );
  final createBody = jsonDecode(createResponse.body) as Map<String, dynamic>;
  if (createResponse.statusCode != 201 || createBody['success'] != true) {
    throw Exception(createBody['message'] ?? 'Could not start plan checkout');
  }

  final data = createBody['data'] as Map<String, dynamic>;
  final purchase = data['planPurchase'] as Map<String, dynamic>;
  final order = data['paymentOrder'] as Map<String, dynamic>;
  final clientSecret = order['clientSecret'] as String;
  final paymentIntentId = order['id'] as String;

  Stripe.publishableKey = order['publishableKey'] as String;
  Stripe.urlScheme = 'oneapp'; // Register this URL scheme in iOS and Android.
  await Stripe.instance.applySettings();
  await Stripe.instance.initPaymentSheet(
    paymentSheetParameters: SetupPaymentSheetParameters(
      merchantDisplayName: '1App',
      paymentIntentClientSecret: clientSecret,
      returnURL: 'oneapp://stripe-redirect',
    ),
  );
  await Stripe.instance.presentPaymentSheet();

  final intent = await Stripe.instance.retrievePaymentIntent(clientSecret);
  if (intent.status != PaymentIntentsStatus.Succeeded) {
    throw StateError('Stripe payment has not succeeded');
  }

  final verifyResponse = await http.post(
    Uri.parse('$apiBaseUrl/plans/purchases/verify'),
    headers: headers,
    body: jsonEncode({
      'planPurchaseId': purchase['_id'],
      'stripePaymentIntentId': paymentIntentId,
    }),
  );
  final verifyBody = jsonDecode(verifyResponse.body) as Map<String, dynamic>;
  if ((verifyResponse.statusCode != 201 && verifyResponse.statusCode != 200) ||
      verifyBody['success'] != true) {
    throw Exception(verifyBody['message'] ?? 'Payment succeeded but plan verification failed');
  }

  return verifyBody['data']['planPurchase'] as Map<String, dynamic>;
}
```

Treat Stripe cancellation as an interrupted purchase. A Stripe SDK success alone is not confirmation: only a successful backend verification response grants the plan. Keep the purchase and intent IDs until verification returns success so a network interruption can retry verification without creating another payment.

## Customer plan history

`GET /plans/my-purchases` requires a customer token. It returns an array containing only the customer's latest unexpired active plan, or an empty array if there is no active plan. Each item includes the purchased name, price, term, status, `paidAt`, `startsAt`, and `expiresAt`. The app profile should refresh this endpoint after successful verification. Status values in purchase history are `pending`, `active`, `expired`, and `replaced`; pending is not entitlement. A successful purchase replaces any currently active plan, while its purchase record remains available in the admin purchase list. Starting a purchase for the same plan that is currently active returns `409`. A plan becomes active only after the backend checks PaymentIntent ownership, metadata, amount, currency, and succeeded status.

## Errors

| Status | Meaning |
| --- | --- |
| `400` | Missing/invalid IDs or PaymentIntent does not match this purchase |
| `401` | Missing or expired access token |
| `403` | Account is not allowed to purchase plans |
| `404` | Plan is inactive/missing, or purchase does not belong to the user |
| `409` | Stripe payment is not yet succeeded; do not activate the plan |
| `503` | Stripe configuration is unavailable |

Admin-only catalog routes are `GET/POST /plans/admin/plans`, `PUT /plans/admin/plans/{planId}`, `PATCH /plans/admin/plans/{planId}/status`, and `GET /plans/admin/purchases`. They require an admin token with the existing `offers` permission.

## Test checklist

- Active catalog appears without authentication; inactive plans do not appear.
- A customer can buy a plan with Stripe test credentials and verify it.
- Canceled or failed payment leaves the purchase pending and grants no entitlement.
- A second verification call returns the existing purchase instead of extending its term.
- A different customer's token or PaymentIntent cannot verify the purchase.
- The active plan appears in `GET /plans/my-purchases`, customer profile, and the admin purchase list.