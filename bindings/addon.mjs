import { existsSync } from "node:fs";
import { buildAddon, loadAddon, packagedAddon } from "./native.mjs";

export const addonPath = existsSync(packagedAddon) ? packagedAddon : buildAddon();
export const addon = loadAddon(addonPath);
