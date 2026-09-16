# Technician job negotiation: Flutter integration guide

This guide describes the technician request and counter-offer state machine. All API calls require `Authorization: Bearer <accessToken>`.

## Flow

1. Technician requests an open job with an optional fixed price and zero or more additional charges.
2. Admin accepts, rejects, or counter-offers the fixed price.
3. A technician can accept, reject, or re-counter an admin fixed-price counter-offer.
4. Additional charges are negotiated independently, one charge at a time:
   - Technician submits a charge.
   - Admin accepts, rejects, or counter-offers it.
   - Technician accepts or re-counters the admin offer.
   - Admin accepts or re-counters the technician offer.
   - This repeats until the charge is accepted or rejected.
5. When admin approval exists and every additional charge is accepted or rejected, the backend assigns the job and emits `request:assigned`.

A request with no additional charges is assigned immediately when the admin-approved fixed offer is accepted. A request with additional charges is assigned after all charge negotiations are resolved.

## Request a job

`POST /api/technician/jobs/{jobId}/request`

JSON body:

```json
{
  "note": "I can complete this job today.",
  "fixedPrice": 850,
  "charges": [
    { "label": "Travel", "description": "Long-distance travel", "amount": 120 },
    { "label": "Spare part", "description": "Replacement connector", "amount": 300 }
  ]
}
```

`fixedPrice` and `charges` are optional. Either or both can be supplied.

Successful response: `201`

```json
{
  "success": true,
  "data": {
    "request": {
      "_id": "requestId",
      "status": "pending",
      "counterOffer": 850,
      "counterOfferFrom": "technician",
      "chargesStatus": "pending"
    },
    "charges": [{ "_id": "chargeId", "status": "pending", "pendingWith": "admin" }]
  }
}
```

## Get technician requests

`GET /api/technician/requests`

Use this after login and after receiving a socket event. Inspect:

- `request.status`: `pending`, `counter-offer`, `accepted`, or `rejected`
- `request.counterOffer`
- `request.counterOfferFrom`: `technician` or `admin`
- `request.adminApproved`: whether admin has approved the request
- `request.chargesStatus`: `none`, `pending`, `reviewing`, `agreed`, or `invoiced`
- `request.job`: assigned job after `request:assigned`

## Respond to an admin fixed-price counter-offer

`PATCH /api/technician/requests/{requestId}/respond`

Accept:

```json
{ "action": "accept", "note": "Agreed." }
```

Re-counter:

```json
{ "action": "counter", "counterOffer": 900, "note": "This is my best price." }
```

Reject:

```json
{ "action": "reject", "note": "I cannot accept this amount." }
```

Only a request with `status: "counter-offer"` and `counterOfferFrom: "admin"` can use this endpoint.

## Additional charges

### Submit charges

`POST /api/technician/requests/{requestId}/charges`

```json
{
  "charges": [
    { "label": "Travel", "description": "Highway toll", "amount": 120 }
  ]
}
```

### Get charge status

`GET /api/technician/requests/{requestId}/status`

Each charge contains:

```json
{
  "_id": "chargeId",
  "status": "pending|accepted|rejected|countered",
  "pendingWith": "admin|technician|null",
  "requestedAmount": 120,
  "adminCounterAmount": 100,
  "technicianCounterAmount": null,
  "agreedAmount": null,
  "needsYourResponse": true,
  "counterHistory": [
    { "round": 1, "actor": "technician", "action": "submit", "amount": 120 },
    { "round": 2, "actor": "admin", "action": "counter", "amount": 100 }
  ]
}
```

The technician may respond only when `status == "countered" && pendingWith == "technician"`.

`PATCH /api/technician/charges/{chargeId}/respond`

Accept the admin amount:

```json
{ "action": "accept", "note": "Approved." }
```

Re-counter it:

```json
{ "action": "counter", "amount": 110, "note": "Can do it for this amount." }
```

A charge rejection is performed by the admin. The technician does not reject an admin charge counter; they accept or re-counter it.

## Socket.IO

Connect with `socket_io_client` using the access token:

```dart
final socket = IO.io(apiBaseUrl, IO.OptionBuilder()
  .setTransports(['websocket'])
  .setAuth({'token': accessToken})
  .disableAutoConnect()
  .build());
socket.connect();
```

Join the request room when opening a request detail page:

```dart
socket.emit('request:join', requestId);
socket.emit('request:leave', requestId);
```

The technician should also join its personal room after connection:

```dart
socket.emit('technician:join', technicianId);
```

### Events received by technician

| Event | Payload | Action |
| --- | --- | --- |
| `job:request:new` | `{ jobId, request, charges }` | Refresh request/job data if relevant. |
| `request:updated` | `{ request }` | Replace the matching request in local state. |
| `request:status` | `{ requestId, status, counterOffer, counterOfferFrom, adminApproved, waitingForCharges }` | Update the request badge and show the admin action. |
| `charge:reviewed` | `{ chargeId, action, charge, requestChargesStatus }` | Refresh the request charge list. |
| `charge:responded` | `{ chargeId, action, amount, requestChargesStatus }` | Refresh the request charge list. |
| `final_amount:calculated` | `{ requestId, fixedCharge, additionalTotal, total }` | Show the negotiated total. |
| `request:assigned` | `{ requestId, request, job, finalJobAmount }` | Mark the request assigned and show the job. |
| `invoice:generated` | `{ requestId, invoice }` | Show the invoice. |

The server emits technician updates to both `request:{requestId}` and the technician's personal `technician:{technicianId}` room. Admin updates are emitted to the `admin` room. Join the personal technician room after connecting so request and charge changes arrive even when no request detail page is open. Events may arrive while the app is offline, so always refresh via REST when the page opens or the app resumes.

## Recommended client rules

- Do not allow fixed-counter actions unless `counterOfferFrom == "admin"`.
- Do not allow charge responses unless `needsYourResponse == true`.
- Disable duplicate taps while an API request is pending.
- Treat REST responses as authoritative and sockets as live refresh notifications.
- After `request:assigned`, refresh `/api/technician/requests` and `/api/technician/jobs`.
- Display `counterHistory` in chronological order to show every negotiation round.
