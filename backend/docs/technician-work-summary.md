# Technician work summary

Authenticated endpoints:
- `GET /api/technician/work-summary`: logged-in technician's own history.
- `GET /api/admin/technicians/:technicianId/work-summary`: requires admin identity and `technician_jobs:read` permission.

Returns `{ success: true, data: { technicianId, totalJobs, workTypes } }`.
Each work type contains `id`, `name`, `jobCount`, `lastCompletedAt`, `ratingCount`, `averageRating`, `averageHourlyRate`, `subTypes`, and `serviceTypes`. Child rows expose the same statistics without nested breakdowns. Dates are ISO strings; unavailable ratings, dates and hourly averages are null. Hourly averages use only jobs with hourly pay and a positive recorded hourly rate, in the project's USD currency.

Includes assigned jobs in `checkout`, `completed`, or `closed` status. Checkout means the technician finished work and is awaiting approval. Primary and additional work types both contribute; a job counts once per distinct group, subtype and service type. Overall total counts each job once, so category totals can exceed it. Legacy jobs without work types use their category. Unrecorded service types are omitted. No job descriptions, customer details, or private feedback are returned.

Invalid IDs return 400; nonexistent technicians return 404. Empty history returns zero jobs and an empty workTypes array.

Run summary tests with `node --test backend/test/technicianWorkSummary.test.js`.
