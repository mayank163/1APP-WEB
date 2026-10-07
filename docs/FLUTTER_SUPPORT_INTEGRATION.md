# Flutter support tickets and chat integration

The web customer and technician support screens use the same API described here. The admin dashboard lives at `/support` on the admin frontend. Existing account-based conversations remain separate; historical messages are not migrated into tickets.

## Configuration and authentication

Set `apiBaseUrl` to the deployed backend URL plus `/api` and `socketBaseUrl` to its origin. Use the existing login JWT, including technician login JWTs. Every REST request requires `Authorization: Bearer <token>`. JSON requests use `Content-Type: application/json`. Multipart uploads must let the HTTP library set the boundary.

Customers and technicians can access only their own tickets. Administrators need the `support` resource permission: `read` for viewing, `write` for mutation, or `both`. Active super admins bypass resource permissions. In admin Sub-Admin Management, grant `support:both` to support agents; existing accounts need this permission added. The Assigned agent dropdown lists all active sub-admins, sorted by name, excluding super admins. Assignment accepts these sub-admins regardless of their current support permissions. Assignment does not grant permissions; a sub-admin still needs support access to view or reply to tickets.

Existing backend MongoDB, JWT, CORS, and AWS S3 settings apply. Attachments use `AWS_BUCKET_NAME`, `AWS_REGION`, and the existing AWS credentials/S3 upload helper. The returned attachment URLs use the project's existing S3 URL convention; bucket read access must be configured accordingly. No additional packages or migrations are required. MongoDB creates the new collections and indexes through Mongoose.

## REST contract

Responses use `{ "success": true, "data": ... }`; failures use `{ "success": false, "message": "..." }`. IDs in URL paths are MongoDB `_id` values, not display IDs such as `TK-12ABCDEF`.

| Method | Path relative to `/api` | Behavior |
|---|---|---|
| GET | `/support/tickets` | Paginated ticket list and dashboard counts |
| POST | `/support/tickets` | Create a ticket (customer/technician only) |
| GET | `/support/tickets/:id` | Ticket details; admin receives audit log |
| PATCH | `/support/tickets/:id` | Change status; admin can also edit metadata/assignment |
| GET | `/support/tickets/:id/messages` | Message history, excluding internal notes for customers |
| POST | `/support/tickets/:id/messages` | Send reply or admin internal note |
| PATCH | `/support/tickets/:id/read` | Clear unread replies for the requesting side |
| GET | `/support/articles` | Help articles; users only receive published articles for their audience |
| GET | `/support/agents` | Active sub-admins for assignment (admin only) |
| POST | `/support/articles` | Create help article (admin only) |
| PUT | `/support/articles/:id` | Replace article fields (admin only) |
| DELETE | `/support/articles/:id` | Delete article (admin only) |

### Ticket list

Optional query parameters: `page` (default 1), `limit` (default 10, maximum 50), `search` (ticket display ID, subject, and requester name for admins), `status`, `priority`. Reset the page to 1 when a filter changes.

```json
{
  "success": true,
  "data": [{
    "_id": "<mongo-id>",
    "ticketId": "TK-12ABCDEF",
    "subject": "Payment failed for booking",
    "requester": { "_id": "<user-id>", "name": "Priya", "role": "user" },
    "category": "Payment & Refund",
    "priority": "high",
    "status": "open",
    "assignedAgent": null,
    "unreadUser": 0,
    "unreadAdmin": 1,
    "createdAt": "2026-10-08T10:00:00.000Z",
    "updatedAt": "2026-10-08T10:00:00.000Z"
  }],
  "page": 1,
  "limit": 10,
  "total": 1,
  "stats": { "open": 1, "in_progress": 0, "urgent": 0, "resolved": 0 }
}
```

Counts use all accessible tickets, independent of list filters. Urgent counts exclude resolved/closed tickets. Customers use `unreadUser`; administrators use `unreadAdmin`. Admin unread counters are shared by the support team, not per agent. Detail responses also include `description`, `attachments`, requester contact/profile fields, and assigned agent name. Treat these fields as optional in Flutter models. Dates are UTC ISO strings; render them in the user's local timezone.

