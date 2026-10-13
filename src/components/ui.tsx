import Link from "next/link";

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-4xl text-blood sm:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-zinc-400">{sub}</p>}
    </header>
  );
}

const variants = {
  primary: "bg-blood text-white hover:bg-blood-light",
  ghost: "border border-white/15 text-zinc-200 hover:bg-white/5",
  danger: "bg-red-900 text-white hover:bg-red-800",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: keyof typeof variants }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${variants[variant]}`}>
      {children}
    </Link>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blood focus:outline-none";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "red" | "green" | "amber" }) {
  const tones = {
    zinc: "bg-zinc-800 text-zinc-300",
    red: "bg-red-950 text-red-300",
    green: "bg-emerald-950 text-emerald-300",
    amber: "bg-amber-950 text-amber-300",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
