import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FieldPrototype } from "@/components/life/FieldPrototype";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/life";

export const metadata: Metadata = { title: "Prototype B · Field of years" };

export default async function FieldPage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  return <FieldPrototype life={loadLife(vault)} />;
}