### Creating a ticket

POST JSON or multipart fields: `subject` (required, 200 characters maximum), `description` (required, 10,000 maximum), `category` (required, 80 maximum), `priority` (optional, defaults to `medium`). Optional fields: `subcategory` (120 characters maximum), `relatedBooking` (owned booking MongoDB `_id`). Multipart accepts repeated `files` fields (up to five attachments total), or the legacy single `file` field. Each file is limited to 10 MiB (10,485,760 bytes). JSON cannot upload attachments.

Suggested categories: Job Issue, Billing, Payment & Refund, Payout, App Issue, Verification, Booking, Other. Categories are plain strings, not a fixed backend enum.

Priorities: `low`, `medium`, `high`, `urgent`.
Statuses: `open`, `in_progress`, `escalated`, `resolved`, `closed`.

The server assigns the display ID and requester; never supply or trust a client requester ID. On success (201), navigate to the returned `data._id`.

### Messages and history

GET messages accepts `limit` (default 50, maximum 100) and optional `before` (opaque cursor returned by the server). Response data is ordered oldest to newest within the requested page. `hasMore` and `nextCursor` identify earlier pages. To load earlier messages, send `before=nextCursor` and prepend the response. Pass `nextCursor` unchanged; it includes both timestamp and message ID to handle messages created at the same time.

POST JSON `{ "text": "Please check the payment." }` or multipart `text` and one optional `file`. Maximum text length is 4,000 characters; either text or an attachment is required. The server rejects replies on resolved/closed tickets with 409. Reopen before sending. Internal notes use `internal: true` (JSON) or `internal: "true"` (multipart), and are restricted to admins.

```json
{
  "success": true,
  "data": {
    "_id": "<message-id>",
    "ticket": "<ticket-id>",
    "senderId": "<sender-id>",
    "senderName": "Support Agent",
    "senderRole": "admin",
    "text": "We are checking this now.",
    "internal": false,
    "attachment": { "name": "receipt.pdf", "url": "https://...", "mimeType": "application/pdf", "size": 12345 },
    "createdAt": "2026-10-08T10:05:00.000Z"
  }
}
```

`attachment` is absent when no file was uploaded. Supported files: JPEG, PNG, WebP, PDF, maximum 10 MB. Validate size/type before upload and display server errors. File download URLs follow the existing backend S3 convention. Do not render message or article strings as raw HTML.

Mark read after successfully displaying messages with PATCH `/support/tickets/:id/read`. Internal notes do not increment user unread counts or trigger user socket updates.

### Status and assignment

Users PATCH `{ "status": "closed" }` to close their ticket. Users PATCH `{ "status": "open" }` to reopen only a resolved/closed ticket. Other status changes are admin only.

Admin PATCH accepts `status`, `priority`, `subject`, `category`, `assignedAgent` (MongoDB admin ID, or `null`/empty string to unassign). Server records changes in the audit trail. Customer message history excludes admin internal notes. Detail and PATCH responses omit audit logs for customers/technicians; the current POST create response includes its initial audit entry.

### FAQs

GET `/support/articles` accepts optional `category`. Article fields: `_id`, `title`, `content`, `category`, `audience` (`all`, `user`, `technician`), `published`, `author` (populated name), `updatedAt`. Flutter users receive only published articles for `all` or their own role. Group by category and search title/content locally.

Admin POST/PUT JSON must include `title` (max 200), `content` (max 20,000), `category` (max 80); use `audience` and boolean `published`. Articles are plain text with preserved line breaks.

## Realtime integration

Use the Flutter `socket_io_client` package against the existing Socket.IO backend. Authenticate through `auth.token`; the backend automatically joins the correct private support room. No client join command is needed. Socket events are invalidation signals; send messages through REST to preserve server validation and persistence.

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io(socketBaseUrl, IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({'token': jwt})
    .disableAutoConnect()
    .build());

