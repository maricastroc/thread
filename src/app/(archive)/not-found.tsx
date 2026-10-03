import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 sm:pt-20">
      <h1 className="t-title max-w-[18ch]">{t.errors.notFoundTitle}</h1>
      <p className="t-reading mt-6 max-w-[34rem] text-ink-2">{t.errors.notFoundBody}</p>
      <Link href="/" className="mt-10 inline-flex h-12 items-center rounded-full bg-ink px-6 text-paper">
        {t.errors.home}
      </Link>
    </section>
  );
}
