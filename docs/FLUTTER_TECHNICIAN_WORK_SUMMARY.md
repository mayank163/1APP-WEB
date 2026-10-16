# Flutter: technician profile work summary

## What to add

Add a read-only **Work summary** section to the logged-in technician's profile screen. It displays their actual finished-job experience, grouped by work type. Expand each work type to show **Work subtypes** and **Service types**, with job counts, ratings, and last completion dates.

This section is populated from job history automatically. There is no save/update request and no work-type selection form for this feature.

## API

Use the app's existing backend API base URL and authenticated HTTP client.

```http
GET /api/technician/work-summary
Authorization: Bearer <technician_access_token>
Accept: application/json
```

- No request body, query parameters, or technician ID is required.
- The backend reads the technician ID from the access token.
- If the client's base URL already ends in `/api`, request `/technician/work-summary`.
- This endpoint is for the logged-in technician only. A regular customer token cannot use it to view another technician's history.
- For an authenticated admin app viewing a technician, use `GET /api/admin/technicians/:technicianId/work-summary`. This requires admin identity and `technician_jobs:read` permission. Use the technician's MongoDB `_id` in this path, not their display technician code.
- Neither endpoint currently supports pagination or filters.

## Success response

HTTP `200`. Illustrative response:

```json
{
  "success": true,
  "data": {
    "technicianId": "507f1f77bcf86cd799439011",
    "totalJobs": 14,
    "workTypes": [
      {
        "id": "507f1f77bcf86cd799439012",
        "name": "Fiber Cabling",
        "jobCount": 14,
        "lastCompletedAt": "2026-10-10T10:30:00.000Z",
        "ratingCount": 10,
        "averageRating": 4.6,
        "averageHourlyRate": 95,
        "subTypes": [
          {
            "id": "507f1f77bcf86cd799439013",
            "name": "Fiber Runs",
            "jobCount": 14,
            "lastCompletedAt": "2026-10-10T10:30:00.000Z",
            "ratingCount": 10,
            "averageRating": 4.6,
            "averageHourlyRate": 95
          }
        ],
        "serviceTypes": [
          {
            "id": "507f1f77bcf86cd799439014",
            "name": "Installation",
            "jobCount": 14,
            "lastCompletedAt": "2026-10-10T10:30:00.000Z",
            "ratingCount": 10,
            "averageRating": 4.6,
            "averageHourlyRate": 95
          }
        ]
      }
    ]
  }
}
```

### Field mapping

| Field | Type | Flutter display / meaning |
| --- | --- | --- |
| `data.technicianId` | String | Technician's database ID. |
| `data.totalJobs` | Integer | Unique finished jobs across all work types. |
| `data.workTypes` | Array | Expandable top-level rows; keep server order. |
| `id` | String | Row identity; treat as opaque, as legacy rows can use names instead of database IDs. |
| `name` | String | Work type, subtype, or service-type label. |
| `jobCount` | Integer | Show `1 Job` or `N Jobs`. |
| `lastCompletedAt` | ISO date string or null | Parse as UTC and convert to local time for display; omit if null. |
| `ratingCount` | Integer | Number of recorded job ratings contributing to the average. |
| `averageRating` | Number or null | Average job rating out of 5; display `N/A` when null. |
| `averageHourlyRate` | Number or null | Average recorded hourly rate, in USD; show `$95 / hr`, for example. Omit when null. |
| `subTypes` | Array, work-type rows only | Breakdown of work subtypes. |
| `serviceTypes` | Array, work-type rows only | Separate breakdown of service types. |

JSON numbers can arrive as integers or decimals. Parse monetary/rating values with `(value as num?)?.toDouble()`.

## Counting rules

- Finished work includes statuses `checkout`, `completed`, and `closed`. `checkout` means work has finished and awaits approval.
- Open, assigned, in-progress, and cancelled jobs do not contribute.
- Both primary and additional work types contribute. Within one work-type group, a job counts once even if both types refer to that group.
- `totalJobs` counts each job once. Summing work-type counts can exceed this total because one job can have multiple work types.
- Subtype and service-type rows are independent breakdowns. Do not add their counts together to calculate the parent total.
- Legacy jobs without a named work type appear under their job category or `General Service`.
- Only recorded experience is returned. The response does not contain a full catalogue of zero-job work/service types.
- Missing service types/subtypes produce empty arrays. Missing ratings, hourly rates, and completion dates produce null values.
- Hourly averages include only hourly-pay jobs with a positive hourly rate. They are historical averages, not a technician's current asking rate.
- Dates use `jobCompletedAt`, then `completedAt`, then `completedStatus.at`. A finished legacy job may have no recorded completion date.
- Rows sort by descending job count, then name. Preserve this order in the app.

## Suggested Flutter implementation

Integrate with the app's existing state management and authenticated client. The following lightweight model supports top-level and child rows:

