# Admin job invitations

In **Jobs Management → job overview → Assign Technician**, choose an active technician and optionally enter a message. **Send Job Request** creates an admin invitation while the job stays open and unassigned. Existing technician applications still use the existing admin approval flow.

The technician sees invitations under **My Job Requests**, including the offered pay, job details, and **Accept Job / Reject Request** controls. Acceptance assigns the job and adds it to their jobs. Rejection leaves the job open. Other pending requests close when an invitation is accepted. Admin request conversations display that a response is awaited; admins cannot accept an invitation on behalf of the technician.

## API

- `POST /api/admin/technician-jobs/:jobId/invitations` — authenticated admin with `technician_jobs` write permission. Body: `{ "technicianId": "<user ID>", "message": "Optional instructions" }`.
- `GET /api/technician/requests` — includes invitations with `initiatedBy: "admin"`, `offeredPay`, and `status: "pending" | "accepted" | "rejected"`.
- `PATCH /api/technician/job-invitations/:requestId/respond` — invited technician only. Body: `{ "action": "accept" }` or `{ "action": "reject" }`.

A technician can receive one admin invitation per job. Repeated sends and repeated responses return 409. Only active technician accounts can be invited or accept; only open, unassigned jobs can be accepted. Pay is copied at invitation time and used for the agreed amount on acceptance. Acceptance does not credit the wallet; payment uses the existing completion/payment workflow.

The invitation and assignment writes use MongoDB transactions, requiring a replica set (including Atlas) or a sharded cluster. A standalone MongoDB server must be configured as a replica set before using this feature. The `unique_admin_job_invitation` partial unique index is defined on the request schema; deployments with automatic indexes disabled must create this schema index through their migration process.

Socket events refresh connected dashboards: `job:invitation` for the recipient, `request:updated` / `job:updated` for admins, and `job:availability` to refresh technician lists. Invitations remain in the database when recipients are offline and appear on refresh or their next login. This is an in-app request flow, not an SMS/email invitation.

Validation: backend invitation tests, admin modal interaction tests, and both production builds. Database transactions and concurrency have not been integration-tested against a live database in this workspace; automated controller tests mock database operations.
