# Project review and improvement checklist

Reviewed: 11 September 2026

This is a repository-wide static review of the MERN backend, customer frontend, admin portal, package configuration, and existing tests. Findings below include concrete code defects and clearly labeled design improvements. Fix the critical authentication and payment issues before deploying this code with real accounts or payments.

## Scope and verification

- Inspected routing, authentication, permissions, payments, technician jobs, charges, withdrawals, uploads, catalog/blog handling, React authentication/cart/API flows, and representative pages and components. Large UI files received targeted review; this is not a claim that every line or browser interaction was tested.
- `node --test backend/test/technicianWorkflow.test.js`: **2 passed**. These cover summary arithmetic and status colors, not the actual technician workflow.
- `node --check` across **67 backend source JavaScript files**: all passed. Syntax success does not establish security or correct behavior.
- `CI=true npm test --prefix frontend -- --watchAll=false --runInBand`: failed before executing tests; cannot resolve `react-router/dom` from `react-router-dom`.
- `CI=true npm test --prefix admin -- --watchAll=false --runInBand`: failed before executing tests; cannot resolve `react-router-dom` from `src/App.js`.
- Confirmed that tracked `backend.zip` contains the entry `backend/.env`, by inspecting archive filenames only. Secret values were not inspected or copied into this report.
- Did not start the application against configured databases, send OTPs, upload documents, execute payments, run seeders, or test production infrastructure. Production builds, dependency vulnerability audits, browser accessibility checks, deployed S3 permissions, and live exploit reproduction remain unverified.
- Application source was not modified as part of this review.

**Priorities:** P0 = critical, fix immediately; P1 = high, address before production use; P2 = normal, next improvement cycle; P3 = cleanup. “Confirmed” means directly supported by source or the local checks above; “conditional” means impact depends on configuration or a business rule.

## Security

### S01 — P0 — Restore admin password verification [confirmed]

**Location:** [adminController.js](backend/src/controllers/adminController.js), `login`, line 20; password comparison around line 41.

The bcrypt comparison and rejection are commented out. A matching admin email and any nonempty password produce an admin token, including for a super admin.

- [ ] Restore `await admin.comparePassword(password)` and reject mismatches before signing a token.
- [ ] Reject inactive admins at login and on subsequent authenticated requests.
- [ ] Add request validation and admin login throttling. After fixing the bypass, invalidate existing admin sessions if this version was accessible to others.

**Acceptance:** incorrect passwords, missing passwords, unknown emails, and inactive accounts receive no token; valid active accounts still work.

### S02 — P0 — Remove universal OTP and OTP disclosure [confirmed]

**Locations:** [otpService.js](backend/src/utils/otpService.js), `verifyOTP`, line 95; [authController.js](backend/src/controllers/authController.js), `startRegister`, `forgotPassword` (375), `resetPassword` (420); [technicianAuthController.js](backend/src/controllers/technicianAuthController.js), line 142; frontend `SignupPage.jsx` and `OtpVerify.jsx`.

`999999` is accepted unconditionally. Password reset calls this verifier, so knowledge of a registered phone number is enough to reset its password without receiving an OTP. Customer registration and forgot-password responses also return `devOtp` without a production guard. OTPs are printed in server logs.

- [ ] Remove bypasses from production code and remove OTP values from API responses, logs, and user-facing forms.
- [ ] Use cryptographically generated codes, store only protected verification data, enforce expiration and attempt limits, and consume each challenge once.
- [ ] Bind each challenge to its purpose: registration, phone change, or password reset. The shared phone-keyed store currently does not separate these purposes.
- [ ] Make delivery failures visible; do not report successful delivery after silently falling back to console simulation.

**Acceptance:** the fixed code fails; expired/reused/wrong-purpose codes fail; reset responses and logs never contain a code. Use fake delivery adapters only in isolated tests.

### S03 — P0 — Verify payments using trusted provider evidence [confirmed]

**Locations:** [bookingController.js](backend/src/controllers/bookingController.js), `verifyPayment`, line 148, especially line 189; [razorpay.js](backend/src/config/razorpay.js).

The Razorpay branch accepts `status === 'success'` or a client-supplied mock identifier. It never verifies the signature. `verifyPayment` also loads any booking ID without an ownership check. The Stripe branch checks booking metadata only when that metadata is present; it does not require the stored order ID, amount, currency, or expected provider to match.

