import { getVault, saveVault } from "@/lib/server/archive";

export async function GET() {
  return Response.json(getVault());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { narrator?: unknown; birthYear?: unknown; language?: unknown } | null;
  const narrator = typeof body?.narrator === "string" ? body.narrator.trim().slice(0, 80) : "";
  if (!narrator) return Response.json({ error: "A name is required." }, { status: 400 });
  const year = Number(body?.birthYear);
  const birthYear = Number.isInteger(year) && year > 1850 && year <= new Date().getFullYear() ? year : null;
  const language = typeof body?.language === "string" && /^(auto|[a-z]{2})$/.test(body.language) ? body.language : "auto";
  saveVault({ narrator, birthYear, language });
  return Response.json(getVault());
}
