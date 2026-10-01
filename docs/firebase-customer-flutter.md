# 1APP Customer Firebase and Notifications (Flutter)

This guide is for the Flutter customer app. It uses the same Firebase project as the backend and technician app. The backend sends Firebase Cloud Messaging (FCM) notifications; Flutter must never contain the Firebase service-account JSON.

## 1. Firebase project setup

Use the Firebase project configured by the backend service account (`app-tech-3a417`, unless the backend team gives you a different project).

### Android

1. Add/register the Android app in Firebase Console using the exact Android application ID from the Flutter project.
2. Download `google-services.json` into `android/app/`.
3. Follow the current FlutterFire/Firebase Android setup for the project’s Gradle version.
4. On Android 13+, request notification permission at runtime.

### iOS

1. Add/register the iOS app using the exact bundle ID from the Flutter project.
2. Download `GoogleService-Info.plist` into `ios/Runner/` and add it to the Runner target in Xcode.
3. In Apple Developer, enable Push Notifications and Background Modes > Remote notifications.
4. Upload an APNs Authentication Key or certificate in Firebase Console > Project settings > Cloud Messaging.
5. Request notification permission before reading the FCM token.

Add packages:

```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^17.0.0
  socket_io_client: ^2.0.3
```

Use versions compatible with the project’s current Flutter and Dart SDK. Run `flutterfire configure` if the project uses FlutterFire CLI; it must select the same Firebase project.

## 2. Initialize Firebase

Initialize Firebase before login or token registration. The background handler must be a top-level function.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Do not navigate here. Persist lightweight data or let the OS show the
  // notification. Route after the user taps it in the main isolate.
}

Future<void> initializeNotifications() async {
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  await FirebaseMessaging.instance.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );
}
```

Configure a local notification channel on Android and show a local notification for foreground messages if the app should display a system banner while open. FCM notification messages are normally displayed by the OS when the app is backgrounded.

## 3. Register the customer device token

The customer must be authenticated before calling the token endpoint. Register after login, on every app start with an existing session, and whenever the token refreshes.

```dart
final messaging = FirebaseMessaging.instance;

Future<void> registerCustomerToken(String accessToken) async {
  final token = await messaging.getToken();
  if (token != null && token.isNotEmpty) {
    await api.post(
      '/notifications/token',
      data: {'token': token},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }

  messaging.onTokenRefresh.listen((newToken) async {
    await api.post(
      '/notifications/token',
      data: {'token': newToken},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  });
}
```

Endpoints are relative to the backend API base URL (for example, `https://api.example.com/api`):

```text
POST   /notifications/token       {"token":"<fcm-token>"}
DELETE /notifications/token       {"token":"<fcm-token>"}
GET    /notifications              notification history and unread count
PATCH  /notifications/{notificationId}/read  mark one customer notification as read
```

All require `Authorization: Bearer <accessToken>`. The backend deduplicates tokens, and one customer may have multiple phones/tablets.

On logout, remove the current token when possible, then clear the local auth/session state. Do not delete the token from Firebase manually.

## 4. Notification payload and routing

The backend sends a visible notification and string-only `data` values:

```json
{
  "notification": {
    "title": "Technician Assigned",
    "body": "Alex has been assigned to your booking."
  },
  "data": {
    "type": "technician_assigned",
    "target": "user",
    "bookingId": "507f1f77bcf86cd799439011",
    "technicianName": "Alex",
    "technicianPhone": "+12025550123",
    "status": "Confirmed"
  }
}
```

Always treat values in `message.data` as strings and parse IDs/status values in the app. On tap, open the booking details screen using `bookingId`; fetch the latest booking from the API rather than trusting notification text.

```dart
void handleNotificationData(Map<String, dynamic> data) {
  switch (data['type']) {
    case 'technician_assigned':
      final bookingId = data['bookingId'] as String?;
      if (bookingId != null) navigator.openBooking(bookingId);
      break;
    case 'booking_status_updated':
      final bookingId = data['bookingId'] as String?;
      if (bookingId != null) navigator.openBooking(bookingId);
      break;
    case 'technician_location_updated':
      final bookingId = data['bookingId'] as String?;
      if (bookingId != null) navigator.openBookingTracking(bookingId);
      break;
  }
}

FirebaseMessaging.onMessageOpenedApp.listen((message) {
  handleNotificationData(message.data);
});

final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
if (initialMessage != null) handleNotificationData(initialMessage.data);
```

Current customer notification type:

| Type | When it is sent | Important data |
| --- | --- | --- |
| `technician_assigned` | Admin assigns a technician to a customer booking | `bookingId`, `technicianName`, `technicianPhone`, `status` |
| `booking_status_updated` | Admin changes the booking status | `bookingId`, `status`, `technicianName`, `technicianPhone` |

Booking statuses currently supported are `Pending`, `Confirmed`, `In Progress`, `Completed`, and `Cancelled`. Route both notification types to the booking details screen and refresh the booking from the API.

The broader notification service also supports these technician/admin types: `new_job`, `job_invitation`, `job_assigned`, `job_rescheduled`, `wallet_payment`, `technician_request_response`, `technician_counter_offer`, and `admin_counter_offer`. Customer apps should ignore types that do not target `user`.

## 5. Notification history

`GET /notifications` returns:

```json
{
  "success": true,
  "data": {
    "unreadCount": 1,
    "notifications": [
      {
        "_id": "notification-id",
        "recipient": "customer-id",
        "recipientModel": "User",
        "type": "technician_assigned",
        "title": "Technician Assigned",
        "message": "Alex has been assigned to your booking.",
        "data": {"bookingId": "booking-id", "status": "Confirmed"},
        "isRead": false,
        "createdAt": "2026-09-24T10:00:00.000Z"
      }
    ]
  }
}
```

Use this endpoint as the source of truth for an in-app notification list. Notifications are saved even when FCM is unavailable or the device was offline.

## 6. Optional Socket.IO realtime updates

FCM is the background/offline channel. For an open app, connect with the same JWT and join the authenticated customer room:

```dart
final socket = IO.io(
  apiSocketUrl,
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': accessToken})
    .disableAutoConnect()
    .build(),
);

socket.connect();
socket.emit('user:join', userId);
socket.on('notification:new', (payload) {
  final data = Map<String, dynamic>.from(payload['data'] ?? {});
  handleNotificationData(data);
  // Refresh the notification list or show an in-app banner.
});
```

Leave the room on logout with `socket.emit('user:leave', userId)`. The server accepts this room only when the authenticated JWT belongs to that customer, so never use another user’s ID.

## 7. Verification checklist

1. Log in as a customer and confirm `getToken()` returns a non-empty token.
2. Confirm `POST /notifications/token` returns `success: true`.
3. Assign a technician to a booking from the admin panel.
4. Confirm the customer receives `technician_assigned` while the app is foregrounded, backgrounded, and terminated.
5. Tap the notification and verify it opens the correct booking using `bookingId`.
6. Confirm `GET /notifications` contains the notification, then mark one ID read and verify other unread notifications remain unread.
7. Test token refresh, logout/login with another customer, Android 13 permission, and iOS APNs delivery.

If FCM delivery fails, first check Firebase project/bundle IDs, APNs configuration, notification permission, backend service-account configuration, and that the token was registered after login. The backend logs invalid tokens and removes them automatically.