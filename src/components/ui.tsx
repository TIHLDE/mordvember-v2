import { Link } from "@tanstack/react-router";
import { buttonClass, cx, type ButtonStyle } from "./styles";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6", className)}
    >
      {title && <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function PageTitle({
  children,
  sub,
  center = false,
  aside,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  center?: boolean;
  aside?: React.ReactNode;
}) {
  const title = (
    <>
      <h1 className="font-display text-4xl leading-none text-blood text-balance sm:text-5xl">
        {children}
      </h1>
      {sub && (
        <p className={cx("mt-3 max-w-prose text-pretty text-zinc-400", center && "mx-auto")}>
          {sub}
        </p>
      )}
    </>
  );
  if (aside) {
    return (
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">{title}</div>
        <div className="shrink-0 text-right">{aside}</div>
      </header>
    );
  }
  return <header className={cx("mb-8", center && "text-center")}>{title}</header>;
}

export function Button({
  children,
  variant,
  size,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle) {
  return (
    <button {...props} className={cx(buttonClass({ variant, size }), className)}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant,
  size,
}: { href: string; children: React.ReactNode } & ButtonStyle) {
  return (
    <Link to={href} className={buttonClass({ variant, size })}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Checkbox({
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
      <input type="checkbox" {...props} className="mt-0.5 size-4 shrink-0 cursor-pointer" />
      <span>{children}</span>
    </label>
  );
}

const tones = {
  zinc: "bg-zinc-800 text-zinc-300",
  red: "bg-red-950 text-red-300",
  green: "bg-emerald-950 text-emerald-300",
  amber: "bg-amber-950 text-amber-300",
};

export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-white/5 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

const noticeTones = {
  red: "border-red-900/60 bg-red-950/60 text-red-200",
  amber: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  green: "border-emerald-900/60 bg-emerald-950/60 text-emerald-200",
};

export function Notice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: keyof typeof noticeTones;
}) {
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm text-pretty", noticeTones[tone])}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
