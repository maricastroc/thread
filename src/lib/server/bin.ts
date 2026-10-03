import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const extraDirs = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
const resolved = new Map<string, string>();

export function resolveBin(name: string): string {
  if (path.isAbsolute(name)) return name;
  const cached = resolved.get(name);
  if (cached) return cached;
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), ...extraDirs];
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      resolved.set(name, candidate);
      return candidate;
    } catch {}
  }
  return name;
}

export class CommandError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

type RunOptions = {
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  signal?: AbortSignal;
};

function splitLines(onLine?: (line: string) => void) {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      let index: number;
      while ((index = buffer.search(/\r?\n|\r/)) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + (buffer[index] === "\r" && buffer[index + 1] === "\n" ? 2 : 1));
        if (line && onLine) onLine(line);
      }
    },
    flush() {
      if (buffer && onLine) onLine(buffer);
      buffer = "";
    },
  };
}

export function run(bin: string, args: string[], options: RunOptions = {}): Promise<void> {
  const executable = resolveBin(bin);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], signal: options.signal });
    const stderrTail: string[] = [];
    const out = splitLines(options.onStdoutLine);
    const err = splitLines((line) => {
      stderrTail.push(line);
      if (stderrTail.length > 40) stderrTail.shift();
      options.onStderrLine?.(line);
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => out.push(chunk));
    child.stderr.on("data", (chunk: string) => err.push(chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new CommandError(`${bin} is not installed or not on the PATH.`, `${executable}: ${error.message}`));
      } else {
        reject(new CommandError(`${bin} could not start.`, error.message));
      }
    });
    child.on("close", (code) => {
      out.flush();
      err.flush();
      if (code === 0) resolve();
      else reject(new CommandError(`${bin} exited with code ${code}.`, stderrTail.join("\n")));
    });
  });
}
