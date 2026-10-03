import "server-only";
import { cookies } from "next/headers";
import { THEME_KEY, parseTheme, type Theme } from "@/lib/theme";

export async function storedTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_KEY)?.value);
}
