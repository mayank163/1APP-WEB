# Technician overview and onboarding

The admin overview uses `GET /api/admin/technicians`. The list includes every technician, uses persisted IDs (or a stable legacy ID), and maps document `pending` to **Under Review** and `not-started` to **Pending**. Filtering, sorting, date range, pagination, profile preview, profile editing, invitations, suspension and restoration are connected to API data.

**Add Technician** is a four-step form with review and success screens. Full name, mobile and primary trade are required. Email, date of birth, professional details and documents are optional. Administrators create accounts without an OTP. The server sets `role: technician`, `accountStatus: invited`, `isPhoneVerified: false`, records the administrator and generates an undisclosed random initial password. User-supplied verification or role flags are ignored. Login and protected access are blocked until activation, and suspended accounts cannot use existing access tokens.

**Assign to Job** accepts an existing pending request for an open job. **Message Technician** posts to an existing job conversation. These reuse the current job workflow; technicians without job requests have an explanatory empty state. **Verify Documents** opens the existing verification page for that technician.

Invitations contain the public activation page URL. Invitation-only sending does not create a technician record; recipients become registered technicians after mobile verification. A failed delivery is shown as failed, including when email is only simulated. If delivery fails after admin creation, the saved account remains available and the admin can resend with **Invite Technician**. The success screen never claims delivery when no invitation was requested.

## Configuration

Set these in `backend/.env` using real provider settings. Do not commit credentials.

```dotenv
TWILIO_SMS_ENABLED=true
TWILIO_ACCOUNT_SID=<Twilio account SID>
TWILIO_AUTH_TOKEN=<Twilio auth token>
TWILIO_PHONE_NUMBER=<SMS-capable sender in international format>
# Alternatively, use TWILIO_MESSAGING_SERVICE_SID instead of TWILIO_PHONE_NUMBER.
TECHNICIAN_ACTIVATION_URL=https://your-frontend-domain/technician-activate
SMTP_HOST=<SMTP host>
SMTP_PORT=587
SMTP_USER=<SMTP username>
SMTP_PASS=<SMTP password>
FROM_EMAIL=<verified sender address>
```

For local development, `TECHNICIAN_ACTIVATION_URL=http://localhost:3000/technician-activate` should point to the **frontend**, not the admin app. Hosting must route `/technician-activate` to the frontend SPA. Set the frontend's `REACT_APP_API_URL` to the backend API.

Real SMS delivery requires a provisioned Twilio sender and an account allowed to send to the destination. Delivery errors are propagated; there is no silent fallback. Explicit local simulation uses `OTP_SIMULATION_ENABLED=true` with a non-production `NODE_ENV`. This logs random codes locally; production ignores that switch. The fixed `999999` bypass has been removed. No real OTP is returned in an HTTP response.

Document uploads use the existing S3 configuration (`AWS_BUCKET_NAME` and credentials used by `backend/src/config/s3.js`). The admin's `REACT_APP_IMAGE_URL` must resolve the stored S3 keys. Each file is limited to 5 MB; JPG, PNG, WebP and PDF are accepted, with images only for profile photos. Uploaded files are cleaned up when account creation fails before saving.

## Existing database: one-time optional-email index migration

The old `users.email_1` unique index allows only one missing email. Before enabling phone-only admin creation, pause registration writes and run from the repository root:

```sh
node backend/scripts/migrate-technician-email-index.js
```

This changes only the email index to `unique + sparse`, preserving uniqueness for provided emails. It stops if explicitly blank/null emails need cleanup. It is safe to rerun after success. The migration has **not** been run against your database by this implementation. New databases use the schema's sparse index automatically.

## Public mobile registration

The existing technician signup endpoints now require **phone OTP**, including clients that previously used email-only verification:

1. `POST /api/technician-auth/send-otp` with `{ "phone": "+919876543210" }`.
2. `POST /api/technician-auth/verify-otp` with `{ "phone": "+919876543210", "otp": "<received code>" }`.
3. `POST /api/technician-auth/complete-signup` with that same phone, name, optional email, password and confirmPassword (at least eight characters). Admin flags cannot bypass verification.

For invitations and admin-created accounts, the new frontend page uses:

- `POST /api/technician-auth/activation/send-otp` with phone.
- `POST /api/technician-auth/activation/complete` with phone, OTP, password and confirmPassword; new recipients also supply their name and optional email. For an existing admin-created technician, saved identity/profile details are preserved.

Phones are normalized to international format. Ten-digit local numbers default to `+91`; other countries require the country code. Legacy ten-digit Indian records are also checked for duplicates. OTPs expire after five minutes, are single-use, and allow five guesses. Resends have a 60-second cooldown; technician OTP endpoints also have an IP rate limit. Verified signup sessions expire after ten minutes.

The existing OTP/session storage is process-local. Run one backend instance for this flow; moving it behind multiple workers requires a shared challenge/session store with atomic consumption. Restarting the backend invalidates pending codes and signup sessions.

## Data and validation limits

Ratings/review counts and performance are `NA` because the current schema has no authoritative source for them. Availability reads the saved `isOnline` field; this change does not add live socket presence tracking. The current shared dashboard header remains in place. The four-step professional-details screen was composed to match the other supplied screens because no step-two reference was included.

Validated locally:

```sh
npm run build --prefix admin
npm run build --prefix frontend
node --test backend/test/*.test.js
CI=true npm test --prefix admin -- --watchAll=false --runInBand --runTestsByPath src/pages/TechnicianOverview.test.jsx
```

Provider delivery, S3 uploads and the index migration require an environment connected to those services; local tests mock external effects. Builds retain unrelated existing lint warnings.
