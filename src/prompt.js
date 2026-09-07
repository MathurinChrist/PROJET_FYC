import os from "node:os";
import path from "node:path";
import { ansi } from "./ansi.js";

export function buildPrompt(ctx) {
  const user = ctx.env.USER || os.userInfo().username;
  const host = os.hostname().split(".")[0];
  const home = ctx.env.HOME || os.homedir();
  let dir = ctx.cwd;
  if (dir === home) dir = "~";
  else if (dir.startsWith(home + path.sep)) {
    dir = "~" + dir.slice(home.length);
  }

  const who = ansi.green(`${user}@${host}`);
  const where = ansi.blue(dir);
  const mark = ctx.lastStatus === 0 ? ansi.green("$") : ansi.red("$");
  return `${who}:${where}${mark} `;
}
