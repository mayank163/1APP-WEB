# Technician work order ratings

Admins can optionally rate an assigned technician while approving payment, or use **Rate technician** on a paid work order afterward. A work order accepts one rating. Admins need `technician_jobs` write permission.

The overall service score is visible to the technician:

| Score | Expectations |
| --- | --- |
| 1 | Far below |
| 2 | Below |
| 3 | Met |
| 4 | Exceeded |
| 5 | Far exceeded |

Team notes and criterion votes are private to admins and excluded from technician job queries. Notes accept rich text up to 5,000 characters and are displayed as plain text when reviewing feedback.

## APIs

Optional `feedback` on `POST /api/admin/technician-jobs/:jobId/pay`:

```json
{
  "discount": 0,
  "note": "Payment approved",
  "feedback": {
    "score": 4,
    "note": "<p>Good work.</p>",
    "criteria": { "communication": "up", "workQuality": "up" }
  }
}
```

Omit `feedback` to pay without rating. Invalid feedback is rejected before payment. If payment succeeds but feedback persistence fails, the payment response remains successful with `data.ratingWarning`; reload the work order and submit feedback separately rather than retrying payment.

For later feedback, `POST /api/admin/technician-jobs/:jobId/rating` accepts the feedback object directly. Only completed, paid work orders with an assigned technician can be rated. An already rated work order returns `409`. Invalid input returns `400`.

Criterion keys: `checkInTimeliness`, `communication`, `preparedness`, `onsiteEfficiency`, `deliverableTimeliness`, `professionalism`, `responsiveness`, `followingInstructions`, `workQuality`, `deliverableAccuracy`, `clientSatisfaction`, `technicalSkills`. Each selected value is `up` or `down`; omit unselected criteria.

Work order responses include `technicianRating.score`, `technicianRating.ratedAt`, and `technicianRating.ratedBy`. Admin job-list responses also include `privateTechnicianFeedback`.

Technician profiles store `workOrderRatings` (`job`, `score`, `ratedAt`), `rating`, and `ratingCount`. The admin technician list and technician dashboard response expose these fields. `rating` is the arithmetic mean across rated work orders, and `ratingCount` is their count. Unrated work orders are excluded. Before any ratings, the average is null and count is zero. With 100 rated work orders the average is their score sum divided by 100, regardless of additional unrated jobs.
