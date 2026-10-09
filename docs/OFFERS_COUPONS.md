# Offers and coupons

The admin Offers page reads MongoDB through `/api/offers/admin`. There are no seeded coupons or fallback records. Restart the backend after installing this change.

## Runtime

Use MongoDB Atlas or a MongoDB replica set. Coupon quota claims and settlement use transactions spanning offers, per-customer counters, and redemption records. A standalone MongoDB server cannot execute these transactions. The server initializes unique indexes on the three collections on connection.

Promotional images are validated, re-encoded as WebP, and uploaded to the existing configured S3 bucket under `offers/`. Configure the existing AWS upload credentials and `REACT_APP_IMAGE_URL` as for service/blog images. Legacy `/uploads/offers/` images remain supported. Upload limit: 2 MB; JPEG, PNG and WebP only. Images are optional.

Offer currency must match the configured payment currency. Existing checkout defaults to USD. Stripe uses `STRIPE_CURRENCY`; PayPal uses the existing PayPal currency configuration. Percentage caps, minimum order values and flat amounts are denominated in the offer currency. Changing the coupon currency does not change the payment configuration.

## Admin API

All admin routes require an active Admin document, including the existing specialized admin roles, and `offers` read/write permissions.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/offers/admin` | List persisted coupons, counters and effective states |
| GET | `/api/offers/admin/options?customerSearch=...` | Active services/categories; search up to 30 eligible customers |
| POST | `/api/offers/admin` | Create coupon or draft |
| PUT | `/api/offers/admin/:id` | Update coupon |
| PATCH | `/api/offers/admin/:id/status` | Deactivate coupon |
| POST | `/api/offers/admin/image` | Multipart upload, field `image`; returns image path |
| GET | `/api/offers/admin/:id/redemptions?page=1` | Successful redemptions, 20 per page |

Create/update payload example:

```json
{
  "code": "SUMMER30",
  "title": "Summer service deal",
  "description": "Save 30% on eligible services.",
  "image": "",
  "icon": "tag",
  "currency": "USD",
  "discountType": "percentage",
  "discountValue": 30,
  "maximumDiscount": 50,
  "applicability": "all",
  "services": [],
  "categories": [],
  "minimumOrderValue": 100,
  "eligibility": "all",
  "customers": [],
  "startsAt": "2026-11-01T00:00:00.000Z",
  "endsAt": "2026-11-04T00:00:00.000Z",
  "totalLimit": 100,
  "perCustomerLimit": 1,
  "publicationStatus": "active"
}
```

`discountType`: `percentage` or `flat`. `applicability`: `all`, `services`, `categories`, or `minimum`. Category eligibility uses Service.category; work types currently have no relationship to service records in the existing catalog. `eligibility`: `all`, `new` (no previous paid booking), or `selected` (explicit customer IDs). `publicationStatus`: `draft`, `active`, `scheduled`, or `inactive`. Empty total limit or maximum discount becomes `null`. Drafts require a valid unique code but allow incomplete publication fields. Client counters and ownership fields are never accepted.

Active/scheduled publication states derive their effective status from start/end times and successful uses. Scheduled publication becomes active when its start time arrives, without requiring a cron update. Expired/exhausted cannot be selected manually. The admin page refreshes records every minute. The wizard displays IST wall time and sends UTC timestamps.

## Customer checkout

Authenticated customer endpoints:

- `GET /api/offers`: currently published offers, with private customer lists excluded. Final eligibility is checked against the actual cart.
- `POST /api/offers/validate`: `{ "code": "SUMMER30", "paymentProvider": "stripe", "services": [{ "service": "<id>", "quantity": 1, "variantId": "<optional id>", "addonIds": [] }] }`. Returns server-priced subtotal, discount and total; does not reserve capacity.
- `POST /api/bookings`: existing payload plus optional `couponCode`. Reprices catalog services and checks availability, scope, minimum order, currency and customer eligibility again before claiming quota and creating the provider order.
- `POST /api/bookings/payment-attempts/:id/cancel`: cancels unpaid Stripe intent or blocks further server-side PayPal capture before releasing quota. Paid payments must be verified. Razorpay reservations are retained when safe provider cancellation cannot be established.

Global and per-customer limits include temporary pending reservations to prevent overselling. The visible used count includes only verified successful bookings. Successful payment stores a coupon snapshot on both PaymentAttempt and Booking. Retried verification settles the same redemption only once. Deactivating an offer preserves existing booking snapshots and honors previously reserved payment orders. Edits are rejected while an offer has pending payments; codes cannot change after redemption.

Every five minutes, pending coupon attempts older than one hour are reconciled: paid Stripe/PayPal orders are verified into bookings, unpaid orders are cancelled before quota release, and unknown outcomes remain reserved. Failed provider creation releases its reservation. Initializing records without a known provider order require operational investigation after a process/database failure; their quota is deliberately not expired blindly. This job does not replace provider-wide webhook handling.

## Validation

```sh
node --test backend/tests/offerRules.test.js backend/tests/offerService.test.js
CI=true npm test --prefix admin -- --watch=false --runInBand --runTestsByPath src/pages/OfferManagement.test.jsx
npm run build --prefix admin
npm run build --prefix frontend
```

Service tests use a transaction-aware test double; they do not replace a live replica-set/payment-provider integration test.
