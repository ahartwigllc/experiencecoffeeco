import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no incremental cache binding needed because every page that
// shows live data is rendered dynamically.
export default defineCloudflareConfig({});
