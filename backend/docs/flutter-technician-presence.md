# Flutter: technician online status and last active time

## Backend contract

Presence is implemented in this repository. Deploy/restart the updated backend before testing Flutter. Existing records need no manual migration: `lastActiveAt` defaults to null until the first connection. Older clients become online on connection but must implement the heartbeat to remain online.

“Online” means the authenticated technician app is connected and has contacted the backend recently. It does not mean available for a new job or prove that the person is interacting with the screen. `lastActiveAt` is the last confirmed socket connection/heartbeat, preserved after disconnection. Job availability and account status remain separate.

- Connect to the backend origin, e.g. `https://api.example.com`, **without `/api`**.
- Socket.IO default namespace `/`, default transport path `/socket.io/`.
- Use Socket.IO, not a raw WebSocket client.
- Send the existing technician login JWT in handshake `auth.token`.
- The server derives technician identity from that JWT. Do not send a technician ID, timestamp, or online flag in heartbeat data.
- Send `technician:heartbeat` with `{}` every **30 seconds** while connected.
- Connect and every accepted heartbeat save server UTC `lastActiveAt` and `isOnline: true`.
- Heartbeats less than 10 seconds apart are acknowledged as throttled without a database write.
- A technician is offline after the last live tab/device disconnects. One device closing does not sign out other devices.
- Without heartbeats, online presence expires after **90 seconds**. Database cleanup and admin notification run every 15 seconds, so timeout notification may take up to about **105 seconds** from last contact. Admin rendering and list API also reject expired timestamps.
- Unexpected process termination is recovered through the same expiry rule; it does not reset the recorded last contact.

### Heartbeat acknowledgement

Request: `socket.emitWithAck('technician:heartbeat', {}, ack: ...)`.

Successful acknowledgement:

```json
{
  "success": true,
  "technicianId": "<MongoDB User._id>",
  "isOnline": true,
  "lastActiveAt": "2026-10-19T09:20:00.000Z"
}
```

Rate-limited acknowledgement: `{ "success": true, "throttled": true }`.
A database failure returns `{ "success": false, "message": "Presence update failed" }`; a revoked/inactive session can return `{ "success": false }` and disconnect. Retry transient failures on the next scheduled heartbeat. Do not present a throttled acknowledgement as a new persisted timestamp.

The initial connection records presence automatically. `technician:join` is not needed for presence; keep your existing room subscriptions for other technician features.

## Flutter implementation

Use one authenticated socket for the app, shared with chat and job notifications where possible. If there is already a shared socket, add the heartbeat timer to that service rather than creating a second socket. Dispose it on logout, and reconnect using the new token after login/token replacement.

