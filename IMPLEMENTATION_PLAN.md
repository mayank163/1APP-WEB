# Technician Job Schedule Conflict Plan

## Objective

Prevent a technician from requesting or accepting a job when its scheduled date and time overlaps an already assigned active job.

Example:

- Existing assigned job: September 16, 4:00 PM to 6:00 PM
- New job: September 16, 5:00 PM to 7:00 PM
- Result: reject the new request

Back-to-back jobs are allowed:

- Existing job: 4:00 PM to 6:00 PM
- New job: 6:00 PM to 8:00 PM
- Result: allowed

## Current Data Model

The job model already stores the required scheduling and assignment fields in:

`backend/src/models/TechnicianJob.js`

Important fields:

- `jobDate.from`: scheduled start time
- `jobDate.to`: scheduled end time
- `assignedTechnician._id`: assigned technician
- `status`: current job status

Technician requests are stored in:

`backend/src/models/TechnicianJobRequest.js`

## Conflict Rule

Two time intervals overlap when:

```text
newStart < existingEnd AND newEnd > existingStart
```

This means that an end time equal to another job's start time is not a conflict.

### Blocking Job Statuses

Only these statuses should block a new job:

- `assigned`
- `ontheway`
- `visited`
- `inprogress`
- `in-progress`

These statuses should not block a new job:

- `open`
- `completed`
- `closed`
- `cancelled`

### Missing or Invalid Dates

For the initial implementation, allow the request when either date is missing or invalid. The conflict check only runs when both dates are valid and the end time is later than the start time.

A future improvement can require every schedulable job to have a valid date range.

### Timezone

Use JavaScript and MongoDB `Date` values for comparisons. Frontend clients should send timezone-aware ISO values, for example:

```text
2026-09-16T16:00:00.000Z
```

The frontend and backend must agree on the timezone used when converting a user's selected local time into an ISO timestamp.

## Implementation Steps

### 1. Create a Shared Schedule Service

Create a new file:

`backend/src/services/technicianScheduleService.js`

Add reusable functions that:

1. Read `job.jobDate.from` and `job.jobDate.to`.
2. Return no conflict when the interval is incomplete or invalid.
3. Query `TechnicianJob` for jobs where:
   - `assignedTechnician._id` matches the technician.
   - `status` is one of the blocking statuses.
   - `jobDate.from` is before the new interval's end.
   - `jobDate.to` is after the new interval's start.
4. Exclude the current job when validating a reschedule.
5. Return the conflicting job's ID, title, and date range for a useful error message.

Recommended MongoDB query shape:

```javascript
{
  'assignedTechnician._id': technicianId,
  status: { $in: BLOCKING_STATUSES },
  'jobDate.from': { $lt: newEnd },
  'jobDate.to': { $gt: newStart },
  _id: { $ne: excludedJobId }
}
```

The service should expose a consistent result, such as:

```javascript
{
  conflict: true,
  job: conflictingJob
}
```

or:

```javascript
{
  conflict: false,
  job: null
}
```

### 2. Validate Technician Self-Requests

Update:

`backend/src/controllers/technicianController.js`

Function:

`requestJob`

Run the schedule check after:

- Loading the requested job.
- Confirming the job exists.
- Confirming the job status is `open`.
- Confirming the technician has not already requested the same job.

Run it before creating `TechnicianJobRequest`.

When a conflict exists, return HTTP `409`:

```json
{
  "success": false,
  "message": "You already have another assigned job during this time.",
  "data": {
    "conflictingJobId": "...",
    "conflictingJobTitle": "..."
  }
}
```

The request must not be created when this response is returned.

### 3. Validate Admin Invitation Acceptance

Update:

`backend/src/controllers/jobInvitationController.js`

Function:

`respondToInvitation`

When the technician accepts an invitation:

1. Load the invitation's job and technician.
2. Run the shared conflict check.
3. Reject with HTTP `409` if another active assigned job overlaps.
4. Only then perform the atomic job assignment.

This is necessary because an invitation can bypass the normal self-request endpoint.

The conflict check should happen inside the existing transaction where possible.

### 4. Validate Approved Request Assignment

Update:

`backend/src/services/technicianRequestWorkflow.js`

Function:

`tryAssignApprovedRequest`

This function assigns a request after admin approval and additional-charge negotiation. Before claiming the job:

1. Load the request, job, and technician.
2. Run the shared conflict check.
3. If a conflict exists, return a structured conflict result or throw an error with status `409`.
4. Do not mark the job as assigned.
5. Do not mark the request as fully assigned.

This protects the flow when the request was approved earlier but another job was assigned to the technician before charge negotiation finished.

### 5. Validate Admin Request Approval

Update:

`backend/src/controllers/adminTechnicianController.js`

Function:

`updateTechnicianRequest`

For direct admin acceptance without pending charges, validate the technician's schedule before the atomic `findOneAndUpdate` that changes the job to `assigned`.

For requests with unresolved charges, the request may be marked as admin-approved and left waiting. The final conflict check must still run later in `tryAssignApprovedRequest` before assignment.

If the direct assignment finds a conflict:

- Return HTTP `409`.
- Do not save the request as assigned.
- Do not change the job status.

