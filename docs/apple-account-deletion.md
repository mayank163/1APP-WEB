# Apple sign-in and account deletion

Backend-only environment configuration:

- `APPLE_IOS_BUNDLE_ID`: the exact native iOS app bundle ID accepted as the identity token audience. Web Services IDs are not supported. Replaces `APPLE_CLIENT_IDS`; configure this variable before deploying.
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`: Apple developer team and Sign in with Apple key identifiers.
- `APPLE_PRIVATE_KEY`: ES256 .p8 PEM signing key (literal newlines or escaped `\n`). Never ship this in Flutter or commit it.
- `APPLE_TOKEN_ENCRYPTION_KEY`: stable base64-encoded 32 random bytes for AES-256-GCM. Store in your secret manager and back it up; changing it requires migrating existing encrypted grants.
Native iOS authorization only: no web redirect URI, browser callback, or website Apple login is provided. Do not configure `APPLE_REDIRECT_URI`.

## Client contract

1. POST `/api/auth/apple/challenge`, receive `nonce` and `challengeToken`.
2. Request Apple authorization with that nonce and email scope. Collect both the identity token and the single-use authorization code.
3. POST `/api/auth/apple` with `{ identityToken, challengeToken, authorizationCode, fcmToken? }`.
4. The backend verifies Apple's signature, issuer, audience and nonce, exchanges the code, verifies the exchanged identity matches, and stores the encrypted refresh token separately from the profile. Existing users receive the usual session response. New users receive `appleRegistrationToken`; pass it through the existing registration/OTP flow. No Apple refresh token or signing key is returned to the client.

Sending only identity/challenge tokens is no longer supported. Retry a failed consumed code with a fresh Apple authorization.

## Deletion

Authenticated DELETE `/api/auth/me` revokes the saved Apple refresh token before deleting the User document. An Apple HTTP/network failure fails the request and retains the account and token for retry. Successful deletion removes the profile (including passwords, contact details, addresses, bank details, cart and push tokens), avatar object, reviews, chat messages, notifications received by the user, and their support tickets/messages. Review aggregates are recomputed. Access and refresh sessions cannot authenticate after the User document is removed.

For older Apple users with no saved grant, DELETE can include `{ identityToken, challengeToken, authorizationCode }` from a fresh authorization. The Apple subject must match the linked account. Without a saved grant or fresh code the backend still deletes the account, as Apple requires, and returns `appleRevocation: "unavailable"`. The client should tell that user to remove the app from their Apple account's Sign in with Apple settings. Otherwise it returns `appleRevocation: "revoked"` for Apple users.

Operational/financial records (bookings, payments, plan purchases, invoices, withdrawals, offer accounting) remain in this implementation. They may contain personal snapshots and require a defined retention/anonymization policy before claiming complete erasure of all personal data. Technician document/media objects and chat/support attachments also need a separate storage cleanup policy; this endpoint currently deletes only the profile avatar object. Existing inactive accounts are not automatically migrated or erased.

Validation: `node --test backend/test/*.test.js`. Run a staging end-to-end login, OTP signup, deletion, rejected old session, fresh signup, and Apple credential-state check with real server credentials before submission. Mongo/S3/Apple live integration is not exercised by unit tests.

References: https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple and https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens
