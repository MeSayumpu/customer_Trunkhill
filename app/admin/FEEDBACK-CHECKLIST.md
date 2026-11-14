# Admin and customer feedback

For an existing local database, run `node --env-file=.env.local scripts/init-admin-feedback.mjs`. Fresh `db:init` also creates `camp_options`. Existing bookings are not migrated or deleted.

The booking window defaults to three calendar months, clamping month-end dates. Administrators can choose days or months. Check-in and occupied nights must be within the window; checkout may be the following day. Availability, reservation and rescheduling enforce the same limit on the server.

Booking list defaults to today through three calendar months ahead. Pending/review tabs show all dates. Explicit date filters on other tabs override the default.

| Feedback | Implementation |
| --- | --- |
| 1 | Compact checkboxes |
| 2, 17 | Price explanation collapsed by default |
| 3 | Right-aligned pale red trash button |
| 4 | Persisted booking window and calendar/server enforcement |
| 5 | Default booking date range; unrestricted pending tab |
| 6, 7 | Booking ID background and right-aligned status actions |
| 8 | Single reschedule-history heading/container |
| 9 | Image/PDF slip dialog |
| 10 | Approval and cancellation confirmation dialogs |
| 11, 12 | Padded item table with quantity units |
| 13 | Separate checkout discount panel |
| 14 | Real OOXML `.xlsx` export, typed numbers/text |
| 15 | Checkout plot/room code filter, shared with export |
| 16, 22 | Local image preview before inventory upload |
| 18 | Seven editable facility categories displayed to customers |
| 19 | Add zone in plot administration; dynamic zone selectors/media |
| 20 | Styled photo/video upload and local previews |
| 21, 23 | Equipment/tent category selector and prominent tabs |
| 24 | Free guest badges with sparkle |
| 25 | Selected plot cards |
| 26–29 | Tall rental dialog, scrollable list, +/- stay controls, wider quantities |
| 30 | Equal-width facility categories |

## Validation

`scripts/test-feedback.mjs` uses Playwright and temporary database fixtures to check desktop (1440×1000) and mobile (390×844) viewports. It tests real settings round trips, pending-date behavior, dynamic zones, category changes, image/video previews, dialogs, Excel output and customer rental controls. It restores the original settings and removes its own fixtures in `finally`. Screenshots are written under `tmp/feedback/`.

Set `TEST_BASE_URL`, `PLAYWRIGHT_MODULE`, and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for the local test environment. `scripts/test-booking-confirmation.mjs` additionally checks real approve/cancel transitions and dismiss behavior on a disposable booking.

An isolated build can use `NEXT_OUTPUT_DIR=.next-feedback`; serve it on a separate local port to avoid interrupting the main workspace server.
