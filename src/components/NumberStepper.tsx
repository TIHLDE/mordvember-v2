"use client";

import { useState } from "react";

const format = (n: number) => String(n).replace(".", ",");

export function NumberStepper({
  name,
  defaultValue,
  min = 0,
  max,
  step = 1,
  className = "",
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [text, setText] = useState(() => format(defaultValue));
  const decimals = step % 1 === 0 ? 0 : 1;

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  const commit = (n: number) => {
    const next = Number(clamp(n).toFixed(decimals));
    setValue(next);
    setText(format(next));
  };

  return (
    <div
      className={`flex min-h-10 w-full items-stretch overflow-clip rounded-lg border border-white/15 bg-black/40 transition-[border-color,box-shadow] duration-150 hover:border-white/25 focus-within:border-blood focus-within:ring-2 focus-within:ring-blood/30 ${className}`}
    >
      <input type="hidden" name={name} value={value} />
      <input
        aria-label={ariaLabel}
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(decimals ? /[^\d,.]/g : /\D/g, "");
          setText(raw);
          const parsed = Number(raw.replace(",", "."));
          if (raw !== "" && Number.isFinite(parsed)) setValue(Number(clamp(parsed).toFixed(decimals)));
        }}
        onBlur={() => commit(value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            commit(value + (e.key === "ArrowUp" ? step : -step));
          }
        }}
        className="order-2 w-0 min-w-8 flex-1 bg-transparent text-center text-base font-medium text-white tabular-nums outline-none sm:text-sm"
      />
      <StepButton label="Mindre" disabled={value <= min} onClick={() => commit(value - step)} className="order-1 border-r">
        <path d="M5 12h14" />
      </StepButton>
      <StepButton label="Mer" disabled={max !== undefined && value >= max} onClick={() => commit(value + step)} className="order-3 border-l">
        <path d="M5 12h14M12 5v14" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center border-white/10 px-2.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="size-3.5" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
