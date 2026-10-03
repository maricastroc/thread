import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThreadsPrototype } from "@/components/life/ThreadsPrototype";
import { loadVault } from "@/lib/server/data";
import { loadLife } from "@/lib/server/life";

export const metadata: Metadata = { title: "Prototype C · Threads" };

export default async function ThreadsPage() {
  const vault = await loadVault();
  if (!vault) redirect("/");
  return <ThreadsPrototype life={loadLife(vault)} />;
}
