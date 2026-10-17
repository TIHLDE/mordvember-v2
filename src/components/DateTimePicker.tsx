"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

type Time = { hour: number; minute: number };
type Value = { day: Date; time: Time };

const pad = (n: number) => String(n).padStart(2, "0");

function parse(value: string | undefined): Value | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  return { day: new Date(y!, mo! - 1, d!), time: { hour: h!, minute: mi! } };
}

function serialize(value: Value | null): string {
  if (!value) return "";
  return `${format(value.day, "yyyy-MM-dd")}T${pad(value.time.hour)}:${pad(value.time.minute)}`;
}

function startOfDay(value: string | undefined): Date | undefined {
  return parse(value)?.day;
}

const popupClass =
  "z-50 rounded-xl border border-white/10 bg-zinc-950 text-sm text-zinc-200 shadow-xl shadow-black/60 outline-none";

const triggerClass =
  "flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white transition-[border-color,box-shadow] duration-150 hover:border-white/25 focus:border-blood focus:ring-2 focus:ring-blood/30 focus:outline-none disabled:opacity-50 data-[popup-open]:border-blood data-[popup-open]:ring-2 data-[popup-open]:ring-blood/30 sm:text-sm";

export function DateTimePicker({
  name,
  defaultValue,
  min,
  max,
  required,
  id,
  placeholder = "Velg dato",
  minuteStep = 5,
  className = "",
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  id?: string;
  placeholder?: string;
  minuteStep?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [value, setValue] = useState<Value | null>(() => parse(defaultValue));
  // Lets the user pick a time before a date without losing the input.
  const [pendingTime, setPendingTime] = useState<Time | null>(null);
  const time = value?.time ?? pendingTime;

  return (
    <div className={`relative flex items-start gap-2 ${className}`}>
      <DatePicker
        id={id}
        aria-label={ariaLabel}
        value={value?.day ?? null}
        onChange={(day) => setValue(day ? { day, time: time ?? { hour: 0, minute: 0 } } : null)}
        min={startOfDay(min)}
        max={startOfDay(max)}
        placeholder={placeholder}
      />
      <TimePicker
        value={time}
        minuteStep={minuteStep}
        onChange={(next) => {
          setPendingTime(next);
          if (value && next) setValue({ day: value.day, time: next });
        }}
      />
      {/* Not type="hidden", so the browser's required validation still applies. */}
      <input
        name={name}
        value={serialize(value)}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
      />
    </div>
  );
}

function DatePicker({
  id,
  "aria-label": ariaLabel,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  id?: string;
  "aria-label"?: string;
  value: Date | null;
  onChange: (day: Date | null) => void;
  min?: Date;
  max?: Date;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger id={id} type="button" aria-label={ariaLabel} className={`${triggerClass} min-w-36 flex-1 justify-between`}>
        <span className={`truncate ${value ? "" : "text-zinc-500"}`}>{value ? format(value, "d. MMM yyyy", { locale: nb }) : placeholder}</span>
        <CalendarIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="isolate z-50">
          <Popover.Popup aria-label="Velg dato" className={`${popupClass} p-3`}>
            <Calendar
              selected={value ?? undefined}
              onSelect={(day) => {
                onChange(day ?? null);
                if (day) setOpen(false);
              }}
              min={min}
              max={max}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Calendar({
  selected,
  onSelect,
  min,
  max,
}: {
  selected?: Date;
  onSelect: (day: Date | undefined) => void;
  min?: Date;
  max?: Date;
}) {
  const d = getDefaultClassNames();
  const disabled = [...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])];
  return (
    <DayPicker
      mode="single"
      locale={nb}
      showOutsideDays
      autoFocus
      selected={selected}
      onSelect={onSelect}
      defaultMonth={selected ?? max}
      startMonth={min}
      endMonth={max}
      disabled={disabled}
      classNames={{
        root: `${d.root} w-fit`,
        months: `${d.months} relative flex flex-col`,
        month: `${d.month} flex flex-col gap-3`,
        nav: `${d.nav} absolute inset-x-0 top-0 flex items-center justify-between`,
        button_previous: `${d.button_previous} grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-30`,
        button_next: `${d.button_next} grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-30`,
        month_caption: `${d.month_caption} flex h-8 items-center justify-center`,
        caption_label: `${d.caption_label} text-sm font-medium capitalize text-white select-none`,
        month_grid: "border-collapse",
        weekdays: `${d.weekdays} flex`,
        weekday: `${d.weekday} w-9 text-[0.75rem] font-normal capitalize text-zinc-500 select-none`,
        week: `${d.week} mt-1 flex`,
        day: `${d.day} size-9 p-0 text-center`,
        day_button: `${d.day_button} size-9 rounded-lg tabular-nums transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood/60`,
        selected: `${d.selected} [&>button]:bg-blood [&>button]:text-white [&>button]:hover:bg-blood-light`,
        today: `${d.today} [&>button]:font-semibold [&>button]:text-blood-light [&[aria-selected]>button]:text-white`,
        outside: `${d.outside} text-zinc-600`,
        disabled: `${d.disabled} text-zinc-700 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent [&>button]:hover:text-zinc-700`,
        hidden: `${d.hidden} invisible`,
      }}
      components={{
        Chevron: ({ orientation }) => <ChevronIcon left={orientation === "left"} />,
      }}
    />
  );
}

function clamp(text: string, max: number): number | null {
  if (text === "") return null;
  const n = parseInt(text, 10);
  return Number.isNaN(n) || n < 0 || n > max ? null : n;
}

function sameTime(a: Time | null, b: Time | null): boolean {
  if (a === null || b === null) return a === b;
  return a.hour === b.hour && a.minute === b.minute;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimePicker({
  value,
  onChange,
  minuteStep,
}: {
  value: Time | null;
  onChange: (value: Time | null) => void;
  minuteStep: number;
}) {
  const [open, setOpen] = useState(false);
  const [pendingHour, setPendingHour] = useState<number | null>(null);
  const [pendingMinute, setPendingMinute] = useState<number | null>(null);
  const [hourText, setHourText] = useState(() => (value ? pad(value.hour) : ""));
  const [minuteText, setMinuteText] = useState(() => (value ? pad(value.minute) : ""));
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  const [syncedValue, setSyncedValue] = useState(value);
  if (!sameTime(syncedValue, value)) {
    setSyncedValue(value);
    setHourText(value ? pad(value.hour) : "");
    setMinuteText(value ? pad(value.minute) : "");
    if (open) {
      setPendingHour(value?.hour ?? null);
      setPendingMinute(value?.minute ?? null);
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPendingHour(value?.hour ?? null);
      setPendingMinute(value?.minute ?? null);
    }
    setOpen(next);
  };

  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, Math.floor(minuteStep)));
    return Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  }, [minuteStep]);

  const emit = (next: Time | null) => {
    if (!sameTime(next, value)) onChange(next);
  };
  const hourInput = () => hourRef.current?.value ?? "";
  const minuteInput = () => minuteRef.current?.value ?? "";

  const commitHour = (h: number) => {
    const m = clamp(minuteInput(), 59);
    if (m !== null) emit({ hour: h, minute: m });
    else if (value) emit({ hour: h, minute: value.minute });
  };
  const commitMinute = (m: number) => {
    const h = clamp(hourInput(), 23);
    if (h !== null) emit({ hour: h, minute: m });
    else if (value) emit({ hour: value.hour, minute: m });
  };

  const onBlur = (text: string, max: number, reset: () => void, setText: (t: string) => void, commit: (n: number) => void) => {
    if (text === "") {
      if (value !== null) emit(null);
      return;
    }
    const n = clamp(text, max);
    if (n === null) return reset();
    setText(pad(n));
    commit(n);
  };

  const focusHourEnd = () => {
    const len = hourInput().length;
    hourRef.current?.focus();
    requestAnimationFrame(() => hourRef.current?.setSelectionRange(len, len));
  };

  const pickHour = (hour: number) => {
    setPendingHour(hour);
    setHourText(pad(hour));
    if (value) emit({ hour, minute: value.minute });
    else if (pendingMinute !== null) emit({ hour, minute: pendingMinute });
  };
  const pickMinute = (minute: number) => {
    setPendingMinute(minute);
    setMinuteText(pad(minute));
    if (value) emit({ hour: value.hour, minute });
    else if (pendingHour !== null) emit({ hour: pendingHour, minute });
  };

  const segmentClass = "w-[2ch] bg-transparent text-base tabular-nums sm:text-sm text-white outline-none placeholder:text-zinc-500";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <Popover.Trigger
        nativeButton={false}
        render={<div aria-label="Tidsvelger" />}
        className={`${triggerClass} w-28 shrink-0 cursor-text has-[input:focus]:border-blood has-[input:focus]:ring-2 has-[input:focus]:ring-blood/30`}
      >
        <input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="tt"
          aria-label="Timer"
          maxLength={2}
          value={hourText}
          onClick={stop}
          onFocus={(e) => {
            e.target.select();
            if (!open) handleOpenChange(true);
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            setHourText(raw);
            const h = clamp(raw, 23);
            setPendingHour(h);
            if (raw.length === 2 && h !== null) {
              minuteRef.current?.focus();
              minuteRef.current?.select();
              commitHour(h);
            }
          }}
          onKeyDown={(e) => {
            const input = e.currentTarget;
            if (e.key === "ArrowRight" && input.selectionEnd === input.value.length) {
              e.preventDefault();
              minuteRef.current?.focus();
              requestAnimationFrame(() => minuteRef.current?.setSelectionRange(0, 0));
            }
          }}
          onBlur={() => onBlur(hourInput(), 23, () => setHourText(value ? pad(value.hour) : ""), setHourText, commitHour)}
          className={segmentClass}
        />
        <span aria-hidden onClick={stop} className="text-zinc-500 select-none">:</span>
        <input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="mm"
          aria-label="Minutter"
          maxLength={2}
          value={minuteText}
          onClick={stop}
          onFocus={(e) => {
            e.target.select();
            if (!open) handleOpenChange(true);
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            setMinuteText(raw);
            const m = clamp(raw, 59);
            setPendingMinute(m);
            if (raw.length === 2 && m !== null) commitMinute(m);
          }}
          onKeyDown={(e) => {
            const input = e.currentTarget;
            if ((e.key === "Backspace" && input.value === "") || (e.key === "ArrowLeft" && input.selectionStart === 0)) {
              e.preventDefault();
              focusHourEnd();
            }
          }}
          onBlur={() => onBlur(minuteInput(), 59, () => setMinuteText(value ? pad(value.minute) : ""), setMinuteText, commitMinute)}
          className={segmentClass}
        />
        <span className="ml-auto text-zinc-400">
          <ClockIcon />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="isolate z-50">
          <Popover.Popup aria-label="Velg tid" initialFocus={false} className={`${popupClass} p-1`}>
            <div className="flex items-stretch" role="group" aria-label="Tidsvelger">
              <TimeColumn label="Timer" items={HOURS} value={pendingHour} onSelect={pickHour} />
              <div aria-hidden className="flex items-center px-1 text-zinc-500 select-none">:</div>
              <TimeColumn label="Minutter" items={minutes} value={pendingMinute} onSelect={pickMinute} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TimeColumn({
  label,
  items,
  value,
  onSelect,
}: {
  label: string;
  items: number[];
  value: number | null;
  onSelect: (n: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const button = selectedRef.current;
    if (!container || !button) return;
    container.scrollTop = button.offsetTop - container.clientHeight / 2 + button.clientHeight / 2;
  }, []);

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={label}
      className="flex max-h-56 w-10 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(n)}
            className={`h-7 shrink-0 rounded-md text-sm tabular-nums transition ${
              selected ? "bg-blood text-white hover:bg-blood-light" : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {pad(n)}
          </button>
        );
      })}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-zinc-400" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ChevronIcon({ left }: { left: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
      <path d={left ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