socket.onConnect((_) async {
  await refreshTickets();
  if (selectedTicketId != null) await refreshSelectedTicket();
});
socket.on('support:updated', (payload) async {
  await refreshTickets();
  if (payload['ticketId'] == selectedTicketId) {
    await refreshSelectedTicket();
  }
});
socket.onConnectError((error) { /* Show disconnected state. */ });
socket.connect();
// On logout: socket.dispose(); create a new connection after next login.
```

`support:updated` payload is `{ "ticketId": "<mongo-ticket-id>" }`, emitted after creation, replies, and metadata updates. User rooms receive updates only for their own tickets; admin rooms require support read access. Internal notes notify administrators only. REST success is authoritative: refresh after each mutation even when sockets are disconnected. Refresh on reconnect/app resume; optional 15-second polling matches the web UI fallback. Refresh FAQ data when opening that tab; FAQ changes do not emit socket events.

Do not use legacy `chat:send` or `chat:message` events for tickets. Ticket chat has no typing or online-presence events. On logout dispose socket listeners and clear user-specific cached ticket data.

## Suggested Flutter screens

1. Support home: dashboard counts, ticket list, status/priority filters, search, pagination, create-ticket action, and FAQ tab.
2. Create ticket: subject, category, priority, description, optional attachment; disable submit while uploading.
3. Ticket detail: display ID/status/priority, description/attachments, message bubbles with sender/time, older-message loading, composer, close/reopen action.
4. FAQ list/detail: category chips, search, article content preserving line breaks.

Keep user-entered drafts after failed requests. Avoid automatic POST retries: retrying can create duplicate tickets or messages because these endpoints do not implement idempotency keys. Handle 400 validation, 401 expired session, 403 permissions, 404 inaccessible/missing ticket, 409 closed conversation, and 500 storage/database errors. The examples below are illustrative contracts derived from the source, not captured production responses.


## Customer app flow matching the current website

1. Open Help Center. Load `GET /support/articles` and the ticket list. Show topic links, My Support Tickets, and Raise a Ticket.
2. Topics are Getting Started, Payment, Membership, Safety, and Warranty. The customer website matches article category text case-insensitively by substring; the API `category` filter is an exact match. Search article title/content locally if needed.
3. My Support Tickets has All, Open, and Resolved tabs. In this UI, Open includes `open`, `in_progress`, and `escalated`; Resolved includes `resolved` and `closed`. The API's individual status counts do not represent these grouped tab counts. Fetch all pages to reproduce web counts, or maintain paginated lists per status and calculate grouped totals.
4. Raise a Ticket shows read-only name/email/phone from the signed-in profile. These are not submitted: the backend derives requester identity from the JWT. Choose category/subcategory, optionally select a booking, enter subject/description, and add up to five files.
5. Submit and show confirmation using returned `ticketId`, `status`, `createdAt`, and `category`. View Ticket navigates using `_id`.
6. Open detail and fetch detail plus message history in parallel. Render `description` as the first conversation bubble and ticket `attachments` alongside the issue. Creation does not create a SupportMessage, so the first history response can be empty. Mark read after displaying the conversation.
7. Send replies through REST, refresh detail/list/history on success, and preserve the draft on error. For `resolved`/`closed`, disable the composer and show Reopen Ticket. Other statuses allow replies and Close Ticket.
8. Refresh on socket updates, reconnect, app resume, and optionally every 15 seconds while the screen is active. Cancel listeners/timers when leaving or logging out.

### Customer form options

These values are defined in the customer frontend; there is no category/subcategory API or backend enum.

| Category | Subcategories |
|---|---|
| Service / Technician | Technician didn’t arrive; Service quality issue; Technician behaviour; Other |
| Payment & Billing | Refund not received; Incorrect charge; Payment failed; Other |
| Booking | Reschedule booking; Cancel booking; Booking not confirmed; Other |
| Account | Login issue; Update account details; Other |
| Other | Other |

For web parity, subcategory is required by the form; related booking is required for Service / Technician and Booking, optional for Payment & Billing, and hidden for Account/Other. Clear subcategory and booking when category changes. The backend only requires subject, description, and category; it does not enforce these form-specific rules. The customer form uses a 2,000-character description cap, although the backend accepts 10,000. The customer form omits priority, so the server uses `medium`. Technician/admin-oriented category suggestions earlier in this guide are separate from these customer options.

### Related booking picker API

`GET /api/bookings/my-bookings?page=1&limit=100` uses the same Bearer token. Defaults are page 1 and limit 10; maximum limit is 100. Optional `status`: `Pending`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`, or `all`. Fetch through `pagination.totalPages` to reproduce the web picker.

