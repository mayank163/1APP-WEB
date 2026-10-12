# Flutter Google Sign-In with Firebase

This guide describes Google signup and login from a Flutter app that also uses this project's backend.

## Important: Firebase tokens and the current backend

Firebase Authentication and this app's backend issue different credentials:

- Firebase returns a **Firebase ID token**.
- The current `POST /api/auth/google` and `POST /api/auth/google-signup` endpoints expect a **Google OAuth access token** in `accessToken`.
- Firebase ID tokens cannot be sent as `accessToken` to these endpoints. Google will reject them.
- Firebase sign-in alone does not create the user's account in this app's MongoDB or return this app's access and refresh tokens.

For a Firebase-based integration, update the backend endpoints to accept a Firebase ID token and verify it with the Firebase Admin SDK. Do not trust an email or name sent directly by the app. The backend should derive the user's identity from the verified token. Keep the Firebase Admin service-account credentials on the server, never in the Flutter app.

Suggested backend contract:

| Endpoint | Request | Behavior |
| --- | --- | --- |
| `POST /api/auth/google` | `{ "firebaseIdToken": "...", "fcmToken": "..." }` | Verify the Firebase ID token, find the existing app account by its verified email, and return the app's access/refresh tokens. Return `404` if the app account does not exist. |
| `POST /api/auth/google-signup` | `{ "firebaseIdToken": "..." }` | Verify the token and return the verified `name` and `email`; return `409` if an app account already uses that email. |

The backend should reject tokens for the wrong Firebase project and, where applicable, require a verified email. Keep existing app-account checks such as inactive-account handling.

## Firebase and Flutter setup

1. Create or select a Firebase project and enable **Google** under **Authentication → Sign-in method**.
2. Register the Android and/or iOS app in Firebase. For Android, add the signing certificate SHA-1 and SHA-256 fingerprints. Download the platform configuration files when prompted.
3. From the Flutter project, configure Firebase with FlutterFire CLI:

   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```

   This generates `lib/firebase_options.dart`. Do not commit private service-account credentials.
4. Add compatible versions of `firebase_core`, `firebase_auth`, and `google_sign_in` to `pubspec.yaml`. The example below uses the `google_sign_in` 6.x API.
5. Initialize Firebase before running the app:

   ```dart
   import 'package:firebase_core/firebase_core.dart';
   import 'firebase_options.dart';

   Future<void> main() async {
     WidgetsFlutterBinding.ensureInitialized();
     await Firebase.initializeApp(
       options: DefaultFirebaseOptions.currentPlatform,
     );
     runApp(const MyApp());
   }
   ```

## Sign in with Google using Firebase

The following example returns the Firebase ID token for the app to send to the backend. Handle a `null` Google account as a user cancellation.

```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

final _googleSignIn = GoogleSignIn();
final _firebaseAuth = FirebaseAuth.instance;

Future<String?> signInWithGoogle() async {
  final googleUser = await _googleSignIn.signIn();
  if (googleUser == null) return null;

  final googleAuth = await googleUser.authentication;
  final credential = GoogleAuthProvider.credential(
    accessToken: googleAuth.accessToken,
    idToken: googleAuth.idToken,
  );

  final userCredential =
      await _firebaseAuth.signInWithCredential(credential);
  final user = userCredential.user;
  if (user == null) {
    throw StateError('Firebase did not return a signed-in user.');
  }

  final idToken = await user.getIdToken();
  if (idToken == null || idToken.isEmpty) {
    throw StateError('Firebase did not return an ID token.');
  }
  return idToken;
}
```

Send that token to the Firebase-aware backend endpoint over HTTPS. For example, after the backend contract above is implemented:

```dart
final firebaseIdToken = await signInWithGoogle();
if (firebaseIdToken == null) {
  // The user cancelled Google sign-in.
  return;
}

final response = await dio.post(
  '$apiBaseUrl/api/auth/google',
  data: {
    'firebaseIdToken': firebaseIdToken,
    if (fcmToken != null) 'fcmToken': fcmToken,
  },
);

// Store the app access/refresh tokens returned by the backend using
// secure storage. Do not treat the Firebase ID token as the app JWT.
final appAccessToken = response.data['accessToken'];
final appRefreshToken = response.data['refreshToken'];
```

Use your app's established secure-storage and API-client helpers rather than storing auth tokens in plain preferences.

## Signup flow

Google sign-in authenticates the user's Google identity; it does not supply all fields required by the existing app registration flow. The current regular signup flow asks for a phone number and password and verifies the phone by OTP:

1. Call the Firebase-aware `POST /api/auth/google-signup` endpoint with `{ "firebaseIdToken": "..." }`.
2. If it returns `409`, show **Email is already registered** and direct the user to login.
3. If successful, prefill the signup form with the returned name and email. Ask for the remaining required details, including phone and password.
4. Call `POST /api/auth/start-register` with `{ "name": "...", "email": "...", "phone": "...", "password": "..." }`.
5. Submit the received OTP to `POST /api/auth/verify-register` with `{ "phone": "...", "code": "..." }`.
6. Store the app access/refresh tokens returned by successful verification in secure storage.

The existing signup endpoints do not currently accept a Firebase ID token; step 1 requires the backend change described above. If Google signup should not require a password, the backend's account model and registration flow must also be changed rather than sending a made-up password from Flutter.

## Sign out

Sign out of the Firebase session and clear the app's own tokens/session as well:

```dart
Future<void> signOut() async {
  await _firebaseAuth.signOut();
  await _googleSignIn.signOut();
  // Also call the app's logout/session cleanup and clear its secure tokens.
}
```

## Handle API errors

- `400`: missing/invalid request fields or missing email claim.
- `401`: invalid, expired, or unverifiable Firebase ID token.
- `403`: app account is inactive or otherwise disallowed.
- `404`: Google login identity has no app account; ask the user to sign up.
- `409`: signup email already belongs to an app account; ask the user to log in.
- Network/server errors: show a retryable message; do not mark the user as logged in unless the backend returned valid app tokens.

Never log access tokens, Firebase ID tokens, passwords, or OTPs.