- [ ] Scope customer verification to the authenticated booking owner.
- [ ] Select the provider from the stored booking, not from which fields the client sends.
- [ ] Verify Razorpay signatures against the server-stored order ID and verify the captured payment amount/currency/order through the provider.
- [ ] Require the stored Stripe PaymentIntent ID, expected amount/currency, successful status, and matching booking identity.
- [ ] Remove production mock fallbacks and fail startup when the selected provider is misconfigured.
- [ ] Make finalization idempotent: a repeated or failed verification must not downgrade a paid booking or revive a cancelled booking.

**Acceptance:** fake success, mock IDs, another customer's booking, reused payment IDs, mismatched amounts, and wrong-provider requests cannot mark a booking paid.

Provider references: [Razorpay checkout verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [Stripe payment status verification](https://docs.stripe.com/payments/payment-intents/verifying-status).

### S04 — P0 — Authenticate sockets and authorize room membership [confirmed]

**Locations:** [server.js](backend/src/server.js), connection handlers; [socketEvents.js](backend/src/utils/socketEvents.js); [admin socket.js](admin/src/services/socket.js); [SocketContext.jsx](frontend/src/context/SocketContext.jsx).

No socket authentication middleware is registered. Any connected client can join `admin`, arbitrary request/job rooms, or another technician's room. Location events trust client-supplied technician/job IDs and are relayed to administrators. This exposes event data and permits tracking spoofing.

- [ ] Verify access tokens during connection setup and derive identity on the server.
- [ ] Check role, current permissions, and request/job ownership before every room join and privileged event.
- [ ] Permit location publishing only for the assigned technician; validate finite coordinate ranges and event frequency.
- [ ] Handle missing/malformed event payloads safely, expire authorization, and disconnect on logout or revocation.
- [ ] Connect admin sockets after authentication and send refreshed credentials on reconnect.

**Acceptance:** anonymous connections are refused; unrelated accounts cannot watch jobs or conversations; a technician cannot publish someone else's location.

Implementation reference: [Socket.IO authentication middleware](https://socket.io/docs/v4/middlewares/). Connection authentication must be supplemented by application-specific authorization for rooms and events.

### S05 — P1 — Remove secret-bearing archives from source control [confirmed archive; secret validity unverified]

**Locations:** [backend.zip](backend.zip), [.gitignore](.gitignore).

`backend.zip` is tracked and contains `backend/.env`. Ignoring `.env` does not protect files inside an archive. Whether those values are real or still active was not inspected.

- [ ] Inspect the archive privately and rotate any real credentials that have been shared through repository access.
- [ ] Remove deployment/source archives from tracked application source; add appropriate archive/build exclusions.
- [ ] If actual secrets were committed, coordinate history cleanup and credential revocation; deleting the latest copy alone is insufficient.
- [ ] Supply sanitized `.env.example` files and add secret scanning that also accounts for packaged artifacts.

**Acceptance:** tracked artifacts contain no real credentials; a clean checkout can be configured from documented examples.

### S06 — P1 — Enforce admin identity, active status, and permissions consistently [confirmed]

**Locations:** [auth.js](backend/src/middleware/auth.js); [technicianRoutes.js](backend/src/routes/technicianRoutes.js), lines 18 and 31; [adminRoutes.js](backend/src/routes/adminRoutes.js); sub-admin handlers in [adminController.js](backend/src/controllers/adminController.js).

`restrictTo` treats an account without a role as admin. Admin records currently have no explicit role. `checkPermission` allows super admins before checking active status. The technician request status route requires only an admin role and bypasses the `technician_jobs` permission used by the parallel admin route. Sub-admin writers can modify their own permissions; the route comment promises super-admin-only management, but no such guard exists.

- [ ] Set an explicit authenticated principal type and deny unknown types; avoid role inference from a missing property.
- [ ] Reject inactive principals before all permission bypasses.
- [ ] Use the same resource checks on every admin-capable endpoint, including conversation reads and legacy status updates.
- [ ] Enforce super-admin-only delegation if that is the intended policy. Otherwise explicitly limit which permissions a delegated admin can grant, including to themselves.
- [ ] Add a permission matrix covering customers, technicians, inactive admins, read-only admins, writers, and super admins.

**Acceptance:** a read-only or unrelated sub-admin cannot mutate technician requests or grant themselves broader access.

### S07 — P1 — Add endpoint-specific validation and abuse controls [confirmed]

**Locations:** [server.js](backend/src/server.js), commented limiter around line 114; [validation.js](backend/src/middleware/validation.js); auth/admin/technician/cart routes; [route.routes.js](backend/src/routes/route.routes.js).

The API rate limiter is disabled. Several endpoints accept arbitrary shapes with only truthiness checks. Admin login passes `email` directly into a MongoDB query. `/api/routes/directions` is public and forwards requests to a billed external API after checking only whether origin/destination exist.

- [ ] Validate scalar types before building queries; reject object/operator payloads, invalid IDs, unsupported enums, oversized arrays, and non-finite numbers.
- [ ] Add limits for login, OTP sending/checking, reset, uploads, and routing, using account and IP dimensions where appropriate.
- [ ] Bound coordinate ranges and protect directions with authentication or an explicit public quota.
- [ ] Escape search inputs if moving searches into regular expressions; apply pagination and maximum lengths.
- [ ] Keep validation after multipart parsing for multipart fields. The global JSON-body sanitizer does not process fields that Multer parses later.

**Acceptance:** invalid input returns useful 400 responses, excessive requests return 429, and external-service usage cannot grow without bounds.

### S08 — P1 — Strengthen token lifecycle and session revocation [confirmed gaps; fallback impact conditional]

**Locations:** refresh handlers in [authController.js](backend/src/controllers/authController.js), line 573, and [technicianAuthController.js](backend/src/controllers/technicianAuthController.js), line 521; [auth.js](backend/src/middleware/auth.js); frontend auth/API services.

Refresh verification falls back to a known literal secret if configuration is missing. There is no stored refresh-session rotation or revocation. Password changes do not invalidate existing tokens. Customer access-token signing defaults to `7d`, while the response reports `15m` when `JWT_EXPIRE` is absent. `protect` does not check an access-token purpose claim.

- [ ] Require distinct configured secrets and consistent issuer, audience, token purpose, and expiration rules.
- [ ] Store revocable refresh sessions, rotate tokens, and detect reuse; revoke sessions on reset/logout where applicable.
- [ ] Use short-lived access tokens and return accurate expiry metadata.
- [ ] Review browser storage: both access and refresh tokens are accessible to JavaScript in localStorage. Prefer a deliberate session design with protected refresh cookies where deployment allows it, including appropriate CSRF defenses.

**Acceptance:** old sessions fail after revocation, refresh tokens cannot act as access tokens, and missing secrets prevent startup.

### S09 — P1 — Bound and validate uploads; protect private documents [confirmed limits; cloud exposure unverified]

**Locations:** [upload.js](backend/src/middleware/upload.js); [blogRoutes.js](backend/src/routes/blogRoutes.js); [s3Upload.js](backend/src/utils/s3Upload.js); technician verification/profile handlers.

Uploads use memory storage and generally allow 50 MB per file. Service uploads allow 81 files, and blog uploads allow 51, permitting several gigabytes of file data in one request. MIME checks trust the client's MIME label, and original extensions are retained. The same upload helper handles public media and identity/tax/bank documents.

- [ ] Apply smaller per-purpose file limits plus total request, file-count, field-count, and concurrency limits.
- [ ] Validate actual file signatures; decode/re-encode supported images, reject unsupported active formats, and inspect document uploads appropriately.
- [ ] Separate public media from private documents; provide authorized short-lived document access and least-privilege storage policies.
- [ ] Mask bank details in list responses and restrict full details to authorized workflows.
- [ ] Confirm deployed bucket policies, encryption, retention, and access logging. Public exposure is not established by this source review.

**Acceptance:** spoofed/oversized files are rejected and an unauthenticated browser cannot retrieve a technician's private document.

### S10 — P1 — Honor publication and visibility on public reads [confirmed]

**Locations:** [blogController.js](backend/src/controllers/blogController.js), `getAllBlogs` and `getBlogById`; [serviceController.js](backend/src/controllers/serviceController.js), `getAllServices`, line 251.

Public blog queries do not filter `isPublished`, so drafts are retrievable. The public service list starts with an empty filter and can include soft-deleted/inactive services.

- [ ] Require published/active records on public lists and detail reads.
- [ ] Create permission-protected editorial endpoints for administrators who need drafts or inactive records.
- [ ] Apply parent category/subcategory visibility rules consistently.

**Acceptance:** anonymous list and direct-ID requests cannot retrieve drafts; inactive services do not appear as bookable options.

### S11 — P2 — Make CORS, errors, and HTML handling explicit [confirmed configuration; XSS exploit unverified]

**Locations:** [server.js](backend/src/server.js); [security.js](backend/src/middleware/security.js); [TechnicianJobs.jsx](admin/src/pages/TechnicianJobs.jsx), line 1090.

HTTP CORS combines wildcard origin with credentials, while socket settings and clients use different credential policies. Errors expose raw `err.message`. Admin job descriptions use `dangerouslySetInnerHTML`; there is a global sanitizer, but its coverage depends on request parsing order and it does not establish a policy for stored HTML from every source.

- [ ] Use configured trusted origins and one consistent credential policy. CORS does not replace authorization.
- [ ] Return stable public errors, map validation/duplicate-ID errors to appropriate statuses, and keep internal details in redacted logs.
- [ ] Define and test a narrow HTML allowlist at the rich-text storage/render boundary, including multipart writes and legacy stored records.
- [ ] Serve security headers on static uploads too; the static handler currently precedes Helmet.

**Acceptance:** supported origins work, credentials are configured consistently, invalid records return controlled errors, and unsafe rich-text payloads do not execute.

## Functionality and data integrity

### F01 — P1 — Make wallet credits atomic and prevent duplicate payments [confirmed]

**Locations:** [adminTechnicianController.js](backend/src/controllers/adminTechnicianController.js), `payTechnicianWallet`, line 630; [chargesController.js](backend/src/controllers/chargesController.js), `markInvoicePaid`, line 998.

The direct wallet endpoint credits earnings every time it is called for a completed job; there is no already-paid guard. Invoice payment checks status but updates invoice, request, technician, and job in separate saves. Failures or competing requests can leave inconsistent records. Both paths can credit the same work.

- [ ] Route both endpoints through one payment service with a unique payment/ledger identity per job or invoice.
- [ ] Atomically transition unpaid to paid and update the ledger/balance within a transaction.
- [ ] Return the existing result on retry; record actor, amount, currency, and reason.

**Acceptance:** repeated and concurrent calls across both endpoints create exactly one credit; injected failures leave no partial paid state.

### F02 — P1 — Reserve withdrawal funds and implement settlement [confirmed]

**Locations:** [technicianController.js](backend/src/controllers/technicianController.js), `createWithdrawalRequest`, line 1180; [TechnicianWithdrawal.js](backend/src/models/TechnicianWithdrawal.js); withdrawal routes.

Availability subtracts only `totalWithdrawn`. Creating a pending withdrawal does not reserve funds or include existing pending withdrawals, allowing repeated requests against the same balance. The exposed routes provide create/list but no withdrawal approval, rejection, or settlement workflow.

- [ ] Atomically reserve funds and enforce finite positive amounts with currency precision.
- [ ] Add authorized approval/rejection/settlement handlers with provider reconciliation and idempotency.
- [ ] Release reservations on rejection and update settled totals only once.

**Acceptance:** two requests cannot reserve more than the balance; failed/rejected withdrawals restore availability correctly.

### F03 — P1 — Add durable payment completion and cancellation/refund handling [confirmed missing flow]

**Locations:** [bookingController.js](backend/src/controllers/bookingController.js); [bookingRoutes.js](backend/src/routes/bookingRoutes.js); [Booking.js](backend/src/models/Booking.js).

Completion relies on the browser calling `/verify`; no provider webhook route is registered. Booking creation and provider creation are separate operations without an idempotency key. Cancellation changes booking status without a refund lifecycle. It also references an undefined `Job` variable behind `if (booking.job)`, while the Booking schema has no `job` field, so this is broken/unreachable integration code rather than a guaranteed crash on every cancellation.

- [ ] Add signature-verified, deduplicated webhooks, preserving raw request bytes where required by the provider.
- [ ] Add creation idempotency and reconciliation for orphaned orders or bookings after partial failures.
- [ ] Define cancellation/refund rules and store pending/refunded/failed refund states.
- [ ] Implement a real booking-to-technician-job relationship or remove the obsolete branch; update related state consistently.

**Acceptance:** closing checkout after successful payment still confirms the booking; duplicate callbacks do not duplicate effects; cancellations and refunds remain consistent.

### F04 — P1 — Define technician eligibility and workflow transitions [confirmed missing checks; eligibility policy to confirm]

**Locations:** [technicianController.js](backend/src/controllers/technicianController.js), `requestJob`, line 491; [technicianAuthController.js](backend/src/controllers/technicianAuthController.js), `submitForVerification` and `reuploadDocument`; request/job status handlers.

Job requests check role and open-job status but do not check technician verification status. Submission marks an application pending without verifying required document completeness. Single-document replacement resets that document to pending without explicitly resetting the overall verification state.

- [ ] If approval is required to work, enforce it on the server when bidding, assigning, and starting jobs.
- [ ] Validate required profile/documents before submission and define whether replacements suspend approval.
- [ ] Centralize allowed job/request/charge transitions with conditional database updates; reject stale transitions and concurrent double assignment.
- [ ] Define whether payment may complete a job automatically: `markInvoicePaid` currently sets job completion independently of task evidence.

**Acceptance:** ineligible technicians cannot start work, incomplete applications cannot be submitted as complete, and competing assignments produce one winner.

### F05 — P2 — Fix concurrent blog image mapping [confirmed]

**Location:** [blogController.js](backend/src/controllers/blogController.js), lines 38–44 and 95–101.

`Promise.all` callbacks share `imageIndex`, but increment it after awaiting an upload. Multiple blocks can read the same index before the first upload completes, causing repeated/wrong images.

- [ ] Assign each block's file index synchronously before asynchronous uploads, or use an explicit sequential loop.
- [ ] Validate block/file counts and remove uploaded files if persistence fails.

**Acceptance:** a blog with three different block images preserves each image's correct position under delayed uploads.

### F06 — P2 — Make media replacement failure-safe [confirmed]

**Locations:** upload/reupload handlers in [authController.js](backend/src/controllers/authController.js), [technicianAuthController.js](backend/src/controllers/technicianAuthController.js), and [blogController.js](backend/src/controllers/blogController.js).

Several handlers delete the old file before uploading and saving the replacement. Upload/database failure then leaves the saved record pointing to a deleted file. Blog deletion does not clean up its media.

- [ ] Upload the replacement, persist the new key, then schedule deletion of the old object.
- [ ] Clean up newly uploaded objects on failure and use a retryable cleanup queue for orphaned files.

**Acceptance:** failed replacement leaves the old file usable; successful deletion eventually removes associated unused objects.

### F07 — P2 — Fix customer phone login and authentication state recovery [confirmed]

**Locations:** [authService.js](frontend/src/services/authService.js); [api.js](frontend/src/services/api.js); [AuthContext.jsx](frontend/src/context/AuthContext.jsx); customer login validation/controller.

The frontend accepts email or phone, but customer login requires email. On any error it retries the technician endpoint, which restricts accounts to technicians. Customer phone login therefore cannot work as advertised. A 401 clears localStorage without notifying AuthContext, and the stored refresh token is never used by the API interceptor.

- [ ] Implement a validated customer identifier login or remove phone login from that UI.
- [ ] Avoid changing login endpoints on network/server errors; choose the account flow explicitly.
- [ ] Coordinate token refresh, retry once, and update context on terminal authentication failure.
- [ ] Avoid treating temporary network errors as proof that the session is invalid.

**Acceptance:** customer and technician login options match the server contract; expired sessions recover or log out consistently without stale protected UI.

### F08 — P2 — Fix cart races and reject invalid cart items [confirmed]

**Locations:** [CartContext.jsx](frontend/src/context/CartContext.jsx), two authentication effects and guest `addToCart`; [cartController.js](backend/src/controllers/cartController.js).

Login launches a cart fetch and a guest-cart merge independently. A late fetch can overwrite the merged state. Requests can also resolve after logout. Guest `addToCart` mutates a local return flag inside a React state updater, whose execution timing should not determine the function's result. Server mutations accept service IDs without checking that the service exists/is active and loosely parse quantities.

- [ ] Sequence merge then load; cancel or ignore responses belonging to an earlier user/session.
- [ ] Use pure state updates and a reliable add/duplicate result contract.
- [ ] Validate service existence, integer bounds, cart size, and concurrent changes on the server.
- [ ] Handle populated `null` services after catalog changes without breaking rendering.

**Acceptance:** slow responses do not erase merged items or restore a previous user's cart; invalid/deleted services and malformed quantities are rejected cleanly.

### F09 — P2 — Implement real scheduling and consolidate booking clients [confirmed gaps]

**Locations:** [validation.js](backend/src/middleware/validation.js), `validateBooking`; [bookingController.js](backend/src/controllers/bookingController.js); [bookingApi.js](frontend/src/services/bookingApi.js); [bookingService.js](frontend/src/services/bookingService.js).

Booking validation only requires nonempty date/time values; there is no server capacity/availability reservation. The separate `bookingApi.js` calls a nonexistent `/api/slots`, invents fallback slots, and reads localStorage key `token` instead of `1App_token`. No imports of that module were found, so its client bugs are currently dormant.

- [ ] Define service timezone, lead time, opening hours, and capacity rules, then validate/reserve slots on the server.
- [ ] Handle concurrent bookings and expired payment holds.
- [ ] Remove the unused booking client or consolidate it into the active API service; never present invented availability after an API failure.

**Acceptance:** past/out-of-hours/full slots are rejected, and simultaneous checkout cannot exceed capacity.

### F10 — P2 — Replace simulated contact and coupon behavior [confirmed]

**Locations:** [ContactUs.jsx](frontend/src/pages/ContactUs.jsx), `handleSubmit`; [OfferManagement.jsx](admin/src/pages/OfferManagement.jsx).

The contact form waits 800 ms and reports success without sending or saving the message. Offers exist only in component state and disappear on refresh; they are not part of server-side booking pricing.

- [ ] Implement a validated contact endpoint with durable delivery and abuse controls, or clearly mark the form unavailable.
- [ ] Persist offers with authorized CRUD, expiry/eligibility/usage rules, and server-side price calculation, or remove the unfinished feature from production navigation.

**Acceptance:** contact success corresponds to an accepted submission; offers survive reload and discounts cannot be forged by the client.

### F11 — P2 — Correct admin session hydration and task-completion contract [confirmed]

**Locations:** [admin App.js](admin/src/App.js); [AdminAuthContext.jsx](admin/src/context/AdminAuthContext.jsx); [adminApi.js](admin/src/services/adminApi.js), `completeTask`; [technicianRoutes.js](backend/src/routes/technicianRoutes.js), line 41.

Admin route protection checks only token presence and restores permissions from localStorage without a server identity refresh. `PermRoute` returns nothing if admin metadata is absent, which can leave a blank page. The admin API's task-completion method targets an endpoint restricted to technicians.

- [ ] Add a server-backed admin `/me` flow with loading/error/expired-session states and current permissions.
- [ ] Clear the token, cached identity, and socket together on logout.
- [ ] Decide whether administrators can complete tasks. If yes, provide an explicitly permissioned override with an audit trail; otherwise remove the mismatched admin action.

**Acceptance:** stale/missing admin metadata never produces an indefinite blank screen; every visible action has a compatible authorized endpoint.

### F12 — P2 — Fix invoice numbering and currency consistency [confirmed]

**Locations:** [JobInvoice.js](backend/src/models/JobInvoice.js), line 95; payment controllers and technician messages.

Invoice numbers use `countDocuments() + 1`, so concurrent inserts can choose the same number, and deleting records can make numbering collide. Currency appears as USD, configurable Stripe currency, `$`, and `₹` in different paths; invoices/bookings do not consistently snapshot currency.

- [ ] Allocate invoice numbers with an atomic sequence or another collision-safe identifier.
- [ ] Persist currency and monetary amounts in integer minor units, with one formatting utility per UI.
- [ ] Make charge rounding and provider-supported currency rules explicit.

**Acceptance:** parallel invoice creation produces unique numbers, and stored totals, provider charges, and displayed currency agree.

### F13 — P2 — Fix email validation and registration state [confirmed]

**Locations:** [User.js](backend/src/models/User.js), email validation around line 16; pending registration maps in both auth controllers.

The model's email regex limits the final domain segment to two or three word characters, rejecting valid longer domains. Pending registrations and OTPs live only in process memory, with entries generally removed only when accessed; customer pending registration also retains the plaintext password until completion/expiry handling.

- [ ] Use one consistent email validator and canonical email/phone normalization across login, registration, and profile changes.
- [ ] Move challenges to a shared expiring store, enforce automatic cleanup, and avoid retaining plaintext passwords in pending records.
- [ ] Bind verified signup challenges to an unguessable client-held token and consume them atomically, rather than relying only on a shared email/phone key.

**Acceptance:** valid long-domain emails register; verification works across multiple application instances; expired records disappear automatically.

## Readability, maintainability, and operations

### R01 — P1 — Restore a working test baseline and cover actual business flows [observed failures]

**Locations:** all package manifests; [frontend App.test.js](frontend/src/App.test.js); [admin App.test.js](admin/src/App.test.js); [technicianWorkflow.test.js](backend/test/technicianWorkflow.test.js).

Both React suites fail in module resolution with the current installed dependencies. Their assertions still target the starter “learn react” link. The backend has no test script and only two utility tests.

- [ ] Reproduce installations from each lockfile and diagnose the installed dependency graph and Jest resolver/export compatibility. Do not assume an application runtime failure solely from the test resolver error.
- [ ] Replace starter assertions with route/authentication tests and establish scripts for backend tests, frontend tests, lint, and builds.
- [ ] Prioritize regression tests for S01–S04, permission boundaries, duplicate credits, concurrent withdrawals, payment callbacks, cart merge, and multipart uploads.
- [ ] Add CI that runs these checks with isolated databases and fake payment/email/storage providers.

**Acceptance:** one documented command runs each suite successfully; critical negative and concurrent paths are covered.

### R02 — P2 — Split large controllers and pages by responsibility [design improvement]

**Locations:** `backend/src/controllers/technicianController.js` (2,591 lines), `chargesController.js` (1,060), `frontend/src/pages/TechnicianDashboard.jsx` (2,348), `Home.jsx` (1,492), `admin/src/pages/SubcategoryManagement.jsx` (1,816), `TechnicianJobs.jsx` (1,354).

- [ ] Extract technician assignment, conversation, charges, invoices, and wallet services; keep HTTP parsing/response handling in controllers.
- [ ] Extract page sections and hooks for data loading, forms, modals, and subscriptions.
- [ ] Move unusually fragmented one-expression-per-many-lines formatting into a consistent formatter configuration.
- [ ] Refactor after adding behavior tests, in small changes that preserve API contracts.

**Acceptance:** a payment rule or task transition has one implementation and can be tested independently from Express or a whole page.

### R03 — P2 — Centralize contracts, names, status constants, and configuration [design improvement]

**Locations:** both `src/services` directories, both auth contexts, [admin App.js](admin/src/App.js), [jobStatus.js](admin/src/utils/jobStatus.js), backend models/controllers.

There are duplicate API clients and token-key conventions; component names do not clearly match routes (`services` renders `SubcategoryManagement`, and `subcategories` renders `CategoryManagement`). Status/currency/event strings are repeated across layers.

- [ ] Publish request/response schemas and status transition contracts, ideally as OpenAPI plus shared types or generated clients.
- [ ] Consolidate API base URL, media base URL, socket URL, token keys, status labels, resource names, and money formatting.
- [ ] Rename or reorganize catalog components so filenames describe their actual entity.
- [ ] Remove unused clients/controllers/components only after checking imports; eliminate obsolete commented code and inaccurate endpoint comments.

**Acceptance:** changing an endpoint or status does not require guessing across duplicate clients, and route names match the screen they render.

### R04 — P2 — Fix Express 5 sanitization compatibility [confirmed code/API mismatch]

**Location:** [security.js](backend/src/middleware/security.js), line 22; [backend package.json](backend/package.json).

The project declares Express 5 but assigns `req.query = clean(req.query)`. Express 5 exposes `req.query` as a getter; this assignment must not be relied on to replace query data. In non-strict CommonJS it can be ignored rather than necessarily throwing.

- [ ] Parse and validate into an explicit field such as `req.validated.query` or `res.locals`, and make controllers use that validated data.
- [ ] Avoid indiscriminate XSS transformations of passwords and non-HTML fields; apply field-specific validation and HTML sanitization where needed.
- [ ] Verify request body/query/parameter behavior with the installed Express version before enabling old sanitization middleware.

**Acceptance:** invalid query data is rejected and valid query values are the values controllers actually consume. Reference: [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/).

### R05 — P2 — Make startup, configuration, and database migrations predictable [confirmed gaps]

**Locations:** [server.js](backend/src/server.js); [database.js](backend/src/config/database.js); payment/provider config; root and application package manifests.

The server begins listening independently of database connection success, health always reports success, and startup drops database indexes. `PORT` has no validated default. DNS servers are hard-coded. Root `server` invokes nodemon although it is declared in the backend package, and the root clean script uses Windows-only commands despite this workspace being on macOS. Frontend and admin proxies also default to different ports.

- [ ] Validate environment configuration once, await database readiness, and fail startup clearly on required-service failure.
- [ ] Separate readiness from liveness and add graceful HTTP/socket/database shutdown.
- [ ] Move index changes to explicit versioned migrations with documented rollback/backup plans.
- [ ] Use platform/network defaults unless an override is explicitly configured.
- [ ] Delegate root scripts to package-local scripts, make maintenance commands cross-platform, and document consistent local ports.

**Acceptance:** a clean setup has one reliable startup procedure; an unavailable database cannot produce a healthy ready status; restarts do not silently change schema indexes.

### R06 — P2 — Paginate reads, minimize projections, and add targeted indexes [confirmed unbounded reads; index choices need measurement]

**Locations:** [adminController.js](backend/src/controllers/adminController.js), booking/user lists; [serviceController.js](backend/src/controllers/serviceController.js), service listing; [blogController.js](backend/src/controllers/blogController.js); technician listing/conversation handlers.

Several endpoints load every matching document and sometimes search/filter in JavaScript after fetching it. Full user/service populations increase response size and couple API outputs to internal schemas.

- [ ] Add bounded pagination, server-side filtering, field projections, and stable sorting.
- [ ] Use query plans to select indexes for actual user/status/date/job filters, rather than indexing every field.
- [ ] Return explicit response objects and paginate long conversations separately.
- [ ] Batch service lookups during booking creation and avoid per-category lookups where an aggregation suffices.

**Acceptance:** response size and memory use remain bounded as data grows; common queries have measured plans and do not reveal unrelated profile fields.

### R07 — P2 — Improve async error handling, notifications, and auditability [confirmed gaps]

**Locations:** [socketEvents.js](backend/src/utils/socketEvents.js), `safeEmit` and `emitVerificationUpdated`; notification/email calls throughout controllers; [server.js](backend/src/server.js).

`safeEmit` wraps a callback in synchronous `try/catch`, but `emitVerificationUpdated` passes an async callback, so later promise rejections escape that catch. Important emails are fire-and-forget, and mutations lack a dedicated audit trail.

- [ ] Await or explicitly catch asynchronous socket callback failures.
- [ ] Queue critical notifications with retries and delivery state; emit events after successful persistence.
- [ ] Add structured, redacted logs with request/event IDs and audit records for permission changes, document decisions, money movements, and status overrides.
- [ ] Add timeouts to external requests, including the Google routing request, and handle timeouts distinctly from invalid user input.

**Acceptance:** simulated provider/socket failures are observable without unhandled rejections or silently lost critical work.

### R08 — P2 — Add resilient, accessible UI states [design improvement with observed layout risks]

**Locations:** [frontend App.js](frontend/src/App.js), [admin App.js](admin/src/App.js), authentication pages, [ContactUs.jsx](frontend/src/pages/ContactUs.jsx), image/upload and table components.

- [ ] Add explicit not-found routes, route error boundaries, and meaningful loading/empty/retry states; avoid blank permission/session screens.
- [ ] Replace rigid two-column inline grids in contact/auth screens with responsive layouts and verify at small viewport widths.
- [ ] Associate labels with inputs, name icon-only controls, and ensure modal focus management and keyboard operation.
- [ ] Disable duplicate submissions while requests are pending, preserve values on failure, and distinguish rejected actions from network outages.
- [ ] Reset image loading/error state when an image source changes; `AdminImage` currently initializes this state only once.

**Acceptance:** core signup, checkout, and admin forms work on a narrow screen with keyboard-only navigation and recover visibly from errors. Browser verification is still required.

### R09 — P3 — Simplify tooling, dependencies, and project documentation [design improvement]

**Locations:** root/application package manifests, [.gitignore](.gitignore), [frontend README.md](frontend/README.md).

- [ ] Document supported Node/npm versions and clean install/test/build commands; use lockfile-based installs in CI.
- [ ] Review why React/UI packages and `all` are root dependencies; keep dependencies in the package that uses them.
- [ ] Remove obsolete router v5 typings from the customer frontend if using router v7 types, and align each app's tooling with its React/router versions.
- [ ] Run dependency audits and inspect actual advisory impact before upgrades. No CVE/version vulnerability conclusion was made in this review.
- [ ] Add a project README with environment variable names, architecture, role/permission model, status flows, payment setup, and deployment steps.
- [ ] Add formatter/linter configuration, remove duplicate ignore entries, and keep generated output out of source control.

**Acceptance:** a new contributor can run the project and checks from a clean checkout without undocumented local state.

## Suggested implementation order

1. **Immediate:** S01–S04. Close admin login, OTP reset, payment verification, and socket access bypasses. Privately inspect S05 and revoke exposed credentials/sessions if applicable.
2. **Before production use:** S06–S10, F01–F04, R01. Establish authorization, validated requests, session management, upload privacy, and reliable financial transitions with regression tests.
3. **Next correctness cycle:** F05–F13 and R04–R07. Fix content/cart/login/scheduling behavior, configuration, reliability, and unbounded reads.
4. **Maintainability cycle:** S11, R02–R03, R08–R09. Consolidate contracts, split large files, finish UI states, and improve documentation/tooling.

Each checklist entry should become a small tracked issue with its acceptance criteria. Security findings above describe the checked-in behavior; no claim is made about whether those defects have been exploited or whether deployed infrastructure compensates for them.
