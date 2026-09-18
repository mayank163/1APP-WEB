# 1APP Firebase Notifications

This document covers the Flutter apps and the customer/admin web apps.

## Web setup checklist

Complete these steps for both `frontend` and `admin`:

1. In Firebase Console, open the same Firebase project used by `backend/firebase-service-account.json` (`app-tech-3a417`).
2. Create or open a Web app under Project settings and copy its Firebase config.
3. Add these values to both `frontend/.env` and `admin/.env`: `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`, `REACT_APP_FIREBASE_STORAGE_BUCKET`, `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`, and `REACT_APP_FIREBASE_APP_ID`.
4. In Firebase Console > Project settings > Cloud Messaging > Web configuration, copy the public key into `REACT_APP_FIREBASE_VAPID_KEY`.
5. In Firebase Console > Cloud Messaging, ensure the Cloud Messaging API is enabled.
6. Restart the relevant React dev server or rebuild after changing `.env`; React environment variables are read only at startup.
7. Open the site on `https://` (or `http://localhost` during development), log in, and click the bell. Permission must be requested from that click.
8. If permission was previously blocked, allow notifications in the browser site settings and reload the site. Browsers do not show the prompt again while permission is `denied`.

The browser never receives `firebase-service-account.json`. Only the backend uses that private credential. The web API key and VAPID public key are safe to expose in the React build, but they must belong to the same Firebase project as the backend service account.

## Backend setup

The backend uses Firebase Admin SDK for FCM delivery. Configure one of these on the backend server:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

Alternatively place the Firebase service-account JSON at either supported path:

```text
backend/firebase-service-account.json
backend/src/firebase-service-account.json
```

Do not commit that JSON file. The backend starts without it, but FCM delivery is disabled until credentials are configured.

## Authentication

All notification API calls use the normal 1APP JWT:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The JWT identifies either a technician User account or an Admin account. Tokens are stored against the authenticated account, so the Flutter app must register the token after login and again whenever Firebase rotates it.

## Register the FCM token

Register after login and after `FirebaseMessaging.instance.onTokenRefresh` emits a new token:

```http
POST /api/notifications/token
Authorization: Bearer <accessToken>

{"token":"<fcm-token>"}
```

Remove a token on logout if desired:

```http
DELETE /api/notifications/token
Authorization: Bearer <accessToken>

{"token":"<fcm-token>"}
```

A token is deduplicated server-side. It is okay to call registration more than once.

## Notification history

Load the latest 50 notifications and the unread count:

```http
GET /api/notifications
Authorization: Bearer <accessToken>
```

Response shape:

```json
{
  "success": true,
  "data": {
    "unreadCount": 1,
    "notifications": [
      {
        "_id": "notification-id",
        "recipient": "user-id",
        "recipientModel": "User",
        "type": "job_assigned",
        "title": "Job Assigned",
        "message": "You have been assigned to AC repair.",
        "data": {
          "jobId": "job-id",
          "requestId": "request-id"
        },
        "isRead": false,
        "createdAt": "2026-09-17T10:00:00.000Z"
      }
    ]
  }
}
```

Mark all notifications for the current account as read:

```http
PATCH /api/notifications/read
Authorization: Bearer <accessToken>
```

## FCM payload

The backend sends a visible FCM notification plus string data:

```json
{
  "notification": {
    "title": "Job Assigned",
    "body": "You have been assigned to AC repair."
  },
  "data": {
    "type": "job_assigned",
    "jobId": "job-id",
    "requestId": "request-id"
  }
}
```

All values in `data` are strings. In Flutter, handle `message.data['type']` and route the user to the related job/request using `jobId` or `requestId`.

## Notification types

| Type | Recipient | When it is sent | Important data |
|---|---|---|---|
| `new_job` | Active technicians | Admin creates a job visible to technicians | `jobId` |
| `job_invitation` | Selected technician | Admin invites a technician directly | `jobId`, `requestId` |
| `technician_job_request` | Admins | Technician requests an open job without a bid | `jobId`, `requestId` |
| `technician_counter_offer` | Admins | Technician submits a bid, additional charge, or counter offer | `jobId` or `requestId`, optional `chargeId`, optional `amount` |
| `admin_counter_offer` | Technician | Admin sends a fixed-price counter offer | `jobId`, `requestId` |
| `job_assigned` | Assigned technician | A request/invitation is accepted and the job is assigned | `jobId`, `requestId` |
| `job_rescheduled` | Assigned technician | Admin changes the job date/time window | `jobId`, `jobDateFrom`, `jobDateTo` |
| `wallet_payment` | Technician | Admin approves checkout payment and credits technician earnings | `jobId`, `amount` |
| `technician_request_response` | Admins | Technician accepts or rejects an admin counter offer | `jobId`, `requestId` |

## Realtime Socket.IO delivery

The same notification is emitted through Socket.IO after it is persisted. Connect using the JWT in the handshake:

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
socket.emit('technician:join', technicianId);
socket.on('notification:new', (payload) {
  final notification = payload['notification'];
  // Update the in-app notification list and show a local notification.
});
```

A technician receives notifications in `technician:<technicianId>`. Admin clients join the `admin` room with:

```text
admin:join
```

The server also emits existing job/request events. Keep handling those events for live dashboard refresh; `notification:new` is the user-facing notification channel.

On logout or account switch:

```text
technician:leave <technicianId>
```

## Flutter FCM checklist

1. Add `firebase_core` and `firebase_messaging`.
2. Add the Firebase Android and iOS configuration files for the same Firebase project used by the backend service account.
3. Call `Firebase.initializeApp()` before requesting a token.
4. Request notification permission on iOS and newer Android versions.
5. Register `FirebaseMessaging.instance.getToken()` at login.
6. Register every value from `onTokenRefresh`.
7. Add a top-level background message handler.
8. Show a local notification for foreground messages if desired.
9. On notification tap, route by `type`, `jobId`, and `requestId`.
10. Call the remove-token endpoint on logout when practical.

## Security and behavior notes

- Never ship the Firebase service-account JSON inside Flutter or either web app. Only the backend may hold that credential.
- Firebase web API keys and Flutter client configuration are public project identifiers, but FCM server credentials are private.
- Notification persistence is independent of FCM availability. If a device is offline or has no token, the notification remains available from `GET /api/notifications`.
- Admin notifications are persisted for every active admin and delivered to the authenticated admin room.
- Technician notifications are persisted for the target technician and delivered to that technician's room.
