# Google sign-in and signup for the Flutter mobile app

This guide matches the current Express API. It covers Android and iOS; there is no Flutter project in this repository. Integrate the examples into the mobile app's navigation and auth state.

## Current flow

- **Login:** Google authorization → Google access token → POST /api/auth/google → app session.
- **Signup:** Google authorization → POST /api/auth/google-signup → prefill name/email → collect phone/password → POST /api/auth/start-register → phone OTP → POST /api/auth/verify-register → app session.

Google signup does not immediately create an account. A name, email, phone and password are required, followed by phone OTP verification. Existing accounts are matched by Google email; there is no stored Google subject or separate linking endpoint.

The Google endpoints accept a **Google OAuth access token** in the JSON field accessToken. Do not send a Google ID token, Firebase ID token, authorization code, or your app's JWT in that field. The backend uses the token to call Google's userinfo endpoint.

## What the app owner must provide

| Item | Purpose |
| --- | --- |
| HTTPS API base URL ending in /api/ | Mobile API requests |
| Google Cloud project and OAuth consent configuration | Google authorization |
| Android package name and signing certificate fingerprints | Android OAuth registration |
| iOS bundle ID and iOS OAuth client ID | iOS OAuth registration |
| Web OAuth client ID in the same project | serverClientId used by the mobile Google SDK |
| iOS reversed client ID | Google callback URL scheme |
| Working backend SMS configuration | Signup phone OTP delivery |

Configure the OAuth consent screen with the required email/profile permissions and test users while the project is in testing. Publish the consent configuration as appropriate for release. No Google client secret belongs in the mobile app.

### Android

Register an Android OAuth client using the exact application ID and signing SHA-1. Include each signing configuration you ship: debug, release, and Google Play App Signing where applicable.

Either configure google-services.json and the Google Services Gradle plugin according to the package instructions, ensuring the JSON includes a web OAuth client, or pass that web client ID as serverClientId during initialization. Firebase Authentication is not required by these backend endpoints.

