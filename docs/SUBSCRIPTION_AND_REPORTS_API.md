# Subscription and Reports API

Base URL: `/api/v1/hostel-ghar`
Auth: `Authorization: Bearer <token>` or `access_token` cookie.
Owner routes also accept `admin`.

## 1 Subscription overview

Owner-scoped, optionally hostel-scoped. No ACTIVE non-expired row
means FREE fallback. Mount: `routes.use('/subscriptions', router)`.

| Method                         | Auth     | Roles       | Hostel   | Use                          |
| ------------------------------ | -------- | ----------- | -------- | ---------------------------- |
| GET /subscriptions/plans       | optional | public      | no       | list 4 tiers + isCurrent     |
| GET /subscriptions/current     | yes      | owner admin | required | plan + usage + daysRemaining |
| POST /subscriptions/subscribe  | yes      | owner admin | required | create or upgrade            |
| POST /subscriptions/cancel     | yes      | owner admin | required | expire to FREE               |
| GET /subscriptions/history     | yes      | owner admin | no       | rows newest first            |
| GET /subscriptions/check-limit | yes      | owner admin | required | resident capacity            |

GET plans uses optionalAuthenticate. Valid token personalizes
isCurrent. Anonymous uses FREE. Invalid token ignored.

## 2 Plans and limits

File: `src/constant/subscription.constant.ts`. Currency NPR.
null means unlimited.

FREE Free 0 Free/mo residents 10 hostels 1 CTA Current Plan badge Current.
BASIC Basic 999 Rs 999/mo residents 60 hostels 1 CTA Upgrade to Basic.
PRO Pro 1999 Rs 1,999/mo residents null hostels 1 CTA Upgrade to Pro badge Popular.
ENTERPRISE Enterprise 4999 Rs 4,999/mo residents null hostels null CTA Contact Sales.

Taglines: Free Get started with hostel basics. Basic For small hostels
getting organized. Pro For growing hostels that need automation.
Enterprise For groups and multi-hostel operators.

Features in order:
Free: Basic dashboard, Basic hostel profile, Up to 10 residents,
Room management, Staff management, Reports and analytics.
Basic: Up to 60 residents, Room management, Basic payments,
Expenses tracking, Reports and analytics.
Pro: Unlimited residents, Staff management, Advanced analytics,
Reports and exports, Invoices and reminders.
Enterprise: Multiple hostels, Advanced administration,
Advanced reporting, Priority support, Custom integrations.
Flags PlanFeatureDetails: basicDashboard basicHostelProfile
maxResidents maxHostels roomManagement staffManagement
reportsAndAnalytics basicPayments expensesTracking advancedAnalytics
reportsAndExports invoicesAndReminders multipleHostels
advancedAdministration advancedReporting prioritySupport
customIntegrations.
Free only basic room staff reports true.
Basic adds basicPayments expensesTracking, staff false.
Pro adds staff advancedAnalytics reportsAndExports invoicesAndReminders.
Enterprise all true.
Enforced resident Free 10 Basic 60 Pro Enterprise unlimited.
Hostel Free Basic Pro 1 Enterprise unlimited.
checkHostelLimit has no HTTP route.

## 3 Auth hostel validation

Missing invalid token 401. Wrong role 403.
resolveHostelId runs before controller for current subscribe cancel
check-limit. Accepts UUIDv4 from params hostelId or id, query hostelId,
body hostelId, X-Hostel-Id. Missing invalid 400 valid hostelId required.
POST subscribe validates SubscribeDto, unknown fields 422 Validation error.

## 4.1 GET plans

GET /api/v1/hostel-ghar/subscriptions/plans
200 Subscription plans fetched successfully.
Data array with id name tagline price currency billingPeriod
formattedPrice badge features buttonText limits featureFlags isCurrent.
When isCurrent true buttonText Current Plan.

## 4.2 GET current

GET /api/v1/hostel-ghar/subscriptions/current?hostelId=uuid
Auth owner admin hostel required.
200 Current subscription fetched successfully.
data.subscription nullable, data.plan definition, data.limits
residentCount residentLimit residentLimitReached hostelCount hostelLimit
hostelLimitReached, data.daysRemaining ceil endDate-now or null.
residentCount active residents for hostel else 0.

