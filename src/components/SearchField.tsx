import Form from "next/form";
import { SearchIcon } from "@/components/icons";
import { t } from "@/lib/i18n";

type Props = {
  narrator: string;
  defaultValue?: string;
  size?: "compact" | "hero";
  autoFocus?: boolean;
  id?: string;
};

export function SearchField({ narrator, defaultValue, size = "compact", autoFocus, id = "search" }: Props) {
  if (size === "hero") {
    return (
      <Form action="/search" role="search" className="group relative">
        <label htmlFor={id} className="visually-hidden">
          {t.search.label(narrator)}
        </label>
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t.search.placeholder(narrator)}
          className="peer w-full border-0 border-b border-rule-2 bg-transparent py-3 pr-14 font-serif text-[clamp(1.375rem,1.1rem+1.2vw,2rem)] leading-tight text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          aria-label={t.search.submit}
          className="absolute right-0 bottom-2 inline-flex size-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink"
        >
          <SearchIcon size={22} />
        </button>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-ink transition-transform duration-300 ease-[var(--ease-calm)] peer-focus:scale-x-100"
        />
      </Form>
    );
  }
  return (
    <Form action="/search" role="search" className="relative w-full max-w-[18rem]">
      <label htmlFor={id} className="visually-hidden">
        {t.search.label(narrator)}
      </label>
      <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t.search.placeholder(narrator)}
        className="h-10 w-full rounded-full border border-rule-2 bg-transparent pr-4 pl-9 text-[0.9375rem] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </Form>
  );
}
