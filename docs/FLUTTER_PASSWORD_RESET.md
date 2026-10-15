# Flutter forgot password and resend OTP

Use your backend base URL ending in `/api`, for example `https://your-api.example.com/api`. All requests below are public POST requests with `Content-Type: application/json`; no login token is needed. Use HTTPS in production. Android emulators access a locally running backend through `10.0.2.2`, rather than `localhost`.

## API contract

### 1. Request a password reset

`POST /auth/forgot-password`

```json
{"identifier":"+919876543210"}
```

`identifier` can also be the registered email address. SMS is always sent to the account's registered phone, including when an email is entered. The server additionally attempts email delivery when an email is registered; email failure does not block a successful SMS request.

Success (HTTP 200):

```json
{
  "success": true,
  "message": "OTP sent to registered phone +919876543210",
  "phone": "+919876543210",
  "expiresIn": 300,
  "resendAfter": 60
}
```

Keep the returned `phone` unchanged for the reset request. Keep the original `identifier` for resending. Start a 60-second resend countdown and open the six-digit OTP screen.

### 2. Resend the reset OTP

`POST /auth/resend-otp`

```json
{"identifier":"+919876543210"}
```

Use the same identifier as the original request. This endpoint is specifically for password reset. Its response matches forgot-password. After success, clear the entered OTP and restart both timers. The new OTP replaces the previous code. Resend is permitted after 60 seconds; a code lasts five minutes. The server enforces the cooldown even when the app is restarted. Do not automatically retry SMS requests.

### 3. Reset the password

`POST /auth/reset-password`

```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "newPassword": "your-new-password"
}
```

Send the `phone` returned by step 1, the latest six-digit OTP as a string, and a password with at least six characters. Confirm passwords match in the app before submitting.

Success (HTTP 200):

```json
{"success":true,"message":"Password reset successfully"}
```

OTP validation occurs in this request; there is no separate public reset-OTP verification endpoint. A successful OTP check consumes the code. After success clear the reset state and navigate to login. Do not automatically log the user in. OTP verification permits at most five attempts.

## Dart service

Add the Flutter `http` package to your project. This service uses `dart:convert` and `package:http/http.dart`.

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ResetApiException implements Exception {
  final int statusCode;
  final String message;
  ResetApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

class PasswordResetApi {
  final String baseUrl; // Ends with /api; no trailing slash.
  final http.Client client;
  PasswordResetApi(this.baseUrl, this.client);

  Future<Map<String, dynamic>> _post(
    String path, Map<String, String> body,
  ) async {
    final response = await client.post(
      Uri.parse('$baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 30));
    Map<String, dynamic> data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ResetApiException(response.statusCode, 'Unexpected server response');
    }
    if (response.statusCode != 200 || data['success'] != true) {
      throw ResetApiException(
        response.statusCode, data['message'] as String? ?? 'Request failed',
      );
    }
    return data;
  }

  Future<Map<String, dynamic>> forgotPassword(String identifier) =>
      _post('/auth/forgot-password', {'identifier': identifier.trim()});

  Future<Map<String, dynamic>> resendOtp(String identifier) =>
      _post('/auth/resend-otp', {'identifier': identifier.trim()});

  Future<Map<String, dynamic>> resetPassword({
    required String phone,
    required String otp,
    required String newPassword,
  }) => _post('/auth/reset-password', {
    'phone': phone,
    'otp': otp.trim(),
    'newPassword': newPassword,
  });
}
```

Create one service with your API URL and an `http.Client`, and close the client when its owner is disposed. Disable each submit button while its request is pending. Catch `ResetApiException` to display its message; also handle timeouts and network exceptions with a retry message. A timeout can occur after SMS was accepted, so let the user wait for the message before manually resending.

## Screen state and errors

- Forgot-password screen: accept phone/email, call `forgotPassword`, retain identifier and returned phone, and navigate to OTP entry.
- OTP screen: accept exactly six digits, offer resend after `resendAfter` seconds, clear old digits on successful resend, and pass the latest code to the new-password screen. Use a deadline and recalculate the remaining time when the app resumes; cancel timers in `dispose`.
- Password screen: require matching passwords of at least six characters, call `resetPassword`, then return to login.
- HTTP 400: missing/invalid identifier, invalid phone, weak password, or invalid/expired OTP. Display the server message.
- HTTP 404: no matching account. Let the user correct their identifier.
- HTTP 403 during reset: inactive account.
- HTTP 429: wait 60 seconds before another resend and disable the button during that wait.
- HTTP 502/503 or provider errors: SMS delivery could not be started. Display the response message; do not claim delivery succeeded.

## Backend configuration and limitations

Real SMS requires `TWILIO_SMS_ENABLED=true`, valid Twilio credentials and sender configuration, and `OTP_SIMULATION_ENABLED=false`. Restart the backend after environment changes. Twilio acceptance does not guarantee handset delivery. Trial/account restrictions may require verifying the recipient.

Only explicit development simulation can return `devOtp`; never display or depend on it in production Flutter builds. Do not log OTPs or passwords.

OTP storage is currently in process memory. Backend restarts invalidate codes, and multiple backend instances need shared OTP storage before this flow can work reliably across instances.

## Manual verification

1. Request an OTP for a registered test account and confirm receipt.
2. Resend immediately: expect HTTP 429.
3. Wait 60 seconds and resend: expect HTTP 200 and a new SMS.
4. Try the old code: expect rejection. Submit the latest code and a valid new password: expect success.
5. Try reusing the code: expect rejection. Confirm login works with the new password.
6. Test unknown accounts, expired codes, and network/provider failures.
