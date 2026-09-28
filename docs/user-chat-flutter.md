# User Chat Support: Flutter Integration

This document is for the **customer/user Flutter app only**. It explains how an authenticated user opens a support conversation with the admin team, loads messages, sends text or media, receives live replies, and marks messages as read.

## Prerequisites

The user must already be logged in and have a valid JWT access token. Use the logged-in user's MongoDB `_id` as `userId`.

```text
API base URL: https://your-api-domain.com/api
Socket URL:   https://your-api-domain.com
```

For local development:

```text
API base URL: http://localhost:5001/api
Socket URL:   http://localhost:5001
```

Do not put the JWT in a URL query string. Send it in the REST `Authorization` header and Socket.IO authentication payload.

## User Chat Identity

Every user conversation uses:

```json
{
  "participantType": "user",
  "participantId": "<logged-in-user-id>"
}
```

A user can access only their own conversation. The backend rejects another user's ID with HTTP `403`.

## REST Authentication

All chat REST requests require:

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

Recommended Dio setup:

```dart
final dio = Dio(BaseOptions(
  baseUrl: 'https://your-api-domain.com/api',
  headers: {
    'Authorization': 'Bearer $accessToken',
  },
));
```

## Load Conversation

### Request

```http
GET /chat/conversations/user/{userId}/messages?limit=50
```

Example:

```http
GET /api/chat/conversations/user/65f123456789012345678901/messages?limit=50
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

`limit` is optional. The server clamps it between `1` and `100`. To load older messages, pass the oldest currently loaded message's `createdAt` as `before`:

```http
GET /chat/conversations/user/{userId}/messages?limit=50&before=2026-09-24T10:30:00.000Z
```

### Response

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "66f123456789012345678901",
        "participantId": "65f123456789012345678901",
        "participantType": "user",
        "senderId": "65f123456789012345678901",
        "senderRole": "user",
        "receiverId": null,
        "messageType": "text",
        "text": "I need help with my booking.",
        "media": {
          "url": "",
          "key": "",
          "mimeType": "",
          "size": 0
        },
        "readBy": [],
        "createdAt": "2026-09-24T10:30:00.000Z",
        "updatedAt": "2026-09-24T10:30:00.000Z"
      }
    ],
    "hasMore": false
  }
}
```

Messages are returned oldest-to-newest for display. Sort by `createdAt` if needed.

## Send Text Message

Text messages are sent through Socket.IO so the admin receives them immediately.

```text
Event: chat:send
```

Payload:

```json
{
  "participantType": "user",
  "participantId": "<logged-in-user-id>",
  "text": "I need help with my booking."
}
```

The event includes an acknowledgement callback:

```json
{
  "success": true,
  "message": {
    "_id": "66f123456789012345678901",
    "participantType": "user",
    "participantId": "65f123456789012345678901",
    "senderRole": "user",
    "messageType": "text",
    "text": "I need help with my booking.",
    "createdAt": "2026-09-24T10:30:00.000Z"
  }
}
```

Failure acknowledgement:

```json
{
  "success": false,
  "message": "Invalid chat message"
}
```

Text must be trimmed, non-empty, and no longer than 4,000 characters.

## Send Image or Video

Media is sent with REST multipart upload.

```http
POST /chat/conversations/user/{userId}/messages
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Type | Required | Description |
|---|---|---:|---|
| `file` | file | Yes | Image or video attachment |
| `text` | string | No | Optional caption |

Dio example:

```dart
final formData = FormData.fromMap({
  'file': await MultipartFile.fromFile(
    file.path,
    filename: path.basename(file.path),
  ),
  'text': caption.trim(),
});