See the official [Android package setup](https://pub.dev/packages/google_sign_in_android).

### iOS

Register an iOS OAuth client for the app's bundle ID. Configure the iOS client ID through GIDClientID in ios/Runner/Info.plist or through the Dart initialization below. Register its reversed client ID in CFBundleURLTypes / CFBundleURLSchemes; passing IDs in Dart does not replace the URL scheme requirement. Merge with existing URL schemes instead of replacing them.

See the official [iOS package setup](https://pub.dev/packages/google_sign_in_ios).

## Flutter dependencies

```sh
flutter pub add google_sign_in dio flutter_secure_storage
```

The examples use the google_sign_in **7.x API**, with GoogleSignIn.instance, initialize(), authenticate(), and authorizationClient. Check SDK compatibility and pin suitable versions in the mobile project. Older 6.x examples using GoogleSignIn().signIn() require migration.

## Initialize once and obtain a Google access token

```dart
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

final googleSignIn = GoogleSignIn.instance;
const googleScopes = <String>[
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Call and await once during app initialization before enabling the button.
Future<void> initializeGoogle() async {
  await googleSignIn.initialize(
    clientId: defaultTargetPlatform == TargetPlatform.iOS
        ? 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com'
        : null,
    serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  );
}

// Call from a user tapping Continue with Google; avoid concurrent requests.
Future<String> obtainGoogleAccessToken() async {
  final account = await googleSignIn.authenticate(scopeHint: googleScopes);
  final authorization =
      await account.authorizationClient.authorizationForScopes(googleScopes) ??
      await account.authorizationClient.authorizeScopes(googleScopes);
  return authorization.accessToken;
}
```

Authentication and authorization are separate in version 7. The ID token from account.authentication is not the access token required here. Use the [official package documentation](https://pub.dev/packages/google_sign_in) for authorization and migration details.

## API client and session storage

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final dio = Dio(BaseOptions(
  baseUrl: 'https://YOUR_API_HOST/api/',
  connectTimeout: const Duration(seconds: 15),
  receiveTimeout: const Duration(seconds: 20),
  headers: {'Content-Type': 'application/json'},
));
const secureStorage = FlutterSecureStorage();

Future<Map<String, dynamic>> postJson(
  String path, Map<String, dynamic> body,
) async {
  final response = await dio.post<Map<String, dynamic>>(path, data: body);
  return response.data!;
}

Future<void> saveSession(Map<String, dynamic> result) async {
  if (result['success'] != true ||
      result['accessToken'] is! String ||
      result['refreshToken'] is! String) {
    throw StateError('Incomplete app session response');
  }
  await secureStorage.write(key: 'accessToken', value: result['accessToken']);
  await secureStorage.write(key: 'refreshToken', value: result['refreshToken']);
  // Update app auth state with result['data']['user']; navigate after storage.
}
```

Use relative paths without a leading slash so /api/ stays in the base URL. Store the app tokens securely. Keep the Google access token transient and never log credentials or tokens.

## Login

```dart
Future<Map<String, dynamic>> loginWithGoogle({String? fcmToken}) async {
  final googleAccessToken = await obtainGoogleAccessToken();
  final result = await postJson('auth/google', {
    'accessToken': googleAccessToken,
    if (fcmToken != null && fcmToken.isNotEmpty) 'fcmToken': fcmToken,
  });
  await saveSession(result);
  return result;
}
```

Request: POST /api/auth/google

```json
{"accessToken":"GOOGLE_OAUTH_ACCESS_TOKEN","fcmToken":"OPTIONAL_DEVICE_TOKEN"}
```

Success (200):

```json
{
  "success": true,
  "accessToken": "APP_ACCESS_JWT",
  "refreshToken": "APP_REFRESH_JWT",
  "expiresIn": "7d",
  "data": { "user": { "_id": "USER_ID", "name": "Customer", "email": "customer@gmail.com", "role": "user" } }
}
```

expiresIn is environment-dependent; this is an illustrative response. Use the actual response/user data. A 404 means no account exists for that Google email: offer signup. A 403 means login is blocked; display the message instead of starting signup automatically.

## Signup: prefill Google details

```dart
Future<Map<String, dynamic>> beginGoogleSignup() async {
  final googleAccessToken = await obtainGoogleAccessToken();
  final result = await postJson('auth/google-signup', {
    'accessToken': googleAccessToken,
  });
  return Map<String, dynamic>.from(result['data'] as Map);
}
```

POST /api/auth/google-signup uses the same accessToken request field. Success (200):

```json
{"success":true,"data":{"name":"Customer Name","email":"customer@gmail.com"}}
```

Prefill the signup form with these values. Ask for any missing name, the phone number including country code, and a password of at least six characters. Keep the Google email unchanged in this UI so the resulting account matches future Google login.

A 409 means the email is already registered: offer Google login using the selected account. This endpoint returns no app session and no registration ticket.

## Signup: send phone OTP and create the account

POST /api/auth/start-register:

```json
{
  "name": "Customer Name",
  "email": "customer@gmail.com",
  "phone": "+919876543210",
  "password": "CUSTOMER_CHOSEN_PASSWORD"
}
```

```dart
Future<Map<String, dynamic>> sendSignupOtp({
  required String name,
  required String email,
  required String phone,
  required String password,
}) => postJson('auth/start-register', {
  'name': name.trim(),
  'email': email.trim().toLowerCase(),
  'phone': phone.trim(),
  'password': password,
});

Future<void> finishGoogleSignup({
  required String phone,
  required String code,
  String? fcmToken,
}) async {
  final result = await postJson('auth/verify-register', {
    'phone': phone.trim(),
    'code': code.trim(),
    if (fcmToken != null && fcmToken.isNotEmpty) 'fcmToken': fcmToken,
  });
  await saveSession(result);
}
```

start-register returns success, message and phone. Show the OTP screen only after that request succeeds. Never show devOtp in production.

POST /api/auth/verify-register:

```json
{"phone":"+919876543210","code":"123456","fcmToken":"OPTIONAL_DEVICE_TOKEN"}
```

Use the same phone string throughout. Successful verification returns 201 with the same app session structure as login. Only then consider the account created and navigate into the app.

Pending registration expires after five minutes. On expiry, restart signup. To send a fresh registration OTP, repeat start-register with the full registration details; do not assume the general resend-otp endpoint handles pending registrations. Do not persist the chosen password. Pending registrations currently live in server memory, so a restart loses them and multiple replicas require shared storage or sticky routing.

## Errors and UI behavior

Catch GoogleSignInException around the Google flow. For GoogleSignInExceptionCode.canceled, restore the idle button without displaying a login failure. Display an actionable message for other errors. On Android, recurring cancellation after account selection may indicate an incorrect package name, signing fingerprint or serverClientId.

Catch DioException separately. Read response.data.message when present; registration validation may instead return errors: [{field, message}]. Handle network timeouts without marking a user authenticated. Disable buttons while requests are pending and restore them in finally.

| Endpoint / status | Meaning and action |
| --- | --- |
| Google endpoints / 400 | Missing accessToken or missing Google email; restart authorization or show message |
| Google endpoints / 401 | Invalid Google access token; authorize again |
| Google login / 404 | No matching account; offer signup |
| Google login / 403 | Inactive or restricted account; display backend message |
| Google signup / 409 | Existing email; offer login |
| start-register / 400 | Existing email/phone or invalid form; display message/errors |
| verify-register / 400 | Missing, invalid or expired OTP/pending registration; retry or restart as appropriate |
| Any endpoint / 429 or 5xx | Rate limit or server failure; show retry guidance |

## Restore, refresh and logout

- On app startup, read the stored app access token and call GET /api/auth/me with Authorization: Bearer <APP_ACCESS_JWT> to restore the user.
- POST /api/auth/refresh-token with {"refreshToken":"APP_REFRESH_JWT"} obtains a new accessToken. This endpoint currently does not rotate or return the refresh token, so retain the stored refresh token. Retry the original request once; prevent refresh loops. Clear the local session if refresh is rejected.
- A new login revokes previous app sessions through tokenVersion. A revoked session cannot be restored by refreshing it.
- POST /api/auth/logout with the app Bearer token and optional fcmToken, then clear locally stored app tokens and auth state. Also call googleSignIn.signOut() to end the local Google SDK session. If the network logout fails, clear local state and explain that server logout could not be confirmed.
- Do not call Google disconnect() on every logout; disconnect revokes Google authorization and should be a deliberate separate action.

## Current backend limitations

This guide documents the existing implementation; it does not change authentication behavior. Google login uses Google's userinfo response email to find the account. It does not currently validate a configured OAuth client audience, explicitly check email_verified, or store Google's stable sub identifier. Google signup only prefills details: the later registration requests are not cryptographically bound to that Google authorization, and signup does not mark the Google email as verified. Do not describe this flow as verified Google identity linking. Hardening those properties requires backend changes and an updated API contract.

## Acceptance checks

Test existing-account login, new signup through OTP, existing-email conflict, duplicate phone, expired/invalid OTP, missing name, Google cancellation, revoked Google consent, invalid access token, network failure, logout, session restore and login from a second device. Test Android debug and release signing plus an iOS device. Verify that no app session is saved before successful login or OTP verification.

The examples were checked against the repository's API handlers and the official package documentation; they have not been compiled or device-tested in a Flutter project.
