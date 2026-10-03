"use client";

import { useActionState } from "react";
import { setupVault, type SetupState } from "@/app/actions";
import { t } from "@/lib/i18n";

const languages = [
  ["auto", t.setup.languageAuto],
  ["pt", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["it", "Italiano"],
  ["de", "Deutsch"],
] as const;

const initial: SetupState = { errors: {}, values: { name: "", year: "", language: "auto" } };

export function Setup() {
  const [state, action, pending] = useActionState(setupVault, initial);
  const field =
    "w-full border-0 border-b border-rule-2 bg-transparent py-2.5 font-serif text-[1.75rem] leading-tight text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-ink focus:outline-none aria-[invalid=true]:border-voice";

  return (
    <section className="mx-auto max-w-[36rem] px-4 pt-10 pb-24 sm:px-6 sm:pt-20">
      <p className="t-meta max-w-[24rem]">{t.setup.tagline}</p>
      <form action={action} className="mt-14" noValidate>
        <h1 className="t-title">{t.setup.heading}</h1>

        <div className="mt-12">
          <label htmlFor="name" className="block text-[1rem] text-ink-2">
            {t.setup.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="off"
            autoCapitalize="words"
            defaultValue={state.values.name}
            placeholder={t.setup.namePlaceholder}
            aria-invalid={state.errors.name ? true : undefined}
            aria-describedby={state.errors.name ? "name-error" : undefined}
            className={field}
          />
          {state.errors.name && (
            <p id="name-error" className="t-small mt-2 text-voice">
              {state.errors.name}
            </p>
          )}
        </div>

        <div className="mt-10">
          <label htmlFor="year" className="block text-[1rem] text-ink-2">
            {t.setup.birthYearLabel} <span className="text-ink-3">· {t.setup.optional}</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-8">
            <input
              id="year"
              name="year"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              defaultValue={state.values.year}
              aria-invalid={state.errors.year ? true : undefined}
              aria-describedby={state.errors.year ? "year-error year-hint" : "year-hint"}
              className={`${field} t-time max-w-[8rem] !font-mono !text-[1.5rem]`}
            />
            <p id="year-hint" className="t-small pb-2 text-ink-2">
              {t.setup.birthYearHint}
            </p>
          </div>
        </div>
        {state.errors.year && (
          <p id="year-error" className="t-small mt-2 text-voice">
            {state.errors.year}
          </p>
        )}

        <div className="mt-10">
          <label htmlFor="language" className="block text-[1rem] text-ink-2">
            {t.setup.languageLabel}
          </label>
          <select
            id="language"
            name="language"
            defaultValue={state.values.language}
            className="mt-1 h-12 w-full cursor-pointer appearance-none border-0 border-b border-rule-2 bg-transparent bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-8 text-[1.125rem] text-ink transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='m1 1.5 5 5 5-5' stroke='%2355524b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
            }}
          >
            {languages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-14 inline-flex h-14 items-center rounded-full bg-ink px-8 text-[1.0625rem] font-medium text-paper transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[0.98] disabled:opacity-60"
        >
          {t.setup.submit}
        </button>
      </form>

      <p className="t-small mt-16 flex max-w-[28rem] gap-2.5 text-ink-2">
        <span aria-hidden="true" className="mt-[0.45em] inline-block size-1.5 shrink-0 rounded-full bg-ink-3" />
        {t.setup.privacy}
      </p>
    </section>
  );
}
