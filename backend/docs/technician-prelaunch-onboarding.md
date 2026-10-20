# Prelaunch technician onboarding

The website form is available at `/join-as-technician` and linked in the footer.
It posts multipart form data to `POST /api/technician-auth/preregister` with name,
phone, email, address, serviceRadius (1–500 km), and yearsOfExperience (0–80).
The website country code picker defaults to US +1 and submits the full international phone number.
No licence images, licence dates, or profile photo are collected.
It creates an invited technician User with an empty document list and pending verification.
No password or OTP is requested in the form. A cryptographically random password is generated after validation, hashed by the User model, and emailed once after the account is saved. It is never returned in the API response. Phone and email remain unverified; OTP activation is still required before password login. The response includes emailSent; delivery failure preserves the registration and OTP login remains available.
Existing accounts are never overwritten. Details appear in the admin technician list.

## Mobile app integration

The mobile client must implement these calls against the same backend/database:

1. `POST /api/technician-auth/otp-login/send` with
   `{ "type": "phone", "phone": "+919876543210" }` or
   `{ "type": "email", "email": "tech@example.com" }`.
2. `POST /api/technician-auth/otp-login/verify` with the same identity,
   `otp` and optional `fcmToken`.
3. Store the returned `accessToken` and `refreshToken` using the existing secure
   authentication storage. The response uses the existing technician login shape,
   including `data.user`. Route to profile completion or the technician home screen.

Valid OTP verification activates an invited account and signs it in immediately.
It also supports subsequent OTP login for active technician accounts. Suspended,
blocked, inactive and non-technician accounts cannot sign in. Verification only
marks the selected contact verified and does not approve documents or jobs.
Existing password signup/login and password-based activation remain supported.

SMS and email delivery must be configured on the backend. OTPs expire after five
minutes, allow five guesses, and have a 60-second resend cooldown. The current
shared OTP service stores codes in process memory; requests must reach the same
process, and restarts invalidate codes. Use a shared OTP store before running
multiple backend instances without sticky routing.

The website changes do not implement the mobile screens or send launch notices.
