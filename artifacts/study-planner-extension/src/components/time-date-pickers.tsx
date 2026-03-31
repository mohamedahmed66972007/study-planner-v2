import { useState, useRef, useCallback } from "react";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Number Picker ──────────────────────────────────────────────────────────────

export function NumberPicker({
  value,
  onChange,
  min = 0,
  max = 59,
  label,
  pad = true,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  pad?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const increase = useCallback(() => {
    onChange(value >= max ? min : value + 1);
  }, [value, max, min, onChange]);

  const decrease = useCallback(() => {
    onChange(value <= min ? max : value - 1);
  }, [value, min, max, onChange]);

  const startRepeat = (fn: () => void) => {
    timeoutRef.current = setTimeout(() => {
      repeatRef.current = setInterval(fn, 80);
    }, 400);
  };

  const stopRepeat = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (repeatRef.current) clearInterval(repeatRef.current);
  };

  const handleDisplayClick = () => {
    setInputVal(pad ? String(value).padStart(2, "0") : String(value));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  const commitInput = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      commitInput();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      increase();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrease();
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <button
        type="button"
        onClick={increase}
        onPointerDown={() => startRepeat(increase)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        className="w-10 h-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-white/5 active:scale-90"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      <div
        className="relative w-16 h-12 flex items-center justify-center bg-black/40 rounded-xl border border-white/10 overflow-hidden cursor-text"
        onClick={handleDisplayClick}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitInput}
            onKeyDown={handleKeyDown}
            className="w-full h-full text-center text-2xl font-bold font-mono text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.span
              key={value}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="text-2xl font-bold font-mono text-white absolute"
            >
              {pad ? String(value).padStart(2, "0") : value}
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      <button
        type="button"
        onClick={decrease}
        onPointerDown={() => startRepeat(decrease)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        className="w-10 h-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-white/5 active:scale-90"
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</span>
    </div>
  );
}

// ── AM/PM Toggle ───────────────────────────────────────────────────────────────

export function AmPmToggle({
  value,
  onChange,
}: {
  value: "am" | "pm";
  onChange: (v: "am" | "pm") => void;
}) {
  return (
    <div className="flex flex-col gap-1 pb-6">
      {(["am", "pm"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-2 py-1 rounded-lg text-xs font-bold transition-all",
            value === v
              ? "bg-primary text-white"
              : "bg-white/5 text-muted-foreground hover:bg-white/10"
          )}
        >
          {v === "am" ? "ص" : "م"}
        </button>
      ))}
    </div>
  );
}

// ── 24h ↔ 12h helpers ─────────────────────────────────────────────────────────

export function to24h(hour12: number, ampm: "am" | "pm"): number {
  if (ampm === "am") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function to12h(hour24: number): { hour12: number; ampm: "am" | "pm" } {
  if (hour24 === 0) return { hour12: 12, ampm: "am" };
  if (hour24 < 12) return { hour12: hour24, ampm: "am" };
  if (hour24 === 12) return { hour12: 12, ampm: "pm" };
  return { hour12: hour24 - 12, ampm: "pm" };
}

// ── Time Picker 12h ────────────────────────────────────────────────────────────

export function TimePicker12({
  hour24,
  minute,
  onHourChange,
  onMinuteChange,
  label,
}: {
  hour24: number;
  minute: number;
  onHourChange: (h24: number) => void;
  onMinuteChange: (m: number) => void;
  label: string;
}) {
  const { hour12, ampm } = to12h(hour24);

  return (
    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
      <p className="text-xs text-muted-foreground font-bold mb-4 text-center">{label}</p>
      <div className="flex items-center justify-center gap-2">
        <NumberPicker
          value={hour12}
          onChange={(v) => onHourChange(to24h(v, ampm))}
          min={1}
          max={12}
          label="ساعة"
        />
        <div className="flex flex-col gap-1 pb-6">
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <div className="w-2 h-2 rounded-full bg-primary/60" />
        </div>
        <NumberPicker
          value={minute}
          onChange={onMinuteChange}
          min={0}
          max={59}
          label="دقيقة"
        />
        <AmPmToggle
          value={ampm}
          onChange={(newAmpm) => onHourChange(to24h(hour12, newAmpm))}
        />
      </div>
    </div>
  );
}

// ── Date Picker Row ────────────────────────────────────────────────────────────

export function DatePickerRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const dayAfter = format(addDays(new Date(), 2), "yyyy-MM-dd");

  const quickDates = [
    { label: "اليوم", value: today },
    { label: "غداً", value: tomorrow },
    { label: "ال" + format(addDays(new Date(), 2), "EEE", { locale: ar }), value: dayAfter },
  ];

  const isQuick = quickDates.some((d) => d.value === value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {quickDates.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => {
              onChange(d.value);
              setShowCustom(false);
            }}
            className={cn(
              "py-3 rounded-2xl border text-sm font-bold transition-all",
              value === d.value && !showCustom
                ? "bg-primary/20 border-primary text-primary shadow-primary/20 shadow-md"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
            )}
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "py-3 rounded-2xl border text-sm font-bold transition-all flex items-center justify-center gap-1",
            !isQuick || showCustom
              ? "bg-primary/20 border-primary text-primary"
              : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
          )}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs">تاريخ</span>
        </button>
      </div>

      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
              {value && (
                <div className="text-center">
                  <span className="text-sm font-bold text-primary">
                    {format(new Date(value + "T00:00:00"), "EEEE، d MMMM yyyy", { locale: ar })}
                  </span>
                </div>
              )}
              <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                min={today}
                className="w-full bg-transparent text-white text-sm outline-none [color-scheme:dark] border border-white/10 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {value && !isQuick && !showCustom && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {format(new Date(value + "T00:00:00"), "EEEE، d MMMM yyyy", { locale: ar })}
          </span>
        </div>
      )}
    </div>
  );
}
