#!/usr/bin/env node
/**
 * DISABLED: Admin push retry listener
 *
 * This listener was intentionally disabled to keep the system strictly
 * event-driven. To re-enable:
 *  1. Create `scripts/admin-push-retry-listener.enabled.js` with the
 *     runtime implementation (LISTEN/pg_notify worker).
 *  2. Set environment variable `ADMIN_PUSH_LISTENER_ENABLED=true`.
 *  3. Start this script as a service/worker.
 *
 * The file is kept here as a placeholder so the feature can be restored
 * later without losing the intent or documentation.
 */

if (process.env.ADMIN_PUSH_LISTENER_ENABLED !== "true") {
  // Safe no-op: exit immediately when the listener is disabled.
  // Leave the script present in the repo as a future feature.
  // Logging is intentionally minimal.
  // eslint-disable-next-line no-console
  console.log("Admin push retry listener is disabled. To enable, set ADMIN_PUSH_LISTENER_ENABLED=true and provide an implementation at scripts/admin-push-retry-listener.enabled.js");
  process.exit(0);
}

// If enabled, attempt to load the real implementation from a separate file.
try {
  require("./admin-push-retry-listener.enabled.js");
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("Failed to load enabled admin push retry listener implementation:", err && err.stack ? err.stack : String(err));
  process.exit(1);
}