The [socket_io_client package documentation](https://pub.dev/packages/socket_io_client) lists version 3.x as compatible with Socket.IO server 4.7+; this backend uses Socket.IO 4.8.3. Native Flutter requires the WebSocket transport. The package documentation also explains disabling automatic connection before calling `connect()` and avoiding cached authentication with `forceNew`.

```yaml
# pubspec.yaml
dependencies:
  socket_io_client: ^3.1.6
```

Align indentation with your existing `dependencies:` section, then run `flutter pub get`.

Example app-wide service (the example intentionally closes its socket when the app is backgrounded):

```dart
import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class TechnicianPresenceService with WidgetsBindingObserver {
  IO.Socket? _socket;
  Timer? _heartbeatTimer;
  bool _foreground = true;

  void start({required String serverOrigin, required String token}) {
    stop(); // Also use start again when authentication changes.
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    _foreground = state == null || state == AppLifecycleState.resumed;

    final socket = IO.io(serverOrigin, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'forceNew': true,
      'reconnection': true,
      'reconnectionDelay': 2000,
      'auth': {'token': token},
    });
    _socket = socket;

    socket.onConnect((_) {
      if (!_foreground) {
        socket.disconnect();
        return;
      }
      _sendHeartbeat();
      _heartbeatTimer?.cancel();
      _heartbeatTimer = Timer.periodic(
        const Duration(seconds: 30), (_) => _sendHeartbeat(),
      );
      // Rejoin your existing job/chat rooms here on every reconnection.
    });
    socket.onDisconnect((_) {
      _heartbeatTimer?.cancel();
      _heartbeatTimer = null;
    });
    socket.onConnectError((error) {
      // Route this to your existing auth/network error handler.
      // Expired/revoked credentials require reauthentication, then start(new token).
      // Never log the JWT.
    });

    if (_foreground) socket.connect();
  }

  void _sendHeartbeat() {
    final socket = _socket;
    if (!_foreground || socket == null || !socket.connected) return;
    socket.emitWithAck('technician:heartbeat', <String, dynamic>{},
      ack: (dynamic response) {
        // Optional: inspect response['success'] for diagnostics.
        // Continue the timer on transient errors; missing ACKs don't prove logout.
      },
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _foreground = true;
      final socket = _socket;
      if (socket != null && !socket.connected) socket.connect();
      _sendHeartbeat();
    } else if (state == AppLifecycleState.paused ||
               state == AppLifecycleState.hidden ||
               state == AppLifecycleState.detached) {
      _foreground = false;
      _heartbeatTimer?.cancel();
      _heartbeatTimer = null;
      _socket?.disconnect();
    }
    // Ignore transient inactive states, such as system dialogs.
  }

  void stop() {
    WidgetsBinding.instance.removeObserver(this);
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _socket?.dispose();
    _socket = null;
    _foreground = false;
  }
}
```

Create this service once after `WidgetsFlutterBinding.ensureInitialized()` and start it after technician login/session restoration:

```dart
final presence = TechnicianPresenceService();
presence.start(serverOrigin: apiOrigin, token: technicianJwt);
// On logout / session replacement / app service teardown:
presence.stop();
```

Use your deployed HTTPS backend origin on a real phone. `localhost` on a phone points to the phone, not your development computer. Ensure Android has the INTERNET permission. Use your existing environment configuration for development URLs.

If the product keeps a shared socket running in the background for other features, coordinate lifecycle handling in that shared service. Do not disconnect a second owner's socket. Stopping heartbeats alone expires presence after the timeout; mobile operating systems can suspend timers and sockets, so ordinary Dart timers do not guarantee background presence.

## Admin integration (already implemented in the React admin)

`GET /api/admin/technicians`, with normal admin authentication and `technician_jobs` read permission, includes these fields inside each technician record in `data.technicians`:

```json
{
  "_id": "<MongoDB User._id>",
  "technicianId": "TK-...",
  "isOnline": false,
  "lastActiveAt": "2026-10-19T09:20:00.000Z"
}
```

`lastActiveAt` can be null. Display “No activity recorded” then; do not substitute account creation or profile update times. Parse UTC timestamps and convert to the viewer's local timezone for display.

Authorized admin sockets automatically join a private presence room and receive `technician:presence`:

```json
{
  "technicianId": "<MongoDB User._id>",
  "isOnline": false,
  "lastActiveAt": "2026-10-19T09:20:00.000Z"
}
```

**Event `technicianId` matches list `_id`, not the human-readable `TK-...` identifier.** Merge the fields into the matching record. Fetch the list on initial load and every reconnect because events missed while disconnected are not replayed. Technician/customer sockets do not receive these admin events. Presence messages are never broadcast to all clients.

## Verification checklist

1. Open the admin technician list. Log in on Flutter: the technician should become Online.
2. Leave Flutter open for over two minutes: 30-second heartbeats should maintain Online.
3. Background or log out of Flutter: the last device disconnect should show Offline and last active time.
4. Disable the phone's network or force-stop the app: presence should become Offline after transport disconnect or heartbeat expiry, within about 105 seconds under normal server operation.
5. Sign in on two devices: closing one should keep the technician Online while the second continues sending heartbeats.
6. Restore the network/resume the app: reconnect and heartbeat should restore Online.
7. Disconnect/reconnect the admin: the list should refresh and show current persisted state.
8. Confirm no activity recorded appears for a technician who has never connected since this deployment.
9. Suspend the technician or revoke their session: a subsequent heartbeat must not restore presence; reauthentication is required.

## Backend deployment scope

The connection registry supports multiple tabs/devices within **one running Node backend process**. MongoDB stores durable last-contact timestamps and the online flag. Do not run this implementation under multiple PM2 cluster workers or backend replicas: cross-worker disconnects need a shared per-device lease store (e.g. Redis) and a Socket.IO adapter before scaling. No new infrastructure or environment variables are required for a single-process deployment.

Relevant files: `src/socket/technicianPresence.js`, `src/models/User.js`, `src/server.js`, `src/services/adminTechnicians.js`, `../frontend/src/context/SocketContext.jsx`, and `../admin/src/pages/TechnicianOverview.jsx` (paths in the last two entries are relative to the backend directory).