### 6. Protect Job Rescheduling

Update:

`backend/src/controllers/adminTechnicianController.js`

Functions:

- `updateTechnicianJob`
- `rescheduleJob`

When an already assigned job is given a new date range:

1. Parse the proposed start and end dates.
2. Validate that the start is before the end.
3. Run the shared conflict check using the assigned technician.
4. Exclude the current job ID from the query.
5. Return HTTP `409` if another active job overlaps.
6. Save the new dates only when no conflict exists.

This prevents an administrator from creating a conflict after the original assignment was valid.

### 7. Add Helpful Database Indexes

Review query performance after implementation. The schedule query filters by technician, status, and date fields.

A useful index to consider on `TechnicianJob` is:

```javascript
technicianJobSchema.index({
  'assignedTechnician._id': 1,
  status: 1,
  'jobDate.from': 1,
  'jobDate.to': 1,
});
```

MongoDB cannot use a normal index to solve all interval-overlap logic, but this index can reduce the candidate records that must be checked.

Add the index only after confirming the query plan with real data.

## Concurrency Protection

A simple pre-check alone cannot completely prevent two simultaneous assignments:

1. Request A checks availability.
2. Request B checks availability at the same time.
3. Both checks find no conflict.
4. Both assignments are saved.

The existing assignment operations already use atomic job claims for the target job. The implementation should also keep the conflict check immediately before the assignment operation.

For stronger protection, use a MongoDB transaction around:

- Conflict lookup.
- Target job claim.
- Request status update.

If strict scheduling guarantees are required under heavy concurrency, consider a technician schedule/lock collection or a transaction-based reservation design. A normal interval query by itself cannot guarantee uniqueness between concurrent requests.

## Error Handling

Use HTTP `409 Conflict` for schedule conflicts because the request is valid but cannot be accepted due to the technician's current schedule.

Suggested messages:

- `You already have an assigned job during this time.`
- `This invitation overlaps with one of your assigned jobs.`
- `The technician is not available during this time.`
- `This job cannot be rescheduled because it overlaps another assigned job.`

Do not expose unnecessary private job information. Returning the conflicting job title and time is usually enough for the technician or admin UI.

## Frontend Improvements

Backend validation must remain authoritative. Frontend checks are only for better user experience.

Optional frontend changes:

1. Add a schedule or availability endpoint for the logged-in technician.
2. Mark overlapping jobs as unavailable before the user opens the request dialog.
3. Disable the request button when the job conflicts.
4. Display the same conflict message returned by the backend.
5. Refresh availability after assignment, cancellation, completion, or rescheduling events.

Potential frontend areas:

- Technician jobs page.
- Job request modal.
- Technician dashboard.
- Admin invitation modal.

## Test Cases

The backend currently exposes only `start` and `dev` scripts in `backend/package.json`, so add a test setup or perform manual API verification.

### Schedule Logic Tests

- Existing job 4:00 PM to 6:00 PM; new job 3:00 PM to 5:00 PM: reject.
- Existing job 4:00 PM to 6:00 PM; new job 5:00 PM to 7:00 PM: reject.
- Existing job 4:00 PM to 6:00 PM; new job 6:00 PM to 8:00 PM: allow.
- Existing job 4:00 PM to 6:00 PM; new job 2:00 PM to 4:00 PM: allow.
- Existing job 4:00 PM to 6:00 PM; new job 3:00 PM to 7:00 PM: reject.
- Different technician with the same time: allow.
- Existing completed job: allow.
- Existing cancelled job: allow.
- Missing start or end date: allow under the current policy.
- Invalid date range: allow the conflict service to skip it, or reject it with HTTP `400` if general date validation is enabled later.

### Endpoint Tests

Test all assignment paths:

- Technician self-request through `POST /api/technician/jobs/:jobId/request`.
- Admin invitation acceptance through `PATCH /api/technician/job-invitations/:requestId/respond`.
- Admin request approval through `PATCH /api/admin/technician-requests/:requestId/status`.
- Automatic assignment after charge negotiation through the charges workflow.
- Admin rescheduling through `PATCH /api/admin/technician-jobs/:jobId/reschedule`.

For every conflict case, verify:

- Response status is `409`.
- A clear message is returned.
- No new assignment is created.
- The target job remains unchanged when applicable.
- The request status is not incorrectly marked as assigned.

## Suggested Implementation Order

1. Create and unit-test the shared schedule helper.
2. Add the check to technician self-requests.
3. Add the check to invitation acceptance.
4. Add the check to approved-request assignment.
5. Add the check to admin direct approval.
6. Add rescheduling protection.
7. Add indexes if query performance requires them.
8. Add frontend availability hints.
9. Run endpoint and concurrency verification.

## Scope Decisions

- Only active assigned jobs block new requests.
- Pending requests alone do not block a technician.
- Back-to-back jobs are allowed.
- Missing dates remain allowed for now.
- Dates are compared as timezone-aware MongoDB/JavaScript `Date` values.
- Backend enforcement is required; frontend enforcement is optional.
- Payment, notifications, unrelated booking logic, and unrelated technician workflows are outside this change.
