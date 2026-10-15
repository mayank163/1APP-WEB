# Flutter technician app: US manual bank withdrawals

## Scope

The technician requests a USD withdrawal using bank details already collected during onboarding. In default manual mode, the admin sends money through their business bank and records the result. Optional automatic test modes queue a simulated or Hyperwallet sandbox bank payout on approval. See [PayPal bank payout sandbox setup](PAYPAL_BANK_PAYOUT_SANDBOX.md). Live automatic payments are not enabled.

API prefix: `<BACKEND_ORIGIN>/api/technician`

All endpoints require `Authorization: Bearer <technician JWT>`. JSON requests require `Content-Type: application/json`. Never embed an admin token in Flutter.

## Screens and sequence

1. Open Wallet: fetch `GET /wallet` and `GET /bank-details`.
2. Display the masked onboarding bank destination. Do not show an add/change-bank form in the withdrawal flow. If details are missing, show a support/profile message and disable new requests.
3. Show available balance, reserved withdrawals, lifetime earnings and paid withdrawals. Format integer cents as USD.
4. Enable a new withdrawal only when a bank exists and availableCents > 0. Allow retrying an unresolved submission with its original key even if the balance has since decreased.
5. Confirm the amount and masked bank destination, then submit the request with a persisted idempotency key.
6. Refresh wallet/history after success, on app resume, and on pull-to-refresh.
7. Display admin status updates in history. The app does not initiate the bank transfer.

## 1. Use the existing onboarding bank account

Bank details are collected during onboarding, not when requesting a withdrawal. Do not call a bank registration endpoint from the wallet screen. The payout backend reads `User.bankDetails` first and captures an encrypted snapshot when a request is created. Previously registered payout-bank records remain a fallback for older clients without onboarding bank details.

The existing onboarding/profile endpoint is `PUT /api/technician-auth/bank-details` (technician JWT; supports its existing multipart upload). It accepts `accountHolder`, `bankName`, `accountNumber`, and now `routingNumber` and `accountType` (`checking` or `savings`) for US accounts. Keep numbers as strings to preserve leading zeros. Bank changes belong to onboarding/profile maintenance and affect future requests only.

Older profiles may lack US routing/account-type fields. Their existing account details can be used to submit a request, but the admin must review and resolve missing information before actually paying. Do not invent routing numbers or treat IFSC as a US routing number. If a destination needs correction, reject/cancel the unsent request, update the profile, and resubmit so its snapshot is correct.

The bank data returned to the wallet is masked:

```json
{
  "success": true,
  "data": {
    "bank": {
      "accountHolder": "Alex Technician",
      "bankName": "Example Bank",
      "accountType": "checking",
      "last4": "6789",
      "version": 1,
      "updatedAt": "2026-10-14T10:00:00.000Z"
    }
  }
}
```

Do not log raw bank details or persist them in wallet storage, analytics, or crash reports.

## 2. Read the registered bank

`GET /bank-details`

Response has the same masked `data.bank` shape above. If no US payout bank is registered, `data.bank` is `null`. This endpoint never returns the full account or routing number.

## 3. Read wallet balances

`GET /wallet`

```json
{
  "success": true,
  "data": {
    "wallet": {
      "currency": "USD",
      "earnedCents": 50000,
      "withdrawnCents": 10000,
      "reservedCents": 15000,
      "availableCents": 25000
    }
  }
}
```

Available = earnings − completed withdrawals − active requests, floored at zero. Pending, approved, processing and sent requests reserve funds. Never add pending withdrawals to available money. These values are based on the backend's existing earnings wallet; they are not a live business-bank balance.

Use `/wallet` as the source of truth for this screen. Monetary values from older `/financials`, `/dashboard`, and `/metrics` fields remain in dollars for compatibility.

## 4. Request withdrawal

`POST /withdraw`

Header: `Idempotency-Key: <unique UUID for this submission>`

```json
{ "amountCents": 12500 }
```

`amountCents` is a positive JSON integer. There is currently no configured business minimum beyond one cent. Only USD bank-transfer withdrawals are supported. Do not submit an arbitrary bank destination, payment method, or bank details in this request.

Success (`201` new request, `200` replay):