HTTP 200, abbreviated booking example (the API returns full booking documents):

```json
{
  "success": true,
  "count": 1,
  "data": { "bookings": [{
    "_id": "670000000000000000000003",
    "bookingId": "BK-EXAMPLE",
    "services": [{ "service": { "_id": "670000000000000000000004", "name": "AC Service" }, "variantName": "Standard" }],
    "status": "Completed",
    "serviceDate": "2026-10-08T09:00:00.000Z"
  }] },
  "pagination": { "page": 1, "limit": 100, "total": 1, "totalPages": 1 }
}
```

Submit booking `_id`, not `bookingId`. Picker label: bookingId (fallback `#` plus last six ID characters uppercased), then service names, booking status, and date. Backend creation generates `relatedBookingLabel` from the booking ID and service names. Booking ownership is checked against `Booking.user`; this is not a technician-assigned-jobs lookup. Technician tickets should omit relatedBooking unless the booking is owned by that technician's user account.

## Detailed request and response examples

All support paths below are relative to `/api`. All success responses are HTTP 200 unless explicitly marked 201. MongoDB IDs and timestamps below are illustrative. MongoDB may also return `__v` and nested `_id` fields: tolerate additional fields.

### POST /support/tickets — create (201)

JSON request without attachments:

```json
{
  "subject": "Refund not received",
  "description": "My booking was cancelled but the refund has not arrived.",
  "category": "Payment & Billing",
  "subcategory": "Refund not received",
  "relatedBooking": "670000000000000000000003",
  "priority": "medium"
}
```

For attachments send these fields as multipart text parts, with each attachment using the exact field name `files` (not `files[]`). Legacy `file` allows one file. Combined files/file count cannot exceed five. Do not send a JSON attachment URL; the server creates attachment metadata from uploads.

```json
{
  "success": true,
  "data": {
    "_id": "670000000000000000000001",
    "ticketId": "TK-12ABCDEF",
    "requester": "670000000000000000000002",
    "subject": "Refund not received",
    "description": "My booking was cancelled but the refund has not arrived.",
    "category": "Payment & Billing",
    "subcategory": "Refund not received",
    "relatedBooking": "670000000000000000000003",
    "relatedBookingLabel": "BK-EXAMPLE · AC Service",
    "priority": "medium",
    "status": "open",
    "assignedAgent": null,
    "attachments": [],
    "audit": [{ "action": "Ticket created", "actor": "Priya", "createdAt": "2026-10-08T10:00:00.000Z" }],
    "unreadUser": 0,
    "unreadAdmin": 1,
    "createdAt": "2026-10-08T10:00:00.000Z",
    "updatedAt": "2026-10-08T10:00:00.000Z"
  }
}
```

### GET /support/tickets — list (200)

See the list response earlier. It omits `description`, `attachments`, and `audit`, but retains `subcategory`, `relatedBooking`, and `relatedBookingLabel` when present. Sort order is `updatedAt` descending. `requester` is populated with `_id`, name, role; `assignedAgent` is null or `{ "_id": "<admin-id>", "name": "Agent name" }`. Populated references can be null if the referenced record is missing.

