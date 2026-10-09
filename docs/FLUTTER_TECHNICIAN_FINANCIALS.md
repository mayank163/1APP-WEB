# Technician financials: Flutter integration

Use this API for the **Your Earnings** and **Earning History** screens in the supplied designs. The admin technician overview uses the same calculation through an admin endpoint.

## Endpoints and authentication

Base URL: your existing backend URL ending in `/api`.

- `GET /technician/financials`: technician JWT; returns only the signed-in technician's financials. No technician ID is accepted to select another account.
- `GET /admin/technicians/:technicianId/financials`: admin JWT with `technician_jobs` read permission; ID is the technician's MongoDB `_id`, not the display `TK-…` ID.

Send `Authorization: Bearer <token>`. These endpoints are read-only; existing job payment and withdrawal endpoints handle writes.

## Query parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `period` | `weekly` | `weekly` or `monthly`; controls activity chart only |
| `status` | `all` | `all`, `pending`, `completed`; controls history only |
| `from` | absent | Inclusive history start date, `YYYY-MM-DD` |
| `to` | absent | Inclusive history end date, `YYYY-MM-DD` |
| `page` | `1` | Positive history page number |
| `limit` | `20` | History page size, 1–100 |

Example: `/technician/financials?period=weekly&status=pending&from=2026-10-01&to=2026-10-31&page=1&limit=20`.

All calendar dates and chart buckets use **UTC**, explicitly returned as `timezone`. Weekly charts run Sunday–Saturday; monthly charts contain one point per day of the current month. Changing history filters does not change summary cards, activity, recent transactions, or withdrawals. Dates should remain UTC for grouping and labels to agree with backend totals; do not silently regroup using device local time.

## Successful response

Illustrative empty-account response (weekly `points` shortened here; actual response contains seven):

```json
{
  "success": true,
  "data": {
    "technicianId": "507f1f77bcf86cd799439011",
    "currency": "USD",
    "timezone": "UTC",
    "generatedAt": "2026-10-08T12:00:00.000Z",
    "summary": {
      "todayEarnings": 0,
      "thisMonth": 0,
      "previousMonth": 0,
      "monthChangePercent": 0,
      "totalEarned": 0,
      "pendingEarnings": 0,
      "pendingJobs": 0,
      "totalWithdrawn": 0,
      "walletEarnings": 0,
      "availableBalance": 0,
      "pendingWithdrawals": 0
    },
    "activity": {
      "period": "weekly",
      "from": "2026-10-04",
      "to": "2026-10-10",
      "total": 0,
      "previousTotal": 0,
      "changePercent": 0,
      "points": [{ "date": "2026-10-04", "label": "Sun", "amount": 0 }]
    },
    "recentTransactions": [],
    "transactions": {
      "items": [],
      "groups": [],
      "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0, "hasNextPage": false }
    },
    "withdrawals": []
  }
}
```

Transaction shape (the same shape is used in `items`, `groups[].items`, and `recentTransactions`):

```json
{
  "id": "507f1f77bcf86cd799439012",
  "jobId": "507f1f77bcf86cd799439012",
  "title": "TV Wall Mounting",
  "category": "Installation",
  "amount": 120,
  "status": "completed",
  "date": "2026-10-08T10:30:00.000Z",
  "dateKey": "2026-10-08",
  "paymentStatus": "paid"
}
```

`groups` contains `{date: "YYYY-MM-DD", items: [...]}` in newest-first order. Groups apply to the current page; a date can span two pages. Merge groups by date when appending another page, and deduplicate transactions by `id`. Use `jobId` to open the existing job detail screen. IDs are MongoDB strings, not sample numeric job IDs from the design.

Withdrawal entries contain `id`, `amount`, `status` (`pending`, `paid`, `rejected`), `method`, and `createdAt`. This array contains all existing withdrawal requests, newest first, independent of history pagination.

## Screen mapping

| Design element | Response field |
| --- | --- |
| Today's Earning | `summary.todayEarnings` |
| Pending | `summary.pendingEarnings` |
| This Month | `summary.thisMonth` |
| Month growth badge | `summary.monthChangePercent` |
| Total Earned | `summary.totalEarned` |
| Pending jobs badge | `summary.pendingJobs` |
| This Week / This Month activity total | `activity.total` |
| Activity growth badge | `activity.changePercent` |
| Bars and day labels | `activity.points[].amount`, `.label`, `.date` |
| Recent Transactions | `recentTransactions` (latest five, unfiltered) |
| All / Pendings tabs | `status=all` / `status=pending` |
| Calendar range | `from`, `to`; reset page to 1 |
| Dated history sections | `transactions.groups` |
| Load more | `transactions.pagination.hasNextPage` |

Use returned `currency` for formatting; USD matches existing technician payment behavior. Amounts are decimal currency units, not cents. Read JSON numbers with `(value as num).toDouble()`; zero can be encoded as an integer. Growth can be `null` when the prior period was zero and current earnings are positive: show “New earnings” or hide the percentage. Do not display an invented percentage. Both-zero periods return `0`. The API does not provide an all-time growth badge because there is no defined comparison period for all-time earnings.

## Accounting definitions

- Earned totals and chart data use paid technician jobs and their net `finalPrice`, including admin payment discounts. A paid job appears once; pending and paid versions are not duplicated.
- Pending earnings include assigned jobs in `checkout`, `completed`, or `closed` with unpaid/pending payments. Refunded jobs and unfinished work are excluded. Pending amounts prefer final price, then negotiated final amount, then the existing fixed-price estimate. An amount may be zero when no price has been established.
- Paid transaction date is `payment.paidAt` with legacy completion/update fallbacks. Pending date is job completion date with completion/update fallbacks.
- `walletEarnings`, `totalWithdrawn`, and `availableBalance` reflect the existing user wallet counters. `availableBalance = max(walletEarnings - totalWithdrawn, 0)`, matching existing withdrawal behavior. Legacy wallet credits can therefore differ from `totalEarned`, which comes from paid job records. This feature does not migrate old counters.
- `pendingWithdrawals` is separate from pending job earnings. Pending withdrawals are not deducted from `availableBalance`, matching the existing withdrawal endpoint.

## Dart request example (http package)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> getFinancials({
  required String apiBaseUrl,
  required String token,
  String period = 'weekly',
  String status = 'all',
  String? from,
  String? to,
  int page = 1,
  int limit = 20,
}) async {
  final base = apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
  final uri = Uri.parse('$base/technician/financials').replace(
    queryParameters: {
      'period': period,
      'status': status,
      'page': '$page',
      'limit': '$limit',
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
    },
  );
  final response = await http.get(uri, headers: {
    'Authorization': 'Bearer $token',
    'Accept': 'application/json',
  });
  final body = jsonDecode(response.body) as Map<String, dynamic>;
  if (response.statusCode != 200 || body['success'] != true) {
    throw Exception(body['message'] ?? 'Unable to load financials');
  }
  return body['data'] as Map<String, dynamic>;
}
```

On initial load, show a loading state; on failure show the API message with retry, not zero earnings. Empty successful responses should show $0.00 cards and a “No transactions” state. Refresh after payment/withdrawal events or on screen resume. Reset pagination on tab/date changes; cancel or ignore stale responses when filters change. Handle 400 invalid filters/ID, 401 expired or missing authentication, 403 role/permission failure, 404 unknown technician (admin endpoint), and server/network failures through the app's existing error flow.
