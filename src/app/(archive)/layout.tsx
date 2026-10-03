import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { loadVault } from "@/lib/server/data";

export default async function ArchiveLayout({ children }: LayoutProps<"/">) {
  const vault = await loadVault();
  return (
    <>
      <SiteHeader narrator={vault?.narrator ?? null} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
