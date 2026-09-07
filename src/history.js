import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function historyPath() {
  return process.env.NYSH_HISTORY || path.join(os.homedir(), ".nysh_history");
}

export function loadHistory(limit = 500) {
  try {
    const raw = fs.readFileSync(historyPath(), "utf8");
    return raw
      .split("\n")
      .map((l) => l.trimEnd())
      .filter(Boolean)
      .slice(-limit);
  } catch {
    return [];
  }
}

export function appendHistory(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    fs.appendFileSync(historyPath(), trimmed + "\n");
  } catch {
    /* historique optionnel : un shell sans $HOME reste utilisable */
  }
}
