import Link from "next/link";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6", className)}>
      {title && <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub, center = false }: { children: React.ReactNode; sub?: React.ReactNode; center?: boolean }) {
  return (
    <header className={cx("mb-8", center && "text-center")}>
      <h1 className="font-display text-4xl leading-none text-blood text-balance sm:text-5xl">{children}</h1>
      {sub && <p className={cx("mt-3 max-w-prose text-pretty text-zinc-400", center && "mx-auto")}>{sub}</p>}
    </header>
  );
}

const variants = {
  primary: "bg-blood text-white hover:bg-blood-light",
  ghost: "border border-white/15 bg-white/[0.02] text-zinc-100 hover:border-white/25 hover:bg-white/[0.07]",
  danger: "bg-red-900 text-white hover:bg-red-800",
  "danger-ghost": "border border-red-900/70 text-red-300 hover:border-red-800 hover:bg-red-950/60",
};

const sizes = {
  md: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-8 px-3 py-1 text-xs",
};

type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}) {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-center font-medium select-none",
    "transition-[background-color,border-color,transform] duration-150 ease-out-strong active:scale-[0.97] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
  );
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

export function LinkButton({ href, children, variant, size }: { href: string; children: React.ReactNode } & ButtonStyle) {
  return (
    <Link href={href} className={buttonClass({ variant, size })}>
      {children}
    </Link>
  );
}

// 16px on small screens, because iOS Safari zooms the page when a smaller input gets focus.
export const inputBase = cx(
  "block min-h-10 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white sm:text-sm",
  "placeholder:text-zinc-500 transition-[border-color,box-shadow] duration-150 hover:border-white/25",
  "focus:border-blood focus:ring-2 focus:ring-blood/30 focus:outline-none",
  "file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-zinc-100",
);

export const inputClass = cx(inputBase, "w-full");

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Checkbox({ children, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
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

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-white/5 ring-inset", tones[tone])}>{children}</span>;
}

const noticeTones = {
  red: "border-red-900/60 bg-red-950/60 text-red-200",
  amber: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  green: "border-emerald-900/60 bg-emerald-950/60 text-emerald-200",
};

export function Notice({ children, tone }: { children: React.ReactNode; tone: keyof typeof noticeTones }) {
  return <div className={cx("rounded-xl border px-4 py-3 text-sm text-pretty", noticeTones[tone])}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
