import type { NextRequest } from "next/server";
import { getVault } from "@/lib/server/repo";
import { search } from "@/lib/server/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const vault = getVault();
  if (!vault) return Response.json({ error: "The archive isn’t set up yet." }, { status: 409 });
  const outcome = await search(q, vault.birthYear);
  return Response.json(outcome, { headers: { "cache-control": "no-store" } });
}
