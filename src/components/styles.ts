// Class names shared by components. Kept apart from ui.tsx so that file only exports components.

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
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

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}) {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-center font-medium select-none",
    "transition-[background-color,border-color,transform] duration-150 ease-out-strong active:scale-[0.97] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
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
