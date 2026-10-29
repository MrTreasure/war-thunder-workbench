import { bootAppearance } from "./boot-appearance.mjs";
import defaults from "../data/workbench-appearance.json";
import settings from "./config/player-stats.json";
import { registerImageCache } from "./image-cache";

// QMuse mounts App.tsx in its own document; it does not run our index.html.
// The early HTML bootstrap and this shared entry use the same idempotent setup.
bootAppearance(defaults, settings.apiBaseUrl);
registerImageCache();
