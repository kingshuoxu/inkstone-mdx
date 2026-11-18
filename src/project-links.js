// Fixed project destinations only. No document, path or diagnostic data is sent.
export const PROJECT_LINKS = Object.freeze({
  repository: "https://github.com/kingshuoxu/inkstone-mdx",
  issue: "https://github.com/kingshuoxu/inkstone-mdx/issues/new",
  releases: "https://github.com/kingshuoxu/inkstone-mdx/releases/latest",
});

export function projectURL(key) {
  if (typeof key !== "string" || !Object.hasOwn(PROJECT_LINKS, key))
    throw Error("Unknown project destination.");
  return PROJECT_LINKS[key];
}