When tickets exist, stats also contain aggregate `unreadUser`, `unreadAdmin`, and MongoDB aggregation `_id: null`. When no tickets exist in scope, the fallback is exactly `{ "open": 0, "in_progress": 0, "urgent": 0, "resolved": 0 }`; unread sums may be absent. Use zero defaults. `total` reflects applied filters, while stats reflect all tickets in scope.

### GET /support/tickets/:id — detail (200)

```json
{
  "success": true,
  "data": {
    "_id": "670000000000000000000001",
    "ticketId": "TK-12ABCDEF",
    "requester": { "_id": "670000000000000000000002", "name": "Priya", "role": "user", "email": "priya@example.com", "phone": "9999999999" },
    "subject": "Refund not received",
    "description": "My booking was cancelled but the refund has not arrived.",
    "category": "Payment & Billing",
    "subcategory": "Refund not received",
    "relatedBooking": "670000000000000000000003",
    "relatedBookingLabel": "BK-EXAMPLE · AC Service",
    "priority": "medium",
    "status": "in_progress",
    "assignedAgent": { "_id": "670000000000000000000005", "name": "Support Agent" },
    "attachments": [{ "name": "receipt.pdf", "url": "https://example.com/receipt.pdf", "mimeType": "application/pdf", "size": 12345 }],
    "unreadUser": 1,
    "unreadAdmin": 0,
    "createdAt": "2026-10-08T10:00:00.000Z",
    "updatedAt": "2026-10-08T10:05:00.000Z"
  }
}
```

Requester selection additionally permits `address`, `profileImage`, and `technicianId`; their presence depends on the account. Admin detail adds the `audit` array. A detail GET does not mark read.

### PATCH /support/tickets/:id — close, reopen, or admin edit (200)

Customer/technician close request: `{ "status": "closed" }`.
Reopen request: `{ "status": "open" }`, only when currently resolved/closed.
The backend accepts closing even a currently closed/resolved ticket. User metadata edits are not applied; always send only status.

Admin example:

```json
{
  "status": "in_progress",
  "priority": "high",
  "subject": "Refund follow-up",
  "category": "Payment & Billing",
  "assignedAgent": "670000000000000000000005"
}
```

Response is `{ "success": true, "data": <updated ticket> }` with all ticket fields shown in the create example. Unlike GET detail, `requester` and non-null `assignedAgent` are unpopulated ID strings. Customer/technician PATCH omits `audit`; admin PATCH includes it. Re-fetch detail for populated account/agent information. Admin transitions are allowed between any valid statuses; there is no enforced linear workflow. This API does not edit description, attachments, subcategory, or related booking.

### GET /support/tickets/:id/messages — history (200)

```json
{
  "success": true,
  "data": [{
    "_id": "670000000000000000000006",
    "ticket": "670000000000000000000001",
    "senderId": "670000000000000000000005",
    "senderName": "Support Agent",
    "senderRole": "admin",
    "text": "We are checking your refund.",
    "internal": false,
    "createdAt": "2026-10-08T10:05:00.000Z",
    "updatedAt": "2026-10-08T10:05:00.000Z"
  }],
  "hasMore": true,
  "nextCursor": "2026-10-08T10:05:00.000Z|670000000000000000000006"
}
```

Empty history: `{ "success": true, "data": [], "hasMore": false, "nextCursor": null }`.
Pass `before` through query parameters so the library URL-encodes it. Prepend older pages, deduplicate by `_id`, and preserve scroll position. On live refresh, merge messages by `_id` if keeping already-loaded older pages. The backend fetches newest-first with `_id` as a tie-breaker, then reverses each page for chronological display.

### POST /support/tickets/:id/messages — reply/internal note (201)

JSON request: `{ "text": "Please check my refund." }`.
Multipart request: `text` plus one `file`; an attachment-only reply is valid. Repeated `files` is not accepted here. Admin note request: `{ "text": "Checking with billing.", "internal": true }`.

