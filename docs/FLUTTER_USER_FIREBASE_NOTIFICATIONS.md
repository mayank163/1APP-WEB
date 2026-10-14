# Flutter user app: Firebase notifications, APIs, and sockets

This guide targets the customer app (`role: user`) and the backend currently in this repository. FCM tokens are **already stored during login/registration** in `User.fcmTokens`; keep that flow. This integration adds receiving, notification history, read state, navigation, token rotation, and live updates. Firebase Authentication and Firestore are not required for this notification flow. Continue using the backend JWT for API and socket authentication.

## 1. Delivery flow

```text
Backend business action
  -> notificationService.sendToUser(...)
  -> persist Notification in MongoDB
  -> emit notification:new to user:<userId>
  -> load existing User.fcmTokens and send FCM notification + data

Flutter foreground -> socket updates inbox; FCM can show an in-app banner
Flutter background -> system push; tap opens the relevant screen
Flutter cold start -> restore login, process push tap, refresh inbox
```

History is the source of truth. Database insertion happens before socket and push delivery; missing push permissions, no tokens, or an unconfigured Firebase Admin SDK do not prevent persisted history. Push/socket delivery is not a guarantee of receipt. Refresh on startup, resume, and socket reconnection.

## 2. Firebase and platform setup

Run these in the **Flutter project**, not this Node/React repository:

```sh
flutter pub add firebase_core firebase_messaging dio socket_io_client
dart pub global activate flutterfire_cli
flutterfire configure
```

Select the same Firebase project used by the backend service account and register the correct Android application ID and iOS bundle ID. Initialize with generated `firebase_options.dart`. See the official [Flutter setup guide](https://firebase.google.com/docs/flutter/setup).

Android: complete the generated Firebase configuration, use a device/emulator with Google Play services, and request notification permission on Android 13+. iOS: enable Push Notifications and Background Modes (Background fetch and Remote notifications), upload an APNs authentication key in Firebase, and keep Firebase method swizzling enabled. On Apple platforms, wait for an APNs token before FCM token calls; retry later if it is unavailable. Follow [FCM Flutter platform setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started).

Never put the backend service-account JSON or private key in the Flutter app. The generated client configuration is separate from server credentials.

## 3. API contract

Define `apiBaseUrl = https://YOUR_BACKEND_HOST/api` and `socketOrigin = https://YOUR_BACKEND_HOST`. Use HTTPS/WSS in production. Replace all example IDs and tokens with real values.

Every endpoint below requires:

```http
Authorization: Bearer <backend_access_token>
Content-Type: application/json
```

All successful notification API responses below return HTTP 200. Paths include `/api`; do not duplicate it if your HTTP client's base URL already includes `/api`.

| Method | Path | Request | Purpose |
| --- | --- | --- | --- |
| GET | `/api/notifications?page=1&limit=20` | None | History and total unread count |
| PATCH | `/api/notifications/:notificationId/read` | No body required | Mark one owned notification read |
| PATCH | `/api/notifications/read-all` | No body required | Mark all owned notifications read |
| POST | `/api/notifications/token` | `{"token":"FCM_TOKEN"}` | Register a rotated or newly available token |
| DELETE | `/api/notifications/token` | `{"token":"FCM_TOKEN"}` | Remove this device token |

### List response

Example values are illustrative; keys match the backend:

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "recipient": "507f191e810c19729de860ea",
        "recipientModel": "User",
        "sender": "507f191e810c19729de860eb",
        "senderModel": "Admin",
        "type": "booking_status_updated",
        "title": "Booking Confirmed",
        "message": "Your booking has been confirmed.",
        "data": {
          "bookingId": "507f1f77bcf86cd799439012",
          "status": "Confirmed",
          "technicianName": "",
          "technicianPhone": ""
        },
        "isRead": false,
        "createdAt": "2026-10-14T10:00:00.000Z",
        "updatedAt": "2026-10-14T10:00:00.000Z",
        "__v": 0
      }
    ],
    "unreadCount": 1
  },
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Newest entries come first. Defaults: page 1, limit 10; maximum limit 100. `unreadCount` covers the entire account, not just this page. An empty inbox returns `notifications: []`, `unreadCount: 0`, `total: 0`, and `totalPages: 1`. `sender` and `senderModel` can be null. Ignore extra fields such as `__v`.

### Mutation responses

