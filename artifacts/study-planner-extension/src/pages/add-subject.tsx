import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  Check
} from "lucide-react";
import { useStudyCreateSubject, useStudyUpdateSubject, useStudySubject } from "@/hooks/use-study";
import { calculateTotalMinutes, cn } from "@/lib/utils";
import { useSubjectTheme, SUBJECT_THEMES } from "@/hooks/use-subject-theme";
import {
  NumberPicker,
  AmPmToggle,
  TimePicker12,
  DatePickerRow,
  to24h,
  to12h,
} from "@/components/time-date-pickers";

const SUBJECTS = [
  { name: "عربي", emoji: "📖" },
  { name: "إنجليزي", emoji: "🌍" },
  { name: "رياضيات", emoji: "🔢" },
  { name: "كيمياء", emoji: "⚗️" },
  { name: "فيزياء", emoji: "⚛️" },
  { name: "أحياء", emoji: "🧬" },
  { name: "دستور", emoji: "📜" },
  { name: "إسلامية", emoji: "🕌" },
] as const;

const formSchema = z.object({
  name: z.string().min(1, "اختر المادة"),
  date: z.string().min(1, "حدد التاريخ"),
  description: z.string().optional(),
  timeMode: z.enum(["fixed", "duration"]),
  startHour: z.number().min(0).max(23).optional(),
  startMinute: z.number().min(0).max(59).optional(),
  startAmPm: z.enum(["am", "pm"]).optional(),
  endHour: z.number().min(0).max(23).optional(),
  endMinute: z.number().min(0).max(59).optional(),
  endAmPm: z.enum(["am", "pm"]).optional(),
  durationHours: z.number().min(0).optional(),
  durationMinutes: z.number().min(0).max(59).optional(),
  distributeTime: z.boolean().default(false),
  lessons: z.array(z.object({
    name: z.string().min(1, "اسم الدرس مطلوب"),
    allocatedMinutes: z.number().min(1).nullable().optional()
  }))
});

type FormValues = z.infer<typeof formSchema>;