```json
{
  "success": true,
  "data": {
    "withdrawal": {
      "_id": "<withdrawalId>",
      "technician": "<technicianId>",
      "amountCents": 12500,
      "amount": 125,
      "currency": "USD",
      "method": "bank-transfer",
      "status": "pending",
      "bankSnapshot": {
        "accountHolder": "Alex Technician",
        "bankName": "Example Bank",
        "accountType": "checking",
        "last4": "6789",
        "version": 1
      },
      "createdAt": "2026-10-14T10:00:00.000Z"
    }
  }
}
```

Other audit/schema fields can be present. Ignore unknown fields.

### Retry rules — required

Generate one UUID when the user confirms a new submission. Persist that UUID and amount in app storage **before** making the HTTP request. Reuse both after a timeout, connection failure, app restart, or ambiguous server failure. Disable repeated taps while submitting.

Do not generate a new key because the first call timed out: the withdrawal may already exist. A retry with the same key/amount returns the existing withdrawal. A key reused with a different amount returns `409`.

Clear the saved pending submission after a successful response. If you receive a definite validation failure, let the user correct it and start a new submission. After an ambiguous failure, resolve the original submission before changing the amount or creating another one. Bank-account replacement does not change the destination of a previously accepted request.

Legacy clients can send numeric `amount` in USD dollars with at most two decimals, but still need the idempotency header. New Flutter code should use `amountCents` only.

## 5. Withdrawal history

`GET /withdrawals?page=1`

```json
{
  "success": true,
  "data": {
    "withdrawals": [],
    "pagination": { "page": 1, "limit": 20, "total": 0 }
  }
}
```

Newest requests come first. Increment page while `page * limit < total`.

Each item includes `_id`, `amount`, optional `amountCents`, `currency`, `status`, `method`, masked `bankSnapshot`, timestamps, and any applicable `transferReference`, `rejectionReason`, or `failureReason`.

Legacy history records may lack amountCents and bankSnapshot. For display only, fall back to `(amount * 100).round()` and “Legacy bank details unavailable”.

| Backend status | Suggested label | Funds reserved? |
| --- | --- | --- |
| pending | Awaiting admin review | Yes |
| approved | Approved — awaiting manual bank transfer | Yes |
| processing | Automatic bank payout processing | Yes |
| sent | Payment sent — awaiting bank completion | Yes |
| paid | Paid | No; included in withdrawn total |
| rejected | Rejected | No |
| cancelled | Cancelled before sending | No |
| failed | Failed / returned | No; admin has confirmed non-delivery or return |

Show rejection/failure reasons and transfer reference when present. “Approved” and “Sent” do not mean the bank payment has completed. For `payout.provider` equal to `hyperwallet-mock` or `hyperwallet-sandbox`, show “Test payout — no real money sent” prominently. Ignore provider tokens in the technician UI. No technician cancellation endpoint is provided. Status refresh is via these APIs; this implementation does not add payout push notifications.

## Dart / Dio example

Dependencies: `dio`, `uuid`, and your app's existing storage layer. Obtain JWTs through your existing authentication flow. Persist idempotency keys separately from the bank details.

```dart
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

final dio = Dio(BaseOptions(
  baseUrl: '$backendOrigin/api/technician',
  headers: {'Authorization': 'Bearer $technicianJwt'},
));

// Parse money text directly to integer cents, without double arithmetic.
int parseUsdCents(String input) {
  final text = input.trim();
  if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(text)) {
    throw const FormatException('Enter a USD amount with up to two decimals');
  }
  final parts = text.split('.');
  final fraction = parts.length == 2 ? parts[1].padRight(2, '0') : '00';
  final cents = int.parse(parts[0]) * 100 + int.parse(fraction);
  if (cents <= 0 || cents > 9007199254740991) {
    throw const FormatException('Invalid amount');
  }
  return cents;
}

// At confirmation: create once and persist {key, amountCents} before sending.
final key = const Uuid().v4();
final amountCents = parseUsdCents('125.00');
// await pendingWithdrawalStore.save(key, amountCents);

final response = await dio.post('/withdraw',
  data: {'amountCents': amountCents},
  options: Options(headers: {'Idempotency-Key': key}),
);
final withdrawal = response.data['data']['withdrawal'];
// await pendingWithdrawalStore.clear();
// Refresh GET /wallet and GET /withdrawals.
// On ambiguous failure: retain stored key + amount and retry those exact values.
```

