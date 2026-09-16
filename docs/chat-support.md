# Technician chat support

Chat is an authenticated admin-to-technician conversation. Messages are stored in MongoDB, media is stored in S3, and both clients receive persisted messages over Socket.IO. A conversation is identified by the technician's `User._id`.

## REST API

Use `Authorization: Bearer <access token>` on every endpoint. Admin tokens are accepted for any technician; a technician token can only access its own `technicianId` conversation.

### Get history

`GET /api/chat/conversations/:technicianId/messages?limit=50&before=<ISO-8601>`

Response:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "message-id",
        "technicianId": "technician-id",
        "senderId": "account-id",
        "senderRole": "admin",
        "receiverId": "technician-id",
        "messageType": "text",
        "text": "Hello",
        "media": { "url": "", "key": "", "mimeType": "", "size": 0 },
        "readBy": [],
        "createdAt": "2026-09-15T10:00:00.000Z",
        "updatedAt": "2026-09-15T10:00:00.000Z"
      }
    ],
    "hasMore": false
  }
}
```

The server returns messages oldest-first within the requested page. Send the oldest message's `createdAt` as `before` to load an earlier page.

### Send text, image, or video

`POST /api/chat/conversations/:technicianId/messages` as `multipart/form-data`:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | string | text only | Up to 4,000 characters |
| `messageType` | string | no | `text`, `image`, or `video`; media type is inferred from the file |
| `file` | file | media only | Image up to 5 MB (including HEIC/HEIF; converted to WebP, max 1920px); video up to 50 MB |
| `receiverId` | string | technician only | Optional admin ID for routing/audit |

For Flutter, use `http.MultipartRequest` and add `file` with `MultipartFile.fromPath`. A successful response is:

```json
{ "success": true, "data": { "message": { "_id": "message-id", "messageType": "image", "media": { "url": "https://...", "key": "chat/technician-id/file.ext", "mimeType": "image/jpeg", "size": 12345 } } } }
```

### Mark messages read

`PATCH /api/chat/conversations/:technicianId/read`

Response:

```json
{ "success": true, "message": "Messages marked as read." }
```

## Socket.IO

Connect using `socket_io_client` and send the access token in the handshake:

```dart
final socket = IO.io(apiBaseUrl, IO.OptionBuilder()
  .setTransports(['websocket'])
  .setAuth({'token': accessToken})
  .build());
```

Authentication failure emits `connect_error` and the socket is not allowed to join chat rooms.

### Room events

Join the technician conversation after `connect`:

```dart
socket.emit('chat:join', technicianId);
socket.emit('chat:leave', technicianId);
```

Only admins or the technician identified by `technicianId` can join that room.

### Typing indicator

Client emits:

```json
{ "technicianId": "technician-id", "isTyping": true }
```

Event: `chat:typing`

Server broadcasts to the other clients in the room:

```json
{
  "technicianId": "technician-id",
  "userId": "account-id",
  "senderRole": "admin",
  "isTyping": true
}
```

### Real-time messages

For text, clients may emit `chat:send`:

```json
{ "technicianId": "technician-id", "text": "I can help.", "receiverId": "optional-admin-id" }
```

The optional acknowledgement is `{ "success": true, "message": <message> }` or `{ "success": false, "message": "..." }`.

For images and videos, upload through REST. The server broadcasts the resulting message for both upload paths using `chat:message`:

```json
{ "message": { "_id": "message-id", "technicianId": "technician-id", "messageType": "text|image|video", "text": "", "media": {}, "createdAt": "..." } }
```

The Flutter app should append `chat:message` once and use the acknowledgement only to clear the sending state. Do not emit `chat:send` for media, or the message will be duplicated.