import "server-only";
import { connection } from "next/server";
import { ensureWorker } from "./pipeline";
import { getVault } from "./archive";

export async function loadVault() {
  await connection();
  ensureWorker();
  return getVault();
}
