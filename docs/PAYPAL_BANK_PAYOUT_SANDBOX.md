# PayPal Enterprise / Hyperwallet bank payout sandbox

## What is implemented

Technicians continue using their onboarding bank accounts. The withdrawal screen does not collect another bank account or PayPal email. Admin approval queues an automatic bank payout in the selected test mode.

Supported backend modes:

| PAYOUT_PROVIDER | Behavior |
| --- | --- |
| manual (default) | Existing manual bank payment workflow |
| hyperwallet-mock | Local simulated automatic payout; no network or provider account needed |
| hyperwallet-sandbox | Hyperwallet REST v4 calls to the fixed Developer Sandbox host |

Live payment hosts and live mode are intentionally not implemented. Do not use production credentials. A PayPal Checkout client ID/secret is not a Hyperwallet username/password/program token.

An Enterprise Payouts program has separate onboarding and funding arrangements. This integration does not debit an ordinary PayPal account or linked bank account. Confirm the program's funding setup with PayPal/Hyperwallet. Direct funding generally uses approved bank transfers: [official funding documentation](https://docs.hyperwallet.com/content/funding/v1/direct-funding/sending-funds).

## A. Test immediately without a provider account

1. Use a dedicated test MongoDB replica set / Atlas database. Mock payouts change test wallet balances, so do not point this mode at production data.
2. Keep `PAYOUT_BANK_ENCRYPTION_KEY` configured as in the Flutter guide.
3. Add to `backend/.env`:

```env
PAYOUT_PROVIDER=hyperwallet-mock
```

4. From `backend/`, run `node scripts/setup-manual-payouts.js`. This creates additive indexes and verifies transaction support.
5. Restart the backend and run the admin/technician web apps normally. The worker starts automatically after database connection.
6. Use a test technician with wallet earnings. Ensure onboarding bank details include account holder, bank name, valid US routing number, account number, and `checking`/`savings` account type.
7. Request a withdrawal. It appears as `pending` and reserves funds.
8. Open Admin → Technician Payouts. The page must display the SIMULATION banner.
9. Click **Approve test payout**. It changes to `processing` and funds remain reserved.
10. The worker checks jobs every 10 seconds, submitting the fake payment, then reconciling after about 60 seconds. Refresh the admin page or use **Refresh provider status** to queue an earlier check. It then shows `paid` with a `pmt-mock-...` reference.
11. The technician's reserved amount decreases and totalWithdrawn increases once. No real funds move.
12. Refresh provider status again. The withdrawal must not debit the wallet a second time.

The simulated provider is deterministic; it never makes HTTP requests. It is not an end-to-end Hyperwallet test.

## B. Get a Developer Sandbox account