## 4.3 POST subscribe

POST /api/v1/hostel-ghar/subscriptions/subscribe
Auth owner admin hostel required.
Body plan required FREE BASIC PRO ENTERPRISE.
hostelId UUID optional in DTO but required by middleware, falls back to
req hostelId. billingCycle optional MONTHLY YEARLY default MONTHLY.
paymentReference optional string. notes optional string.
Flow deactivate old ACTIVE to EXPIRED cancelledAt now. startDate now.
endDate null FREE else plus 30d monthly plus 1y yearly. price snapshot
0 999 1999 4999 NPR status ACTIVE autoRenew false. Bust subscription
and owner cache.
200 message Successfully subscribed to Pro plan with data.subscription
and data.plan.

## 4.4 POST cancel

POST /api/v1/hostel-ghar/subscriptions/cancel body hostelId uuid.
Auth owner admin hostel required. Deactivate ACTIVE to EXPIRED.
Next current FREE. Bust cache.
200 message Subscription cancelled successfully. No data.

## 4.5 GET history

GET /api/v1/hostel-ghar/subscriptions/history
Auth owner admin no hostel no pagination newest first with hostel.
200 Subscription history fetched successfully. Empty array if none.

## 4.6 GET check-limit

GET /api/v1/hostel-ghar/subscriptions/check-limit?hostelId=uuid&count=1
Auth owner admin hostel required count default 1.
Allowed 200 data allowed true currentPlan planName limit currentCount.
Blocked still 200 allowed false plus message.
FREE hint Upgrade to Basic or Pro. BASIC hint Upgrade to Pro.
Other hint Please upgrade. Pro Enterprise limit null allowed true.
Missing hostelId 400 hostelId is required.

## 5 DTO enums entity

SubscribeDto plan enum required hostelId UUID optional billingCycle
enum optional paymentReference string optional notes string optional.
Enums SubscriptionPlan FREE BASIC PRO ENTERPRISE.
SubscriptionStatus ACTIVE EXPIRED CANCELLED PENDING.
BillingCycle MONTHLY YEARLY.
Only ACTIVE with endDate null or future counts. Service writes ACTIVE
then EXPIRED. CANCELLED PENDING unused by service.
Table subscriptions id uuid PK ownerId FK users cascade hostelId FK
hostels set null nullable plan default FREE status default ACTIVE
billingCycle default MONTHLY price numeric 10 2 currency NPR startDate
now endDate nullable autoRenew false cancelledAt nullable
paymentReference 255 nullable notes text nullable createdAt updatedAt.
Indexes ownerId hostelId status plan ownerId+status.

## 6 Lifecycle caching

FREE no row to ACTIVE via subscribe. FREE no endDate paid plus 30d or 1y.
Upgrade or cancel to EXPIRED. Current falls back FREE history keeps row.
findActiveSubscription latest ACTIVE matching hostelId OR ownerId.
subscribe cancel bust subscription owner cache.
Flow plans to current to check-limit to subscribe.

## 7 Reports overview no live router

No reports mount in index.routes. Only auth admin owner resident
resident-imports bookings analytics hostels leaves fees rooms beds
payment-qrs payment-proofs expenses subscriptions.
No ReportController ReportService report routes. Only ReportRepository
and report-export util, both unwired never called outside util.
Use analytics owner dashboard fees expenses residents today.

## 8 Live reporting endpoints

Prefix api v1 hostel-ghar auth Bearer or cookie.

8.1 GET analytics admin summary. Roles admin plus apiReadLimiter.
Cache L1 30s L2 120s returns isCached cacheLevel. Fields users hostels
activeResidents pendingBookings pendingLeaves unpaidFees paidAmount SUM
paid outstanding SUM payable-paid.

