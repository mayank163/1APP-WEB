# Mobile Apple login and signup integration

## Implemented behavior

Apple login and signup are intended for the Flutter mobile app. The website has no Apple sign-in buttons or Apple SDK integration. The API verifies Apple's signed identity token, issuer, audience, expiry and nonce. An existing Apple-linked customer receives the usual app access and refresh tokens. A new customer completes name, phone, password and phone OTP before the Apple identity is attached to their account. Email comes from the verified Apple token, including Hide My Email addresses.

Existing accounts with the same email are not automatically linked: the API returns 409 and the user should sign in using their existing method. Account linking is not implemented. Inactive linked accounts cannot sign in. Apple signup does not create technician or admin accounts.

## Configuration

Backend environment:

```dotenv
APPLE_IOS_BUNDLE_ID=com.example.customer
```

Use the exact native iOS bundle ID. The backend accepts only this audience; web Services IDs and Android browser authorization are unsupported. Existing JWT_SECRET and REFRESH_TOKEN_SECRET must also be configured. Apply the unique partial appleId index through your normal index deployment process before releasing.

No Apple environment variables or Apple Developer return URL are required for the React website.

In Apple Developer, enable Sign in with Apple for the iOS App ID and add the capability to the Runner target and provisioning profile. Configure Apple’s email relay sender if sending mail to private relay addresses.

No Apple private key belongs in Flutter. The backend exchanges authorization codes, encrypts refresh tokens, and revokes stored Apple grants during deletion. Configure the backend secrets described in [Apple account deletion](apple-account-deletion.md).

## Flutter dependencies

Add compatible versions of sign_in_with_apple, dio, and flutter_secure_storage. See the package's platform setup instructions. Show SignInWithAppleButton and handle unsupported platforms and user cancellation.

All routes below are relative to your backend /api base URL and use JSON. This repository contains no Flutter app; integrate the example into your app's auth state and navigation.

## 1. Request a challenge

POST /auth/apple/challenge with an empty JSON body:

```json
{"success":true,"nonce":"random-value","challengeToken":"signed-challenge"}
```

The challenge expires in five minutes. Pass nonce exactly as returned to Apple. Do not hash it for this API: the backend compares the Apple token nonce directly against this value. Start a new flow after expiry.

## 2. Authorize with Apple and send the identity token

```dart
final challenge = (await dio.post('/auth/apple/challenge', data: {})).data;
try {
  final credential = await SignInWithApple.getAppleIDCredential(
    scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
    nonce: challenge['nonce'] as String,
  );
  final identityToken = credential.identityToken;
  if (identityToken == null) throw StateError('Apple returned no identity token');
  final result = (await dio.post('/auth/apple', data: {
    'identityToken': identityToken,
    'authorizationCode': credential.authorizationCode,
    'challengeToken': challenge['challengeToken'],
    // 'fcmToken': currentFcmToken, // optional
  })).data;
  if (result['requiresRegistration'] == true) {
    final name = [credential.givenName, credential.familyName]
        .whereType<String>().where((part) => part.isNotEmpty).join(' ');
    // Keep result['appleRegistrationToken'] in memory.
    // Prefill editable name and read-only result['data']['email'].
    // Navigate to phone/password signup; see step 3.
  } else {
    await secureStorage.write(key: 'accessToken', value: result['accessToken']);
    await secureStorage.write(key: 'refreshToken', value: result['refreshToken']);
    // Update auth state with result['data']['user'], then navigate home.
  }
} on SignInWithAppleAuthorizationException catch (error) {
  if (error.code != AuthorizationErrorCode.canceled) {
    // Display an actionable sign-in error.
  }
}
```

The example assumes initialized dio and secureStorage instances. Handle DioException separately and display response.data.message or validation errors. Do not log identity tokens, challenge tokens, registration tokens, or session tokens.

Apple may provide a name only on the first authorization. Never overwrite an existing name with an empty value. The backend does not trust client-supplied email or Apple user identifiers.

Use the native iOS authorization flow without WebAuthenticationOptions. Show the Apple sign-in button only in the iOS mobile app. Website and Android browser-based Apple login are unsupported.

## 3. Complete new account registration

The response from /auth/apple for a new identity is:

```json
{
  "success": true,
  "requiresRegistration": true,
  "appleRegistrationToken": "signed-registration-ticket",
  "data": { "email": "verified-address@privaterelay.appleid.com" }
}
```

POST /auth/start-register:

```json
{
  "name": "Customer Name",
  "email": "verified-address@privaterelay.appleid.com",
  "phone": "+919876543210",
  "password": "chosen-password",
  "appleRegistrationToken": "signed-registration-ticket"
}
```

Keep the verified email unchanged. Password must contain at least six characters. The registration ticket expires in ten minutes; restart Apple authorization if it expires. This starts the existing five-minute phone OTP registration. Use the same phone value for verification:

POST /auth/verify-register:

```json
{"phone":"+919876543210","code":"123456","fcmToken":"optional-device-token"}
```

On success (201), persist accessToken and refreshToken securely and use data.user as the app user. Never ship a devOtp display in production. Pending registrations are currently stored in server memory; process restarts lose them, and multiple backend replicas need a shared store or sticky routing.

Returning Apple-linked users receive status 200 directly from /auth/apple with success, accessToken, refreshToken, expiresIn, and data.user. Use Authorization: Bearer <accessToken> for protected endpoints. The backend invalidates previous app sessions at login using tokenVersion.

## Errors and acceptance checks

- 400: missing token/challenge, missing verified Apple email, or changed signup email.
- 401: invalid signature, wrong audience/issuer/nonce, expired identity token/challenge/registration ticket.
- 403: inactive account or unsupported account role.
- 409: email already belongs to an existing account; offer existing sign-in.
- 503: missing backend Apple configuration or temporary Apple key-fetch failure.
- Registration validation errors may use errors: [{field, message}].

Test first authorization, returning login, Hide My Email, missing name on repeat authorization, cancellation, expired challenge, invalid signature/nonce/audience, existing-email conflict, phone OTP failure and success, inactive accounts, and session refresh. Confirm that sending appleId or email in the request cannot attach another identity. Test on a provisioned iOS device.

## References

- [Apple environment configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- [Apple public signing keys](https://developer.apple.com/documentation/signinwithapplerestapi/fetch-apple%27s-public-key-for-verifying-token-signature)
- [Flutter Sign in with Apple package](https://pub.dev/packages/sign_in_with_apple)
