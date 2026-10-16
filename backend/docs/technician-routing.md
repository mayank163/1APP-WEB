# Route Technician

`GET /api/admin/technician-jobs/:jobId/routing-candidates` requires admin identity and `technician_jobs:read`. Returns `{ success: true, data: { technicians } }`. Each technician includes name, phone, email, technicianId, photoUrl, profileImage, technicianProfile.photoUrl, serviceArea, isOnline, rating, ratingCount, primaryService, accountStatus, matchingJobCount, completedJobCount, isCurrentTechnician and alreadyInvited. completedJobCount counts all finished jobs, while matchingJobCount counts finished jobs matching the target work types.

Candidates must have an active account and at least one finished job (`checkout`, `completed`, or `closed`) matching either the target job's primary or additional work type. Work type IDs take precedence; names are matched case-insensitively when an ID is unavailable. Jobs with no work type use their category. Service type and subtype do not restrict matching. A past job counts once even when multiple work types match. Results sort by descending matchingJobCount, then name and ID.

`POST /api/admin/technician-jobs/:jobId/invitations` requires `technician_jobs:write` and accepts `{ technicianIds: ["...", "..."], message: "optional" }`. The previous single `technicianId` body remains supported. Recipient IDs are deduplicated and eligibility is rechecked inside the transaction. The whole batch fails if a recipient is unavailable, already invited, currently assigned to the job, or has no matching history. Successful batches return HTTP 201 with `data.requests` and the first request in `data.request` for compatibility. Notifications are sent after commit; push failure does not undo requests.

The dialog supports individual selection, select all available matches (or all visible search results), and clearing selection. Current and previously invited technicians remain visible but disabled. Existing invitation acceptance atomically assigns the first accepting technician and closes competing pending requests.

Verification: `node --test backend/test/*.test.js`. Controller tests use model stubs; live MongoDB transaction and notification delivery require an environment with the configured services.

Routing avatars use the same photo precedence as the technician page: `technicianProfile.photoUrl`, then `profileImage.url`, normalized into `photoUrl` by the API. The UI resolves it with `getImageUrl` and shows name initials when absent or when loading fails.