```json
// PATCH /api/notifications/:notificationId/read
{ "success": true, "data": { "notification": { "_id": "507f1f77bcf86cd799439011", "isRead": true } } }

// PATCH /api/notifications/read-all
{ "success": true, "data": { "modifiedCount": 3 } }

// POST /api/notifications/token
{ "success": true, "message": "Notification token registered." }

// DELETE /api/notifications/token
{ "success": true }
```

The mark-one response above is abbreviated: the real `notification` contains the complete document. Read operations are idempotent. Token registration uses `$addToSet`, so repeated registration does not duplicate the same token. DELETE accepts a JSON body; ensure your client sends it.

### Errors

| HTTP | Example message | App behavior |
| --- | --- | --- |
| 400 | `A valid FCM token is required.` | Supply a trimmed nonempty token, at most 4096 characters |
| 400 | `A valid notification ID is required.` | Use the database `_id`, never the FCM message ID |
| 404 | `Notification not found.` | Refresh history; entry is missing or belongs to another account |
| 401 | `Not logged in.` / `Invalid or expired token.` / `Session has been logged out.` | Restore/refresh session, or return to login |
| 403 | `This account is inactive. Please create a new account.` | End the active session flow |

These errors use `{"success":false,"message":"..."}`. Handle network failures, rate limits, and server errors separately; do not treat a failed request as success.

## 4. Actual FCM payload

The server sends notification + data, not a data-only message:

```json
{
  "notification": {
    "title": "Booking Confirmed",
    "body": "Your booking has been confirmed."
  },
  "data": {
    "type": "booking_status_updated",
    "bookingId": "507f1f77bcf86cd799439012",
    "status": "Confirmed",
    "technicianName": "",
    "technicianPhone": "",
    "target": "user"
  }
}
```

All FCM data values are strings. Read the display body from `RemoteMessage.notification?.body`; `message` is the database/socket field name. The server sets Android priority to `high` and APNs sound to `default`.

**Current limitation:** FCM data has no database `notificationId`, `isRead`, or creation timestamp. `RemoteMessage.messageId` is an FCM delivery identifier and cannot be used with the read API. On push arrival/tap, refresh history and use persisted entries for inbox/read operations. Do not guess an entry's ID from booking ID: multiple notifications can reference the same booking.

## 5. Flutter messaging lifecycle

This is a messaging scaffold; wire the callbacks into your existing state management, session, and router. The background handler must be top-level. Cancel stream subscriptions when disposing the notification service, and install listeners only once.

```dart
import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  // Optional lightweight persistence. No navigation or widget updates here.
  // Do not create a second notification for the server's notification payload.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const MyApp()); // Your existing app.
}

class UserPushListeners {
  final subscriptions = <StreamSubscription<dynamic>>[];

  Future<void> start({
    required void Function(RemoteMessage) onForeground,
    required void Function(Map<String, dynamic>) queueNavigation,
    required Future<void> Function(String) saveRefreshedToken,
    required void Function(Object) onError,
  }) async {
    subscriptions.add(FirebaseMessaging.onMessage.listen(onForeground));
    subscriptions.add(FirebaseMessaging.onMessageOpenedApp.listen(
      (message) => queueNavigation(message.data),
    ));
    subscriptions.add(FirebaseMessaging.instance.onTokenRefresh.listen(
      (token) async {
        try {
          await saveRefreshedToken(token);
        } catch (error) {
          onError(error); // Queue a retry scoped to the active account.
        }
      },
      onError: onError,
    ));
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) queueNavigation(initial.data);
  }

  Future<void> dispose() async {
    for (final subscription in subscriptions) {
      await subscription.cancel();
    }
    subscriptions.clear();
  }
}
```

Ask permission at a suitable point in onboarding/settings:

```dart
final settings = await FirebaseMessaging.instance.requestPermission(
  alert: true, badge: true, sound: true,
);
// Handle authorized, provisional, denied, and notDetermined in the UI.
```