// ─── Main Form ───────────────────────────────────────────────────────────────
export default function AddSubject() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const editId = params?.id ? parseInt(params.id) : undefined;
  const isEditing = !!editId;

  const createMutation = useStudyCreateSubject();
  const updateMutation = useStudyUpdateSubject();
  const { data: existingSubject } = useStudySubject(editId);
  const [totalAvailableMinutes, setTotalAvailableMinutes] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      timeMode: "duration",
      startHour: 8,
      startMinute: 0,
      endHour: 9,
      endMinute: 0,
      durationHours: 1,
      durationMinutes: 0,
      distributeTime: false,
      lessons: [{ name: "", allocatedMinutes: null }],
    },
  });

  // Pre-fill form when editing an existing subject
  useEffect(() => {
    if (!isEditing || !existingSubject || prefilled) return;
    setPrefilled(true);

    const s = existingSubject;
    let dh = 1, dm = 0, sh = 8, sm = 0, eh = 9, em = 0;
    if (s.timeMode === "duration" && s.durationMinutes) {
      dh = Math.floor(s.durationMinutes / 60);
      dm = s.durationMinutes % 60;
    }
    if (s.timeMode === "fixed") {
      if (s.startTime) { const [hh, mm] = s.startTime.split(":").map(Number); sh = hh; sm = mm; }
      if (s.endTime) { const [hh, mm] = s.endTime.split(":").map(Number); eh = hh; em = mm; }
    }
    form.reset({
      name: s.name as FormValues["name"],
      date: s.date,
      description: s.description ?? "",
      timeMode: s.timeMode as "fixed" | "duration",
      startHour: sh, startMinute: sm,
      endHour: eh, endMinute: em,
      durationHours: dh, durationMinutes: dm,
      distributeTime: s.distributeTime,
      lessons: (s.lessons || []).map((l) => ({ name: l.name, allocatedMinutes: l.allocatedMinutes ?? null })),
    });
  }, [existingSubject, isEditing, prefilled]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lessons" });

  const watchTimeMode = form.watch("timeMode");
  const watchDistribute = form.watch("distributeTime");
  const watchLessons = form.watch("lessons");
  const watchStartH = form.watch("startHour") ?? 8;
  const watchStartM = form.watch("startMinute") ?? 0;
  const watchEndH = form.watch("endHour") ?? 9;
  const watchEndM = form.watch("endMinute") ?? 0;
  const watchDurationH = form.watch("durationHours") ?? 0;
  const watchDurationM = form.watch("durationMinutes") ?? 0;
  const watchName = form.watch("name");
  const watchDate = form.watch("date");

  // Apply color theme based on selected subject
  useSubjectTheme(watchName || null);

  useEffect(() => {
    let total = 0;
    if (watchTimeMode === "fixed") {
      const startTotal = watchStartH * 60 + watchStartM;
      const endTotal = watchEndH * 60 + watchEndM;
      total = endTotal > startTotal ? endTotal - startTotal : 0;
    } else {
      total = watchDurationH * 60 + watchDurationM;
    }
    setTotalAvailableMinutes(total);
  }, [watchTimeMode, watchStartH, watchStartM, watchEndH, watchEndM, watchDurationH, watchDurationM]);

  const handleToggleDistribute = (e: React.MouseEvent) => {
    e.preventDefault();
    if (totalAvailableMinutes <= 0) {
      alert("يجب تحديد الوقت الكلي أولاً قبل تخصيص الوقت للدروس");
      return;
    }
    form.setValue("distributeTime", !watchDistribute);
  };

  const usedMinutes = watchLessons.reduce((sum, l) => sum + (l.allocatedMinutes || 0), 0);
  const remainingMinutes = totalAvailableMinutes - usedMinutes;

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const onSubmit = (data: FormValues) => {
    if (data.distributeTime && remainingMinutes < 0) {
      alert("الوقت الموزع يتجاوز الوقت الكلي المتاح!");
      return;
    }

    const startTime =
      data.timeMode === "fixed"
        ? `${pad2(data.startHour ?? 0)}:${pad2(data.startMinute ?? 0)}`
        : null;
    const endTime =
      data.timeMode === "fixed"
        ? `${pad2(data.endHour ?? 0)}:${pad2(data.endMinute ?? 0)}`
        : null;
    const durationMins =
      data.timeMode === "duration"
        ? (data.durationHours ?? 0) * 60 + (data.durationMinutes ?? 0)
        : totalAvailableMinutes;

    const payload = {
      name: data.name,
      date: data.date,
      timeMode: data.timeMode,
      description: data.description || null,
      distributeTime: data.distributeTime,
      startTime,
      endTime,
      durationMinutes: durationMins,
      lessons: data.lessons.map((l) => ({
        name: l.name,
        allocatedMinutes: data.distributeTime ? (l.allocatedMinutes ?? null) : null,
      })),
    };

    if (isEditing && editId) {
      updateMutation.mutate(
        { id: editId, data: payload },
        { onSuccess: () => setLocation("/") }
      );
    } else {
      createMutation.mutate(
        { data: payload as any },
        { onSuccess: () => setLocation("/") }
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-50 overflow-y-auto no-scrollbar pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-panel border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => setLocation("/")}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">{isEditing ? "تعديل المادة" : "إضافة مادة"}</h1>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 flex flex-col gap-7">

        {/* ─── Subject Selection ─── */}
        <section className="space-y-3">
          <label className="block text-sm font-bold text-muted-foreground">اختر المادة</label>
          <div className="grid grid-cols-4 gap-2">
            {SUBJECTS.map((s) => {
              const isSelected = watchName === s.name;
              return (
                <motion.button
                  key={s.name}
                  type="button"
                  onClick={() => form.setValue("name", s.name, { shouldValidate: true })}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl border transition-all",
                    isSelected
                      ? "bg-primary/20 border-primary shadow-lg shadow-primary/20"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="subject-indicator"
                      className="absolute inset-0 rounded-2xl bg-primary/10 border-2 border-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="text-xl relative z-10">{s.emoji}</span>
                  <span
                    className={cn(
                      "text-[11px] font-bold relative z-10 transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 left-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center z-10">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
          {form.formState.errors.name && (
            <p className="text-destructive text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {form.formState.errors.name.message}
            </p>
          )}
        </section>

        {/* ─── Date Picker ─── */}
        <section className="space-y-3">
          <label className="block text-sm font-bold text-muted-foreground">التاريخ</label>
          <DatePickerRow
            value={watchDate}
            onChange={(v) => form.setValue("date", v, { shouldValidate: true })}
          />
        </section>

        {/* ─── Description ─── */}
        <section className="space-y-3">
          <label className="block text-sm font-bold text-muted-foreground">
            ملاحظات <span className="text-muted-foreground/50 font-normal">(اختياري)</span>
          </label>
          <textarea
            {...form.register("description")}
            placeholder=""
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none transition-colors"
          />
        </section>

        {/* ─── Time Settings ─── */}
        <section className="bg-black/30 border border-white/5 rounded-3xl p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-bold">نظام الوقت</h3>
          </div>

          {/* Mode toggle */}
          <div className="flex p-1 bg-black/40 rounded-xl">
            {(["fixed", "duration"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => form.setValue("timeMode", mode)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
                  watchTimeMode === mode
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {mode === "fixed" ? "وقت ثابت" : "مدة زمنية"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {watchTimeMode === "fixed" ? (
              <motion.div
                key="fixed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <TimePicker12
                  hour24={watchStartH}
                  minute={watchStartM}
                  onHourChange={(h) => form.setValue("startHour", h)}
                  onMinuteChange={(m) => form.setValue("startMinute", m)}
                  label="من"
                />
                <TimePicker12
                  hour24={watchEndH}
                  minute={watchEndM}
                  onHourChange={(h) => form.setValue("endHour", h)}
                  onMinuteChange={(m) => form.setValue("endMinute", m)}
                  label="إلى"
                />

                {totalAvailableMinutes > 0 && (
                  <div className="text-center py-2 px-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <span className="text-sm font-bold text-primary">
                      الإجمالي:{" "}
                      {totalAvailableMinutes >= 60
                        ? `${Math.floor(totalAvailableMinutes / 60)}س ${totalAvailableMinutes % 60 > 0 ? `${totalAvailableMinutes % 60}د` : ""}`
                        : `${totalAvailableMinutes} دقيقة`}
                    </span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="duration"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-black/30 rounded-2xl p-4 border border-white/5"
              >
                <p className="text-xs text-muted-foreground font-bold mb-4 text-center">المدة الزمنية</p>
                <div className="flex items-center justify-center gap-4">
                  <NumberPicker
                    value={watchDurationH}
                    onChange={(v) => form.setValue("durationHours", v)}
                    min={0}
                    max={12}
                    label="ساعة"
                    pad={false}
                  />
                  <div className="flex flex-col gap-1 pb-6">
                    <div className="w-2 h-2 rounded-full bg-primary/60" />
                    <div className="w-2 h-2 rounded-full bg-primary/60" />
                  </div>
                  <NumberPicker
                    value={watchDurationM}
                    onChange={(v) => form.setValue("durationMinutes", v)}
                    min={0}
                    max={59}
                    label="دقيقة"
                  />
                </div>
                {totalAvailableMinutes > 0 && (
                  <p className="text-center text-xs text-primary mt-4 font-bold">
                    {totalAvailableMinutes >= 60
                      ? `${Math.floor(totalAvailableMinutes / 60)} ساعة ${totalAvailableMinutes % 60 > 0 ? `و ${totalAvailableMinutes % 60} دقيقة` : ""}`
                      : `${totalAvailableMinutes} دقيقة`}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Distribute Time toggle */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">تخصيص الوقت للدروس</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalAvailableMinutes > 0
                  ? `توزيع ${totalAvailableMinutes} دقيقة على الدروس`
                  : "حدد الوقت أولاً"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleDistribute}
              className={cn(
                "w-12 h-6 rounded-full transition-all duration-300 relative shrink-0",
                watchDistribute ? "bg-primary shadow-primary/30 shadow-md" : "bg-white/20",
                totalAvailableMinutes <= 0 && "opacity-50 cursor-not-allowed"
              )}
            >
              <motion.div
                animate={{ x: watchDistribute ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white absolute top-1 left-1"
              />
            </button>
          </div>
        </section>

        {/* ─── Lessons ─── */}
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <label className="block text-sm font-bold text-muted-foreground">الدروس</label>
            {watchDistribute && totalAvailableMinutes > 0 && (
              <div
                className={cn(
                  "text-xs font-bold px-3 py-1 rounded-lg transition-colors",
                  remainingMinutes < 0
                    ? "bg-destructive/20 text-destructive border border-destructive/30"
                    : remainingMinutes === 0
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/5 text-muted-foreground"
                )}
              >
                متبقي: {remainingMinutes} د
              </div>
            )}
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-2xl px-4 py-3">
                    <span className="text-muted-foreground text-sm w-5 shrink-0">{index + 1}.</span>
                    <input
                      {...form.register(`lessons.${index}.name`)}
                      placeholder="اسم الدرس..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/50 outline-none"
                    />
                    {watchDistribute && (
                      <input
                        type="number"
                        {...form.register(`lessons.${index}.allocatedMinutes`, { valueAsNumber: true })}
                        placeholder="د"
                        min={1}
                        className="w-12 bg-black/40 border border-white/10 rounded-lg text-center text-xs text-primary font-bold py-1 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    )}
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => append({ name: "", allocatedMinutes: null })}
            className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-muted-foreground hover:text-white hover:border-white/40 transition-all text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة درس
          </button>
        </section>

        {/* ─── Submit ─── */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/30 disabled:opacity-50"
        >
          {isSaving ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة المادة"}
        </button>
      </form>
    </div>
  );
}