Response is `{ "success": true, "data": <message> }` using the message object above, with optional attachment metadata as shown earlier. Both `createdAt` and `updatedAt` are returned. Sender fields and ticket ID are generated server-side. All replies, including internal notes, are blocked while resolved/closed.

### PATCH /support/tickets/:id/read — mark read (200)

No request body required. Response:

```json
{ "success": true }
```

Clears only the requesting side's counter (`unreadUser` for both customer and technician, `unreadAdmin` for admin). Does not change ticket updatedAt or emit a support event. Update the local unread badge or refresh the list after success. An admin with read-only support permission cannot invoke this PATCH.

### GET /support/articles — FAQ list (200)

Optional `category` is an exact category filter. No pagination, server search, or individual article detail endpoint exists; open article content from the returned list.

```json
{
  "success": true,
  "data": [{
    "_id": "670000000000000000000007",
    "title": "How do refunds work?",
    "content": "Contact support with your booking reference.\nWe will review the payment.",
    "category": "Payment",
    "audience": "all",
    "published": true,
    "author": { "_id": "670000000000000000000005", "name": "Support Agent" },
    "createdAt": "2026-10-08T09:00:00.000Z",
    "updatedAt": "2026-10-08T09:00:00.000Z"
  }]
}
```

Empty list: `{ "success": true, "data": [] }`. Admins receive drafts and all audiences. Author can be null/missing. Render content as plain text.

### GET /support/agents — admin assignment options (200)

```json
{
  "success": true,
  "data": [{ "_id": "670000000000000000000005", "name": "Support Agent", "email": "agent@example.com", "role": "support" }]
}
```

The role string is the stored admin role, not a fixed support API enum. Only active non-super-admin accounts are returned, sorted by name and ID. Empty result uses `data: []`.

### POST /support/articles — admin create (201)

```json
{
  "title": "How do refunds work?",
  "content": "Contact support with your booking reference.",
  "category": "Payment",
  "audience": "all",
  "published": true
}
```

Response: `{ "success": true, "data": <article> }` with the fields from the FAQ example, except `author` is the authenticated admin's ID string. Required trimmed strings: title (200 maximum), content (20,000), category (80). Audience defaults to `all`; allowed values are `all`, `user`, `technician`. Published defaults to false and requires JSON boolean `true` to publish (string `"true"` is not accepted as true).

### PUT /support/articles/:id — admin replace fields (200)

Send the same full body as POST, including required title/content/category. This is not a partial PATCH. Omitting audience resets it to `all`; omitting published sets it to false. Author is preserved. Response: `{ "success": true, "data": <updated article> }`, with an unpopulated author ID. Missing article: 404 `Article not found.`

### DELETE /support/articles/:id — admin delete (200)

No body. Response: `{ "success": true }`. Missing article: 404 `Article not found.`

## Errors and client handling

Support failures have this envelope:

```json
{ "success": false, "message": "Reopen this ticket before replying." }
```

| HTTP | Exact message or behavior | Flutter handling |
|---|---|---|
| 400 | `Invalid ticket ID.` | Use MongoDB `_id`, not display ticketId |
| 400 | `Subject is required (maximum 200 characters).` / equivalent Description, Category, Subcategory limits | Show field validation and retain draft |
| 400 | `Invalid priority.` / `Invalid status.` | Use supported enum values |
| 400 | `Invalid related booking.` / `Related booking not found.` | Reload owned bookings; omit unavailable selection |
| 400 | `Only JPEG, PNG, WebP and PDF attachments are supported.` | Validate actual multipart MIME type |
| 400 | Multer upload messages such as `File too large`, `Too many files`, `Unexpected field` | Enforce count/size and correct field names |
| 400 | `Up to 5 attachments are supported.` | Limit ticket uploads to five |
| 400 | `Provide a message or attachment; text limit is 4000 characters.` | Check trimmed text/file before sending |
| 400 | `Invalid cursor.` | Reset message pagination and reload latest page |
| 400 | `You can close a ticket or reopen a resolved/closed ticket.` | Refresh status and present allowed actions |
| 400 | `Tickets must be created from a customer or technician account.` | Do not create tickets using admin JWT |
| 400 | `Invalid agent.` / `Select an active sub-admin.` | Reload agent options |
| 401 | `Not logged in.` / `Invalid or expired token.` / `Session has been logged out.` / `User no longer exists.` | Use existing app authentication/session recovery |
| 403 | `Support permission required.` / `Support access denied.` / `Admin access required.` | Hide unavailable actions and display server message |
| 403 | `Internal notes are admin only.` | Customer/technician must omit internal or use false |
| 403 | Inactive/suspended account messages from authentication middleware | Follow existing account-access handling |
| 404 | `Ticket not found.` | Missing and another user's ticket are intentionally indistinguishable |
| 404 | `Article not found.` | Refresh article list |
| 409 | `Reopen this ticket before replying.` | Refresh ticket and show reopen action |
| 500 | `Unable to process support request.` | Preserve draft; allow explicit retry |

