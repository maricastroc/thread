import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = new URL("../src/", import.meta.url);

function file(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
  let target = null;
  if (specifier.startsWith("@/")) target = new URL(specifier.slice(2), src);
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) target = new URL(specifier, context.parentURL);
  if (target) {
    const path = fileURLToPath(target);
    for (const candidate of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`]) {
      if (file(candidate)) return nextResolve(new URL(`file://${candidate}`).href, context);
    }
  }
  return nextResolve(specifier, context);
}