Foreground: refresh the inbox and show an in-app banner from `onMessage`. Background: let the OS show the notification. Taps use `onMessageOpenedApp`; cold-start taps use `getInitialMessage`. Queue navigation until session restoration and the router are ready. Background processing cannot update the UI. See [Firebase's receive-message lifecycle](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages).

If native foreground notifications are desired, configure iOS foreground presentation or an Android local-notification channel/plugin and its tap callback. Choose one foreground display owner to prevent duplicate banners. Local-notification taps need their own launch/tap handling; they do not use the FCM tap streams.

## 6. Token lifecycle and HTTP examples

Keep sending `fcmToken` in the existing login/registration flow. The notification token API uses a different field: **`token`**. If permission is granted later or a token rotates, register it with the notification endpoint. Do not block login when token generation fails.

```dart
import 'package:dio/dio.dart';

// Rebuild/update headers whenever the backend access token changes.
final api = Dio(BaseOptions(
  baseUrl: 'https://YOUR_BACKEND_HOST/api',
  headers: {'Authorization': 'Bearer $accessToken'},
));

Future<void> registerRotatedToken(String token) async {
  await api.post('/notifications/token', data: {'token': token});
}

Future<Response<dynamic>> loadNotifications({int page = 1}) => api.get(
  '/notifications', queryParameters: {'page': page, 'limit': 20},
);

Future<void> markRead(String databaseNotificationId) async {
  await api.patch('/notifications/$databaseNotificationId/read');
}

Future<void> markAllRead() async {
  await api.patch('/notifications/read-all');
}

Future<void> removeDeviceToken(String token) async {
  await api.delete('/notifications/token', data: {'token': token});
}
```

Register refresh tokens only for the currently authenticated account. If signed out, retain a pending token locally and register after login; discard retries tied to a previous account. After session restoration, reconcile the current token via POST if necessary; this endpoint is idempotent. When replacing a token, register the new token first, then remove the old one if known.

Logout: stop listeners/retries, remove this device token while the JWT is still valid, disconnect sockets, and clear local session/inbox/navigation state. Existing `POST /api/auth/logout` also accepts `{"fcmToken":"CURRENT_TOKEN"}` and returns `{"success":true,"message":"Logged out successfully."}`; it removes that token and increments `tokenVersion`, invalidating the account's other existing sessions as well. Choose the logout behavior deliberately. Removing a token alone does not log out a session. Handle offline removal failure explicitly to avoid leaving the previous account's token associated with a shared device.

## 7. Socket.IO contract and Flutter client

Use Socket.IO, not a raw WebSocket client. Default server path is `/socket.io`. Connect to the backend origin without `/api`. Authenticate with the **backend access JWT**, not the Firebase token.

| Direction | Event | Payload / behavior |
| --- | --- | --- |
| Client → server | `user:join` | User ID string; joins `user:<id>` only for the authenticated matching customer |
| Client → server | `user:leave` | User ID string; leaves that room |
| Server → client | `notification:new` | Full notification document plus top-level type/title/message/data |
| Server → client | `welcome` | `{"message":"Welcome from Backend"}` |

Joining the customer room is explicit, not automatic. Rejoin on every connection/reconnection; there is no join acknowledgement or historical replay.

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket connectUserNotifications({
  required String origin,
  required String accessToken,
  required String userId,
  required void Function(Map<String, dynamic>) onNotification,
  required void Function() refreshInbox,
  required void Function(dynamic) onConnectionError,
}) {
  final socket = IO.io(origin, IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': accessToken})
      .disableAutoConnect()
      .enableForceNew()
      .build());

  socket.onConnect((_) {
    socket.emit('user:join', userId);
    refreshInbox();
  });
  socket.on('notification:new', (payload) {
    if (payload is Map) {
      onNotification(Map<String, dynamic>.from(payload));
    }
  });
  socket.onConnectError(onConnectionError);
  socket.connect();
  return socket;
}

// Logout/dispose:
// socket.emit('user:leave', userId);
// socket.dispose();
```

On JWT refresh, dispose the old socket and create a connection with the new JWT. Do not repeatedly reconnect using expired credentials. Socket authentication errors include `Authentication required`, `Invalid or expired token`, and `Session has been logged out`.

Example event (document fields abbreviated):

```json
{
  "notification": {
    "_id": "507f1f77bcf86cd799439011",
    "type": "booking_status_updated",
    "title": "Booking Confirmed",
    "message": "Your booking has been confirmed.",
    "data": { "bookingId": "507f1f77bcf86cd799439012", "status": "Confirmed", "technicianName": "", "technicianPhone": "" },
    "isRead": false,
    "createdAt": "2026-10-14T10:00:00.000Z"
  },
  "type": "booking_status_updated",
  "title": "Booking Confirmed",
  "message": "Your booking has been confirmed.",
  "data": { "bookingId": "507f1f77bcf86cd799439012", "status": "Confirmed", "technicianName": "", "technicianPhone": "" }
}
```

Socket `data` retains native JSON types; FCM data is stringified and additionally includes `target`. Normalize both before routing.

## 8. Customer events and navigation

The current customer notification call in `adminController` sends:

| Type | Trigger | Navigation |
| --- | --- | --- |
| `booking_status_updated` | Admin changes booking status | Booking details using `data.bookingId` |
| `technician_assigned` | First technician assignment without a simultaneous status change | Booking details using `data.bookingId` |

If status and technician assignment change together, `booking_status_updated` takes precedence. Status messages cover `Pending`, `Confirmed`, `Assigned`, `On the Way`, `In Progress`, `Checkout`, `Completed`, and `Cancelled`. Do not assume every booking change elsewhere in the backend calls this notification service.

For either type, fetch `GET /api/bookings/:id` before displaying current booking details. Success is `{"success":true,"data":{"booking":{...}}}`. The backend checks ownership and returns 403 for another customer's booking or 404 for a missing booking. Treat push data as a routing hint, not authoritative booking state. Unknown types or missing/invalid IDs should open the inbox. Ignore a non-user `target` in the customer app and verify the active account before navigating.

The backend also has request-scoped `request:join`, `request:leave`, `request:message`, and `request:status` events. They are separate from the customer notification room and are unnecessary for this integration. Do not use admin/technician rooms in the user app.

## 9. Inbox state, duplicates, and read handling

1. Load page 1 after login/session restoration; store rows by database `_id`.
2. Upsert `payload.notification` on socket delivery, then refresh/debounce history to reconcile unread count. Increment locally only for a previously unseen unread ID.
3. Use foreground FCM for the banner and history refresh; use sockets for immediate inbox updates. Avoid also showing a socket banner for the same event. If FCM is unavailable, socket updates still appear in the inbox.
4. Deduplicate FCM callbacks by `RemoteMessage.messageId` when present. That ID cannot deduplicate a socket document against a push because they have no shared event ID in the current contract.
5. Mark an inbox row read with its database `_id`; apply the returned row and refresh unread count. Roll back optimistic changes on failure. Opening a push alone must not mark an arbitrary matching booking notification read.
6. After mark-all succeeds, refresh the inbox/count. A new notification can arrive concurrently, so do not assume the server count remains zero.
7. Refresh on resume/reconnect and when another device may have changed read state. The backend emits no read-state socket event.
8. Reset pagination when refreshing newest entries; merge/deduplicate subsequent pages by `_id`. Clear all account-specific state on logout/account switching.

Optional future backend improvement: send each recipient's persisted `notificationId` in FCM data. This requires changing the current combined multicast design to preserve the correct per-recipient ID. It is not part of the existing API contract.

## 10. Verification checklist

- Confirm the existing login/registration stores this device's token; rotate it and verify POST adds the new token without duplicates.
- Connect with a real user JWT, emit `user:join`, change that user's booking status in admin, and verify `notification:new`, history, and FCM payloads.
- Test foreground, background tap, and terminated-app tap. Verify exactly one visible foreground banner and correct booking navigation after session restoration.
- Disable push permission: socket/inbox updates should still work. Disconnect the socket: push and later history refresh should still work.
- Mark one and all notifications read; test pagination, empty history, invalid IDs, expired JWTs, and another user's notification/booking ID.
- Reconnect and resume after missed updates; confirm authoritative unread count and no duplicate rows.
- Log out/switch accounts on the same device; verify token removal and no stale retries, inbox entries, or navigation.
- Test on physical iOS/Android devices. OS force-stop/swipe-away restrictions can require reopening the app before messaging resumes; see the official receive-message guide above.
- A Firebase Console test verifies device delivery only; it does not create backend history or emit sockets. Use a backend business action to test the full flow.

## Repository references

- [Notification routes](../backend/src/routes/notificationRoutes.js)
- [Notification controller](../backend/src/controllers/notificationController.js)
- [Notification schema](../backend/src/models/Notification.js)
- [Persistence, sockets, and FCM sender](../backend/src/services/notificationService.js)
- [Socket authentication and room handlers](../backend/src/server.js)
- [Customer booking notification triggers](../backend/src/controllers/adminController.js)
- [Login/registration/logout token handling](../backend/src/controllers/authController.js)
- [Firebase Admin configuration](../backend/src/config/firebase.js)

This document provides implementation guidance and integration snippets. No Flutter project is present here, so device delivery and Dart compilation must be validated in the consuming app.