Mongoose validation errors return 400 with the validation message; CastError returns 400 with `Unable to process support request.`. Support upload errors are returned as 400. Network/timeouts may have no JSON envelope. Ticket/message POST endpoints have no idempotency key: do not automatically retry after an uncertain timeout, because the first request may have succeeded. Re-fetch before asking the user to retry.

## Flutter service implementation notes

Use the existing app HTTP client and JWT session. Configure its base URL once to `<backend-origin>/api`; use relative paths `/support/...`. Obtain the actual deployed origin from the project's environment configuration; this guide does not assume a production hostname.

For a Dio multipart implementation, populate repeated fields with the literal name `files`:

```dart
// dio already has baseUrl ending in /api and Authorization: Bearer <jwt>.
final form = FormData.fromMap({
  'subject': subject.trim(),
  'description': description.trim(),
  'category': category,
  'subcategory': subcategory,
  if (relatedBookingId != null) 'relatedBooking': relatedBookingId,
});
for (final upload in uploads) {
  // Supply the actual supported contentType using the MIME type API
  // available in your installed Dio version; do not use octet-stream.
  form.files.add(MapEntry('files', upload)); // upload is MultipartFile
}
final response = await dio.post('/support/tickets', data: form);
final ticketId = response.data['data']['_id'] as String;
```

Let Dio set multipart Content-Type/boundary. `MultipartFile` needs the actual JPEG/PNG/WebP/PDF MIME type because the backend checks file.mimetype; filename extension alone is insufficient. For replies, construct a separate FormData with text and optional single `file`.

Parse separate summary/detail/mutation representations or normalize reference fields: requester and assignedAgent can be ID strings, populated objects, or null. Default missing unread stats to zero, missing attachment arrays to empty, and missing message attachment to null. Parse UTC dates then display locally. Use `_id` to deduplicate and route, and `ticketId` only as a display label.

Prevent double taps while a mutation runs, preserve drafts on failure, and guard detail refreshes so a response for a previously selected ticket cannot overwrite the currently selected one. Use REST success as the source of truth and coalesce overlapping socket/poll refreshes. A socket event contains only ticketId, not message data. No socket ticket join, message-send, typing, presence, delete-ticket, delete-message, or attachment-delete API is implemented.

## Source of truth

This guide documents the current repository implementation:

- [Support routes](../backend/src/routes/supportRoutes.js)
- [Ticket model](../backend/src/models/SupportTicket.js), [message model](../backend/src/models/SupportMessage.js), [article model](../backend/src/models/SupportArticle.js)
- [Authentication middleware](../backend/src/middleware/auth.js)
- [Socket authentication, room joins, and API mounts](../backend/src/server.js)
- [Customer support UI](../frontend/src/pages/UserSupportCenter.jsx)
- [Admin support UI](../frontend/src/pages/SupportCenter.jsx)
- [Booking controller](../backend/src/controllers/bookingController.js), [pagination helper](../backend/src/utils/pagination.js)
