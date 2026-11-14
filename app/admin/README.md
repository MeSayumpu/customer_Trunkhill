# Admin UI

All admin views share the Tailwind CSS v4 component styles in `admin.css` and `admin-theme.css`, loaded by `layout.jsx`. Font Awesome Free icons are selected by name through `AdminIcon`.

- Use the existing panel, button, form, table and dialog components/styles before adding another variant.
- Tailwind utilities use the `ad:` prefix, including within `@apply` (for example `ad:flex ad:gap-3`). The prefix prevents collisions when navigating back to customer pages.
- Preflight is intentionally omitted. All component selectors are scoped beneath `.admin-ui`; do not add global element resets.
- Keep functional map/graph SVG geometry. UI icons belong in `admin-icon.jsx`; import individual icons instead of loading the entire icon library or a remote kit.
- Complex calendar, chart and map geometry uses scoped CSS alongside Tailwind. Shared customer map styles remain in `app/globals.css`.
- Add new CSS to these files instead of reintroducing admin styles in the customer stylesheet. Theme changes should apply across all sections, not only bookings.

Verification: `npm run build`, then with the local server running, `node --env-file=.env.local scripts/test-admin-ui.mjs`. The booking/settings integration tests exercise the existing actions separately.

## Map studio

- Run `node --env-file=.env.local scripts/init-plot-map-versions.mjs` once for an existing database. Fresh `db:init` also installs the version tables. This does not change the current customer map.
- Select a lodging item, draw a polygon, drag its vertices or drag the whole polygon. Empty canvas drags pan the image; zoom and undo/redo remain outside the scrollable canvas.
- Removing an element only hides it on the map; it does not delete inventory or bookings.
- **Draft** saves the complete image and element snapshot privately. **Publish** saves the current snapshot and atomically updates the customer-visible version after confirmation. Mobile/desktop preview uses the same `PlotMap` renderer with sample availability.
- Saves use the last draft revision to reject conflicting edits. Published image revisions remain available for customers who still have an older map open.
- `scripts/test-map-studio.mjs` runs against a local database/server, temporarily saves and publishes test revisions, then restores the original pointers. Set `TEST_BASE_URL`, `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` as needed.
