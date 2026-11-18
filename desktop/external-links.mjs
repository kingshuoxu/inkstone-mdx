import { projectURL } from "../src/project-links.js";

// Called by native menus only, never exposed through the preview/app bridge.
export async function openProjectLink(key, openExternal) {
  return openExternal(projectURL(key));
}