Handle Dio errors using `error.response?.data['message']`; do not display raw exception strings containing request details.

## Errors

All application errors use `{ "success": false, "message": "..." }`.

| HTTP | Meaning / Flutter handling |
| --- | --- |
| 400 | Invalid bank/amount/key, missing onboarding bank details, or insufficient available balance. Show message and refresh wallet as needed. |
| 401 | Missing/expired session. Follow existing login flow. |
| 403 | Not a technician, or account suspended/inactive. |
| 409 | Idempotency conflict. Do not silently create a new request. |
| 503 | Bank encryption not configured. Show unavailable and contact backend team. |
| 500 / timeout | Outcome may be uncertain. Retain and reuse the idempotency key. |

## Backend deployment requirements

1. Configure `PAYOUT_BANK_ENCRYPTION_KEY` as exactly 64 hex characters (32 random bytes). Generate securely, for example `openssl rand -hex 32`, and add to backend environment/secret management. Never commit it. Back up this key securely; changing it without re-encrypting existing records makes bank data unreadable.
2. MongoDB must support transactions: use Atlas, a replica set, or a sharded deployment. A standalone MongoDB instance is insufficient. There is intentionally no non-transactional fallback.
3. From `backend/`, run `node scripts/setup-manual-payouts.js` to verify configuration/transaction support and create additive indexes. Ensure indexes for `TechnicianPayoutBank` and `TechnicianWithdrawal` are created before accepting traffic (including the technician/requestKey unique index).
4. Existing earnings and totalWithdrawn remain in dollars. Audit historical totals before rollout. Existing pending requests count as reserved; requests without a bank snapshot cannot be approved. Reject those through the admin page, then ask technicians to confirm their onboarding bank details and submit again.
5. Admin page: `#/technician-payouts`. It uses `technician_jobs` read permission for the list, and write permission for bank reveal and actions. Full bank-detail access is audited and responses use no-store.
6. Receipts/uploads are not part of this implementation; bank reference, actor, timestamps and audit history are recorded. The bank remains the source of truth for actual transfers.
7. Run `node --test backend/tests/bankPayout*.test.js backend/tests/manualPayouts*.test.js`. Optional real MongoDB integration tests require `PAYOUT_TEST_MONGO_URI` pointing to a dedicated disposable replica-set test database whose name ends in `_payout_test`.

## Admin API reference (not for the Flutter technician client)

Prefix `/api/admin`, admin JWT required:

- `GET /withdrawals?status=pending&page=1`
- `GET /withdrawals/:id/bank-destination` — full original bank destination; restricted to write permission.
- `PATCH /withdrawals/:id/approve` with `{}`
- `PATCH /withdrawals/:id/reject` with `{ "reason": "..." }`
- `PATCH /withdrawals/:id/cancel` with `{ "reason": "..." }` (approved, unsent requests only)
- `PATCH /withdrawals/:id/mark-sent` with `{ "transferReference": "BANK-REF-123" }`
- `PATCH /withdrawals/:id/mark-paid` with `{ "paymentCompletedConfirmed": true }`
- `PATCH /withdrawals/:id/mark-failed` with `{ "reason": "Returned by bank", "fundsReturnedConfirmed": true }`

In automatic test modes, approval returns `processing` and provider reconciliation updates the final status. Flutter still sends the same withdrawal request and bank destination stays the onboarding bank. Do not show manual bank-payment actions in the technician app.

Never release a sent reservation merely because a transfer is delayed. Repeated identical actions are safe; invalid state transitions return 409. The backend timestamps when the admin records each action.

## Acceptance checklist for Flutter

- Wallet opens with the onboarding bank account and no bank-entry form.
- Missing onboarding bank details show a support/profile message; new withdrawals are disabled.
- Display masked bank details only and clear raw form values after saving.
- Reject invalid amount formats locally, and still display backend validation errors.
- Submit request and show updated available/reserved balances.
- Retry a timed-out request with the same key, including after app restart.
- Paginate history and render every status, including older records.
- Bank changes affect new requests only.
- No full bank numbers in logs, storage, screenshots used for reporting, or analytics.