```dart
class WorkSummaryRow {
  final String id;
  final String name;
  final int jobCount;
  final int ratingCount;
  final DateTime? lastCompletedAt;
  final double? averageRating;
  final double? averageHourlyRate;
  final List<WorkSummaryRow> subTypes;
  final List<WorkSummaryRow> serviceTypes;

  WorkSummaryRow.fromJson(Map<String, dynamic> json)
      : id = json['id'] as String,
        name = json['name'] as String,
        jobCount = (json['jobCount'] as num).toInt(),
        ratingCount = (json['ratingCount'] as num? ?? 0).toInt(),
        lastCompletedAt = DateTime.tryParse(
          json['lastCompletedAt'] as String? ?? '',
        ),
        averageRating = (json['averageRating'] as num?)?.toDouble(),
        averageHourlyRate = (json['averageHourlyRate'] as num?)?.toDouble(),
        subTypes = parseRows(json['subTypes']),
        serviceTypes = parseRows(json['serviceTypes']);

  static List<WorkSummaryRow> parseRows(dynamic value) =>
      (value as List<dynamic>? ?? const [])
          .map((row) => WorkSummaryRow.fromJson(
                Map<String, dynamic>.from(row as Map),
              ))
          .toList();
}

class TechnicianWorkSummary {
  final String technicianId;
  final int totalJobs;
  final List<WorkSummaryRow> workTypes;

  TechnicianWorkSummary.fromJson(Map<String, dynamic> json)
      : technicianId = json['technicianId'] as String,
        totalJobs = (json['totalJobs'] as num).toInt(),
        workTypes = WorkSummaryRow.parseRows(json['workTypes']);
}
```

For an existing Dio client whose base URL ends in `/api`, fetching would look like:

```dart
Future<TechnicianWorkSummary> fetchWorkSummary(Dio authenticatedDio) async {
  // Use the project's Dio import and existing token interceptor.
  final response = await authenticatedDio.get('/technician/work-summary');
  final body = Map<String, dynamic>.from(response.data as Map);
  if (body['success'] != true || body['data'] is! Map) {
    throw StateError('Unable to load work summary.');
  }
  return TechnicianWorkSummary.fromJson(
    Map<String, dynamic>.from(body['data'] as Map),
  );
}
```

### Profile screen layout

1. Add a card titled **Work summary**, with `${summary.totalJobs} completed jobs` as supporting text.
2. Use an `ExpansionTile` for each entry in `summary.workTypes`. Use its `id` as the row key.
3. In the collapsed row, show `name`, optional `averageHourlyRate`, and `jobCount` on the trailing side.
4. When expanded, render a **Work subtypes** section if `subTypes` is nonempty, and a **Service types** section if `serviceTypes` is nonempty.
5. For each child row, show its name, `averageRating` out of 5 (or `N/A`), last completion date if available, and `jobCount`.
6. If both child arrays are empty, show **No service type recorded for these jobs.**
7. Format dates using the app's existing date formatter. If showing relative time, use **Last completed 3 days ago**, with a full formatted date available where appropriate.
8. Allow text to wrap on narrow screens. Keep job counts visible and make the full parent row tappable.

## Loading, empty, error, and refresh states

- Fetch once when opening the technician profile; reuse the profile's refresh action. Do not fetch inside `build()` on every rebuild.
- Display a small loader or skeleton inside the work-summary card while fetching. Other profile sections should remain usable.
- Empty history is a successful response:

```json
{
  "success": true,
  "data": {
    "technicianId": "507f1f77bcf86cd799439011",
    "totalJobs": 0,
    "workTypes": []
  }
}
```

Show **No completed jobs yet.** for this response, rather than an error.

| Status / condition | Handling |
| --- | --- |
| `401` | Use the app's existing expired-session/login flow. |
| `403` | Show the backend message; the role or account status does not allow access. |
| `400` | Invalid technician ID, relevant to the admin path. |
| `404` | Technician not found. |
| `5xx`, network failure, timeout | Show **Unable to load work summary.** and a **Retry** action within the section. |

Error responses normally contain `success: false` and a `message`; use a readable fallback if missing. Keep null values as unavailable information rather than converting them to zero. Refresh after finishing a job, when returning to the profile, or through pull-to-refresh. Clear cached history when changing accounts.

## Acceptance checklist

- [ ] Correct technician token and endpoint are used; no technician ID is sent for self-profile requests.
- [ ] Rows show actual API names and counts without hardcoded work categories.
- [ ] Work subtypes and service types appear as separate expandable breakdowns.
- [ ] Server ranking is preserved.
- [ ] Null rates are hidden; null ratings show `N/A`; missing dates are omitted.
- [ ] Empty history, loading, retry, and expired-session states work.
- [ ] Category counts are not used to recalculate `totalJobs`.
- [ ] Layout works with long names and small screens.
- [ ] History refreshes after completed work and does not leak across account changes.

## Backend reference

- `backend/src/routes/technicianRoutes.js`
- `backend/src/routes/adminTechnicianRoutes.js`
- `backend/src/controllers/technicianWorkSummaryController.js`
- `backend/src/services/technicianWorkSummary.js`
- Web UI reference: `frontend/src/components/WorkSummary.jsx`
