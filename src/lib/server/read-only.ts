import "server-only";
import { t } from "@/lib/i18n";
import { config } from "./config";

export function readOnlyRefusal(): Response | null {
  return config.readOnly ? Response.json({ error: t.readOnly.refused }, { status: 403 }) : null;
}
