import { getVault, saveVault } from "@/lib/server/archive";

export async function GET() {
  return Response.json(getVault());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { subject?: unknown; narrator?: unknown; birthYear?: unknown; language?: unknown } | null;
  const given = typeof body?.subject === "string" ? body.subject : typeof body?.narrator === "string" ? body.narrator : "";
  const subject = given.trim().slice(0, 80);
  if (!subject) return Response.json({ error: "A name is required." }, { status: 400 });
  const year = Number(body?.birthYear);
  const birthYear = Number.isInteger(year) && year > 1850 && year <= new Date().getFullYear() ? year : null;
  const language = typeof body?.language === "string" && /^(auto|[a-z]{2})$/.test(body.language) ? body.language : "auto";
  saveVault({ subject, birthYear, language });
  return Response.json(getVault());
}