final response = await dio.post(
  '/chat/conversations/user/$userId/messages',
  data: formData,
);
```

Limits:

- Images: maximum 5 MB after validation.
- Videos: maximum 50 MB.
- Accepted media categories: image and video.
- An image is resized/compressed by the backend and normally returned as WebP.
- HEIC/HEIF images are accepted and converted by the backend when supported.
- A media message may include an optional caption.

Successful response:

```json
{
  "success": true,
  "data": {
    "message": {
      "participantType": "user",
      "participantId": "65f123456789012345678901",
      "senderRole": "user",
      "messageType": "image",
      "text": "Booking screenshot",
      "media": {
        "url": "https://bucket.s3.region.amazonaws.com/chat/user/65f.../file.webp",
        "key": "chat/user/65f.../file.webp",
        "mimeType": "image/webp",
        "size": 182345
      }
    }
  }
}
```

Use `media.url` to render the attachment. Do not construct the S3 URL in Flutter.

## Mark Messages as Read

Call this when the support chat screen opens and whenever a new message is displayed while the screen is active:

```http
PATCH /chat/conversations/user/{userId}/read
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

Response:

```json
{
  "success": true,
  "message": "Messages marked as read."
}
```

The backend marks messages from the admin or other sender as read for the current authenticated user. It does not add a duplicate read entry for the same user.

## Socket.IO Connection

The backend Socket.IO connection requires the JWT in `auth.token`.

Flutter package:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

Connection example:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io(
  'https://your-api-domain.com',
  IO.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setAuth({'token': accessToken})
      .disableAutoConnect()
      .build(),
);

socket.connect();

socket.onConnect((_) {
  socket.emit('chat:join', {
    'participantType': 'user',
    'participantId': userId,
  });
});
```

If the token expires, disconnect the socket, refresh/login again, update `auth.token`, and reconnect.

## Receive Live Messages

Listen for:

```text
Event: chat:message
Payload: { "message": { ...message fields... } }
```

Example:

```dart
socket.on('chat:message', (payload) {
  final message = Map<String, dynamic>.from(payload['message']);

  if (message['participantType'] != 'user') return;
  if (message['participantId'].toString() != userId) return;

  // Add only if _id is not already in the local message list.
  // Then call PATCH .../read when the screen is visible.
});
```

The server broadcasts both user messages and admin replies to the same room. Deduplicate by message `_id`, because the sender receives the Socket.IO event too.

## Typing Indicator

Join the user room first, then send typing events while the user is composing:

```text
Event: chat:typing
```

Payload:

```json
{
  "participantType": "user",
  "participantId": "<logged-in-user-id>",
  "isTyping": true
}
```

Send `isTyping: false` after roughly 700-900 ms without keyboard input and when the input is cleared or the screen closes.

Receive the same event:

```json
{
  "participantType": "user",
  "participantId": "<logged-in-user-id>",
  "senderRole": "admin",
  "isTyping": true
}
```

Show the typing indicator only when `senderRole == "admin"`.

## Leave the Chat Room

When the chat screen is disposed:

```dart
socket.emit('chat:leave', {
  'participantType': 'user',
  'participantId': userId,
});
```

Then remove the `chat:message` and `chat:typing` listeners. Do not create a new Socket.IO connection every time the user sends a message.

## Recommended Flutter Screen Flow

1. Open the Support Chat screen.
2. Read the logged-in user's ID and JWT from the existing auth/session store.
3. Connect Socket.IO and emit `chat:join` after `connect`.
4. Request message history from the user conversation endpoint.
5. Render text, image, and video messages using `messageType`.
6. Call the read endpoint after the history is displayed.
7. Append live `chat:message` events after `_id` deduplication.
8. Use the Socket.IO text event for text and REST multipart for media.
9. Emit typing state with a debounce.
10. Emit `chat:leave` and remove listeners on screen disposal.

## Error Handling

Handle these common responses:

| Status | Meaning |
|---:|---|
| `400` | Invalid message type, empty text, or missing media |
| `401` | Missing, invalid, or expired JWT |
| `403` | User attempted to access another user's conversation |
| `413` | File exceeds the upload limit |
| `500` | Unexpected server or storage error |

For a Socket.IO connection error, show a reconnecting/offline state. Do not silently mark a message as sent unless the acknowledgement returns `success: true` or the media REST request succeeds.

## Important Notes

- The user endpoint is `/chat/conversations/user/{userId}/...`; do not use the technician endpoint for customer support.
- The user must use their own ID in every request and socket event.
- Admin replies arrive through the same `chat:message` event and user room.
- Store messages locally only as a UI cache; the backend is the source of truth.
- Keep the access token secure using the app's existing secure storage solution.
