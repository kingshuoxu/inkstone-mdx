export const DRAFT_KEY = "inkstone.draft.v1";
export function readDraft(storage) {
  try {
    const d = JSON.parse(storage.getItem(DRAFT_KEY));
    return d && typeof d.source === "string" && typeof d.name === "string"
      ? d
      : null;
  } catch {
    return null;
  }
}
export function writeDraft(storage, source, name) {
  storage.setItem(
    DRAFT_KEY,
    JSON.stringify({ source, name, updated: Date.now() }),
  );
}
export async function fileText(file) {
  return file.arrayBuffer
    ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        await file.arrayBuffer(),
      )
    : file.text();
}
export async function saveHandle(handle, source, baseline) {
  const current = await handle.getFile();
  if ((await fileText(current)) !== baseline)
    throw new Error(
      "File changed on disk. Use Save a copy to preserve both versions.",
    );
  const writable = await handle.createWritable();
  try {
    await writable.write(source);
    await writable.close();
  } catch (e) {
    try {
      await writable.abort();
    } catch {}
    throw e;
  }
}
