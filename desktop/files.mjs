import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export function isInside(root, file) {
  const rel = path.relative(root, file);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
}
export async function checkedPath(root, file) {
  const real = await fs.realpath(file);
  if (!isInside(root, real))
    throw Error("Import escapes the trusted workspace (including symlinks).");
  return real;
}
export async function readDocument(file) {
  const real = await fs.realpath(file);
  const stat = await fs.stat(real);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024)
    throw Error("Choose a text file smaller than 5 MiB.");
  return {
    path: real,
    name: path.basename(real),
    source: await fs.readFile(real, "utf8"),
  };
}
export async function atomicSave(file, source, baseline) {
  let current = null,
    mode = 0o600;
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink())
      throw Error("Save target became a symbolic link. Choose Save a copy.");
    mode = stat.mode;
    current = await fs.readFile(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (current !== baseline)
    throw Error(
      "File changed on disk. Use Save a copy to preserve both versions.",
    );
  const tmp = path.join(path.dirname(file), `.inkstone-${randomUUID()}.tmp`);
  let stream;
  try {
    stream = await fs.open(tmp, "wx", mode);
    await stream.writeFile(source, "utf8");
    await stream.sync();
    await stream.close();
    stream = null;
    // Recheck after writing the temporary file; this is still not an OS-wide lock.
    let latest = null;
    try {
      latest = await fs.readFile(file, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (latest !== baseline)
      throw Error("File changed during save. Use Save a copy.");
    await fs.rename(tmp, file);
  } finally {
    await stream?.close();
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}
