import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LifelinePrototype } from "@/components/life/LifelinePrototype";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/life";

export const metadata: Metadata = { title: "Prototype A · Lifeline" };

export default async function LifelinePage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  return <LifelinePrototype life={loadLife(vault)} />;
}