8.2 GET analytics owner summary. Roles owner admin plus limiter.
Cache owner id v3. Legacy hostels activeResidents pendingBookings
pendingLeaves outstandingAmount generatedAt plus hostelOptions totals
rooms beds occupancyRate monthlyRevenue pendingAmount monthlyExpenses
null netRevenue null occupancy paymentStatus billed collected pending
collectionRate breakdown per FeeStatus roomOccupancy mrr planMix
finance allTime collected outstanding feeLifecycle paid pending
overdue partiallyPaid occupancyByHostel topHostelsByResidents
trends revenue residentGrowth 12 YYYY-MM unavailableMetrics expenses
maintenance residentDemographics residentCheckOuts.

8.3 GET owner dashboard. Roles owner admin. Cache owner dashboard id.
Returns data legacy rows plus summary totalResidents occupiedBeds
availableBeds occupancyRate totalRooms availableRooms monthlyRevenue
pendingPayments pendingCount totalHostels floorOverview roomMix
revenueTrend 6 recentPayments 5.
occupiedBeds max active residents SUM rooms occupied.

8.4 Fee expense resident sources.
GET fees hostels id ledger. PATCH fees id payment and status feed reports.
GET expenses page limit hostelId category status paginated max 100 with
pagination isCached cacheLevel owner own admin all.
GET hostels id residents and GET owner residents rosters hostel room bed.
Use analytics dashboard plus lists for Reports UI client CSV for now.

## 9 Internal blocks not HTTP

ReportRepository TypeORM only.
findScopedHostels userId role hostelId owners own admin all cross none.
findRoomsByHostels Room hostel roomNumber ASC.
findBedsByHostels Bed room bedNumber ASC.
findResidentsByHostels active user hostel roomNumber ASC.
findFeesByHostels Fee resident user hostel year month DESC.
findOutstandingFees status PENDING OVERDUE PARTIALLY_PAID dueDate ASC.
findApprovedProofs APPROVED resident user fee hostel createdAt ASC.
Flow scoped hostels ids parallel finds shape toCsv pdf.

report-export util zero dep.
escapeCsvCell RFC4180. toCsv headers rows BOM CRLF Excel.
safeFileSegment slug fallback report.
buildTabularPdf title subtitle headers rows weights landscape Buffer
PDF1.4 Helvetica auto landscape if headers over 5 weighted zebra footer
Page X of Y HostelGhar date empty No records. Send Buffer pdf with
Content-Disposition attachment. No auth cache inside.

## 10 Future reports contract NOT implemented

Do not call returns 404. Proposed mount routes.use reports router.
GET reports rooms hostelId format json csv pdf.
GET reports beds same.
GET reports residents same.
GET reports fees hostelId status outstanding all format.
GET reports payments hostelId format approved proofs.
Auth owner admin scoped findScopedHostels hostel via query body header.
json success data meta hostelId generatedAt count. csv text csv.
pdf application pdf. Columns rooms hostel roomNumber floor flat type
capacity occupied status. beds hostel room bedNumber status resident.
residents name email phone hostel room bed rent joinedAt.
fees resident hostel period YYYY-MM totalPayable paidAmount outstanding
status dueDate. payments resident fee period amount approvedAt reference.
Cache requester hostel report format L1 30s L2 120s bust on mutations.

## 11 Codes envelopes

200 subscription incl blocked analytics dashboard. 201 expense create.
400 hostelId. 401 token. 403 role cross owner. 404 unknown reports or
missing row. 422 DTO. 429 limiter.
Success success true message data. Cached adds isCached cacheLevel.
Error success false message. Validation adds errors field messages.
Messages PLANS_FETCHED CURRENT_FETCHED UPGRADED CANCELLED HISTORY_FETCHED
RESIDENT_LIMIT_REACHED.

## 12 cURL

BASE http localhost 3000 api v1 hostel-ghar TOKEN uuid HOSTEL uuid.
curl BASE subscriptions plans.
curl auth plans.
curl auth subscriptions current hostelId HOSTEL.
curl auth check-limit hostelId count 3.
curl POST auth subscribe plan PRO hostelId billingCycle MONTHLY.
curl auth history.
curl POST auth cancel hostelId.
curl auth analytics owner summary.
curl auth owner dashboard.
curl auth expenses hostelId page 1 limit 20.
Alt header X-Hostel-Id HOSTEL current.