Hyperwallet documents self-registration for its Developer Sandbox, which supplies API credentials: [environments](https://docs.hyperwallet.com/content/api/v4/overview/environments), [official SDK setup](https://github.com/hyperwallet/node-sdk).

Obtain:

- REST API username and password.
- Program token (`prg-...`).
- An **Embedded Straight-Through** bank payout configuration supporting US/USD. Verify this with the program configuration before setting the flag below. A virtual-account or pay-portal funding payment is not the same as delivering money to a bank.
- Test users and active US bank transfer methods.

The adapter is restricted to `https://api.sandbox.hyperwallet.com/rest/v4`. UAT and production hosts require a later explicit implementation; changing an environment URL cannot enable them.

## C. Configure provider sandbox

```env
PAYOUT_PROVIDER=hyperwallet-sandbox
HYPERWALLET_USERNAME=your_sandbox_api_username
HYPERWALLET_PASSWORD=your_sandbox_api_password
HYPERWALLET_PROGRAM_TOKEN=prg-your-sandbox-program
HYPERWALLET_STRAIGHT_THROUGH=true
```

Store credentials in backend environment/secret management only. Do not put them in Flutter, browser settings, source control or chat. Use Node.js 18+ (native fetch and AbortSignal.timeout required).

Restart the backend. The admin page displays HYPERWALLET SANDBOX. Without the required configuration, approval fails; it does not fall back to a manual or simulated payment.

## D. Register and link sandbox recipients

Provider registration happens during setup/onboarding, not during the technician's withdrawal request.

1. Register a sandbox user using the Hyperwallet program portal/API. Set its `clientUserId` to the technician's MongoDB `_id` string and its `programToken` to the configured program. Complete the provider's required identity/address information and activation steps.
2. Register an active US/USD `BANK_ACCOUNT` transfer method for that user, using exactly the onboarding account and routing number. Provider fields map as follows:

| Existing onboarding field | Hyperwallet bank field |
| --- | --- |
| routingNumber | branchId |
| accountNumber | bankAccountId |
| accountType | bankAccountPurpose (`CHECKING` / `SAVINGS`) |
| US | transferMethodCountry |
| USD | transferMethodCurrency |

Legal name/address and other registration requirements depend on the program; do not guess them or split a full name automatically. [Bank account API fields](https://docs.hyperwallet.com/content/api/v4/resources/bank-accounts/update)

3. Save the returned `usr-...` and `trm-...` tokens. On the pending request in Admin → Technician Payouts, click **Link sandbox recipient** and submit those tokens.
4. Alternatively call:

```http
POST /api/admin/technicians/<technicianId>/payout-recipient
Authorization: Bearer <admin JWT>
Content-Type: application/json
```

```json
{
  "userToken": "usr-...",
  "bankToken": "trm-..."
}
```

The backend verifies the provider user belongs to this technician/program, is active, and the bank's full account number, routing number, account type, country, currency and activation match onboarding. Masked or incomplete provider account responses fail closed; resolve the program's API access/registration rather than bypassing verification.

Only admins with `technician_jobs` write access can link recipients. Linking does not send money. Store the linked tokens and a keyed bank fingerprint in `TechnicianPayoutRecipient`.

If onboarding bank information changes, create/link a new provider bank method. Existing withdrawal snapshots and approved destinations do not change. Do not mutate a provider bank transfer method already referenced by an approved payout. A pending request with an outdated destination must be rejected/cancelled and resubmitted after updating the profile.

## E. Approve and reconcile a sandbox bank payout

1. Technician submits a new request normally.
2. Admin approves once. The backend transaction records approval and the queued job together. Response status is `processing`.
3. The worker rechecks the provider recipient/bank before the initial submission.
4. The worker creates a payment to the bank `trm-...` token, not the user's wallet `usr-...` token. It uses `withdrawal-<withdrawalId>` as the stable clientPaymentId.
5. Provider status is periodically fetched. Only matching amount, USD currency, bank destination, program and payment ID can settle the wallet.
6. For the configured Straight-Through bank model, `COMPLETED` marks `paid` and increments totalWithdrawn once. Other in-progress statuses keep funds reserved.
7. No user action is needed to transfer a provider wallet balance to a bank in the supported model. Confirm the program supports this before using the adapter.

[Payments and destinations](https://docs.hyperwallet.com/content/api/v3/resources/payments/create), [current official Node SDK payment operations](https://github.com/hyperwallet/node-sdk)

## Failure and timeout handling

- Worker jobs use database leases so concurrent app instances do not claim the same active job.
- The worker persists an attempt before issuing the payment POST.
- If a response is lost, it looks up the original clientPaymentId. It does not issue another payment POST after an uncertain attempt.
- A crash between recording an attempt and sending it can therefore leave an unresolved job. Reconcile it through the provider/program team; do not create a replacement withdrawal while the first outcome is uncertain.
- Failed, returned, cancelled or expired provider payments are flagged for admin attention. Funds are not automatically released based on a timeout or failure message alone.
- When funds are confirmed undelivered or returned, use **Confirm returned funds**, supply a reason and confirm the checkbox. The backend rechecks a matching terminal provider status before releasing the reservation or reversing a previously paid wallet debit.
- Paid withdrawals are monitored hourly for later provider returns. Unknown statuses retain accounting and require review.
- Existing manual payment buttons cannot override an automatic payout.
- **Refresh provider status** queues reconciliation; it does not submit a new payment. The original provider mode/program must remain configured while jobs are outstanding.

Admin endpoints:

```text
PATCH /api/admin/withdrawals/:id/reconcile
PATCH /api/admin/withdrawals/:id/confirm-returned
```

Return confirmation body:

```json
{ "fundsReturnedConfirmed": true, "reason": "Bank return confirmed and funds recovered" }
```

This sandbox version uses authenticated provider polling, not webhook payloads. No payout notifications or automatic technician registration have been added. User/bank registration is a one-time program setup step described above.

## Tests and verification limits

From the project root:

```bash
node --test backend/tests/bankPayout*.test.js backend/tests/manualPayouts*.test.js
```

Real database concurrency/lifecycle tests require `PAYOUT_TEST_MONGO_URI` pointing to a dedicated replica-set database whose name ends in `_payout_test`.

Adapter tests use stubbed HTTP responses and do not prove your provider program is configured correctly. The provider sandbox flow cannot be exercised until you have credentials and activated recipients. This code has not sent a real provider sandbox payment or a live bank payment.

Before a future production integration, validate the exact program requirements, authentication, recipient verification, status/return semantics, funding and fees with Hyperwallet, complete real sandbox/UAT testing, and add the required production environment and notification setup. This implementation cannot be switched to live mode through an environment variable.
