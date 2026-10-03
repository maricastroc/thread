import "server-only";
import { randomBytes } from "node:crypto";

const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(length = 10): string {
  const bytes = randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}
