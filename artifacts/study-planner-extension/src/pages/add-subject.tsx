import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Plus, Trash2, Clock, AlertCircle, Check, BellOff } from "lucide-react";
import { useStudyCreateSubject, useStudyUpdateSubject, useStudySubject } from "@/hooks/use-study";
import { calculateTotalMinutes, cn } from "@/lib/utils";
import { useSubjectTheme, SUBJECT_THEMES } from "@/hooks/use-subject-theme";
import {
  NumberPicker,
  TimePicker12,
  DatePickerRow,
} from "@/components/time-date-pickers";
import {
  getTelegramSettings,
  scheduleSubjectNotifications,
  cancelSubjectNotifications,
} from "@/lib/telegram";

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
  endHour: z.number().min(0).max(23).optional(),
  endMinute: z.number().min(0).max(59).optional(),
  durationHours: z.number().min(0).optional(),
  durationMinutes: z.number().min(0).max(59).optional(),
  distributeTime: z.boolean().default(false),
  lessons: z.array(z.object({
    name: z.string().min(1, "اسم الدرس مطلوب"),
    allocatedMinutes: z.number().min(1).nullable().optional()
  }))
});

type FormValues = z.infer<typeof formSchema>;

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

  useSubjectTheme(watchName || null);

  useEffect(() => {
    let total = 0;
    if (watchTimeMode === "fixed") {
      const s = watchStartH * 60 + watchStartM;
      const e = watchEndH * 60 + watchEndM;
      total = e > s ? e - s : 0;
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

  const [scheduleInfo, setScheduleInfo] = useState<string | null>(null);

  const onSubmit = (data: FormValues) => {
    if (data.distributeTime && remainingMinutes < 0) {
      alert("الوقت الموزع يتجاوز الوقت الكلي المتاح!");
      return;
    }
    const startTime = data.timeMode === "fixed" ? `${pad2(data.startHour ?? 0)}:${pad2(data.startMinute ?? 0)}` : null;
    const endTime = data.timeMode === "fixed" ? `${pad2(data.endHour ?? 0)}:${pad2(data.endMinute ?? 0)}` : null;
    const durationMins = data.timeMode === "duration"
      ? (data.durationHours ?? 0) * 60 + (data.durationMinutes ?? 0)
      : totalAvailableMinutes;

    const payload = {
      name: data.name,
      date: data.date,
      timeMode: data.timeMode,
      description: data.description || null,
      distributeTime: data.distributeTime,
      startTime, endTime,
      durationMinutes: durationMins,
      lessons: data.lessons.map((l) => ({
        name: l.name,
        allocatedMinutes: data.distributeTime ? (l.allocatedMinutes ?? null) : null,
      })),
    };

    const handleSchedule = (savedSubject: { id: number }) => {
      const tgSettings = getTelegramSettings();
      if (!tgSettings || data.timeMode !== "fixed" || !startTime) {
        setLocation("/");
        return;
      }
      // Cancel any old pending notifications for this subject (edit case)
      cancelSubjectNotifications(savedSubject.id);
      // Store new locally-scheduled notifications (sent when app is open at the right time)
      const count = scheduleSubjectNotifications(
        { id: savedSubject.id, name: data.name, date: data.date, timeMode: "fixed", startTime, endTime },
        tgSettings
      );
      if (count > 0) {
        setScheduleInfo(`سيتم إرسال ${count} إشعار في وقتها عند فتح التطبيق`);
        setTimeout(() => setLocation("/"), 1600);
      } else {
        setLocation("/");
      }
    };

    if (isEditing && editId) {
      updateMutation.mutate(
        { id: editId, data: payload },
        { onSuccess: () => handleSchedule({ id: editId }) }
      );
    } else {
      createMutation.mutate(
        { data: payload as any },
        { onSuccess: (savedSubject) => handleSchedule(savedSubject) }
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full absolute inset-0 z-50 overflow-y-auto no-scrollbar pb-36"
      style={{ background: "hsl(240 15% 5%)" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-20 px-4 py-4 flex items-center gap-3"
        style={{
          background: "rgba(12,11,20,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setLocation("/")}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-extrabold">{isEditing ? "تعديل المادة" : "مادة جديدة"}</h1>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 flex flex-col gap-6">

        {/* ─── Subject Selection ─── */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-3 tracking-wider">اختر المادة</p>
          <div className="grid grid-cols-4 gap-2.5">
            {SUBJECTS.map((s) => {
              const isSelected = watchName === s.name;
              return (
                <motion.button
                  key={s.name}
                  type="button"
                  onClick={() => form.setValue("name", s.name, { shouldValidate: true })}
                  whileTap={{ scale: 0.93 }}
                  className="relative flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-2xl border transition-all"
                  style={isSelected
                    ? {
                        background: "hsl(var(--primary) / 0.15)",
                        border: "1px solid hsl(var(--primary) / 0.5)",
                        boxShadow: "0 0 16px hsl(var(--primary) / 0.15)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                  }
                >
                  {isSelected && (
                    <div
                      className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-2xl">{s.emoji}</span>
                  <span className={cn("text-[11px] font-bold", isSelected ? "text-primary" : "text-muted-foreground")}>
                    {s.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
          {form.formState.errors.name && (
            <p className="text-destructive text-xs flex items-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* ─── Date ─── */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-3 tracking-wider">التاريخ</p>
          <DatePickerRow value={watchDate} onChange={(v) => form.setValue("date", v, { shouldValidate: true })} />
        </div>

        {/* ─── Description ─── */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-3 tracking-wider">
            ملاحظات <span className="font-normal opacity-60">(اختياري)</span>
          </p>
          <textarea
            {...form.register("description")}
            rows={2}
            placeholder="أضف ملاحظة..."
            className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/40 outline-none resize-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "hsl(var(--primary) / 0.5)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>

        {/* ─── Time Settings ─── */}
        <div
          className="rounded-3xl p-5 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.15)" }}
            >
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <p className="font-extrabold">نظام الوقت</p>
          </div>

          {/* Mode toggle */}
          <div
            className="flex p-1 rounded-xl"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            {(["fixed", "duration"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => form.setValue("timeMode", mode)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
                  watchTimeMode === mode ? "text-white" : "text-muted-foreground hover:text-white"
                )}
                style={watchTimeMode === mode ? {
                  background: "rgba(255,255,255,0.1)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                } : {}}
              >
                {mode === "fixed" ? "⏰ وقت ثابت" : "⏱ مدة زمنية"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {watchTimeMode === "fixed" ? (
              <motion.div key="fixed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
                <TimePicker12
                  hour24={watchStartH} minute={watchStartM}
                  onHourChange={(h) => form.setValue("startHour", h)}
                  onMinuteChange={(m) => form.setValue("startMinute", m)}
                  label="من"
                />
                <TimePicker12
                  hour24={watchEndH} minute={watchEndM}
                  onHourChange={(h) => form.setValue("endHour", h)}
                  onMinuteChange={(m) => form.setValue("endMinute", m)}
                  label="إلى"
                />
                {totalAvailableMinutes > 0 && (
                  <div
                    className="text-center py-2 px-4 rounded-xl"
                    style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}
                  >
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
              <motion.div key="duration" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <p className="text-xs text-muted-foreground font-bold mb-4 text-center">المدة الزمنية</p>
                  <div className="flex items-center justify-center gap-4">
                    <NumberPicker value={watchDurationH} onChange={(v) => form.setValue("durationHours", v)} min={0} max={12} label="ساعة" pad={false} />
                    <div className="flex flex-col gap-1.5 pb-6">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.5)" }} />
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.5)" }} />
                    </div>
                    <NumberPicker value={watchDurationM} onChange={(v) => form.setValue("durationMinutes", v)} min={0} max={59} label="دقيقة" />
                  </div>
                  {totalAvailableMinutes > 0 && (
                    <p className="text-center text-sm font-bold mt-3" style={{ color: "hsl(var(--primary))" }}>
                      {totalAvailableMinutes >= 60
                        ? `${Math.floor(totalAvailableMinutes / 60)} ساعة${totalAvailableMinutes % 60 > 0 ? ` و ${totalAvailableMinutes % 60} دقيقة` : ""}`
                        : `${totalAvailableMinutes} دقيقة`}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Distribute toggle */}
          <div className="pt-1 border-t border-white/5 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">تخصيص الوقت للدروس</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalAvailableMinutes > 0 ? `توزيع ${totalAvailableMinutes} دقيقة على الدروس` : "حدد الوقت أولاً"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleDistribute}
              className="w-12 h-6 rounded-full relative transition-all duration-300 shrink-0"
              style={{
                background: watchDistribute ? "hsl(var(--primary))" : "rgba(255,255,255,0.15)",
                opacity: totalAvailableMinutes <= 0 ? 0.4 : 1,
                boxShadow: watchDistribute ? "0 2px 8px hsl(var(--primary) / 0.4)" : "none",
              }}
            >
              <motion.div
                animate={{ x: watchDistribute ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white absolute top-1 left-1 shadow"
              />
            </button>
          </div>
        </div>

        {/* ─── Lessons ─── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-bold text-muted-foreground tracking-wider">الدروس</p>
            {watchDistribute && totalAvailableMinutes > 0 && (
              <span
                className={cn("text-xs font-bold px-2.5 py-1 rounded-lg", remainingMinutes < 0 ? "text-destructive" : remainingMinutes === 0 ? "text-primary" : "text-muted-foreground")}
                style={{
                  background: remainingMinutes < 0 ? "hsl(var(--destructive) / 0.12)" : remainingMinutes === 0 ? "hsl(var(--primary) / 0.12)" : "rgba(255,255,255,0.05)",
                  border: remainingMinutes < 0 ? "1px solid hsl(var(--destructive) / 0.25)" : remainingMinutes === 0 ? "1px solid hsl(var(--primary) / 0.25)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                متبقي: {remainingMinutes} د
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            <AnimatePresence>
              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="flex items-center gap-2"
                >
                  <div
                    className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-muted-foreground text-xs w-5 shrink-0 font-bold">{index + 1}</span>
                    <input
                      {...form.register(`lessons.${index}.name`)}
                      placeholder="اسم الدرس..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-muted-foreground/40 outline-none"
                    />
                    {watchDistribute && (
                      <input
                        type="number"
                        {...form.register(`lessons.${index}.allocatedMinutes`, { valueAsNumber: true })}
                        placeholder="د"
                        min={1}
                        className="w-12 rounded-lg text-center text-xs font-bold py-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none transition-all"
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "hsl(var(--primary))",
                        }}
                      />
                    )}
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                      style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}
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
            className="mt-2.5 w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-all text-muted-foreground hover:text-white"
            style={{ border: "1.5px dashed rgba(255,255,255,0.15)" }}
          >
            <Plus className="w-4 h-4" />
            إضافة درس
          </button>
        </div>

        {/* ─── Schedule info ─── */}
        {scheduleInfo && (
          <div
            className="w-full px-4 py-3 rounded-2xl text-sm font-bold text-center"
            style={{ background: "hsl(var(--accent) / 0.15)", border: "1px solid hsl(var(--accent) / 0.3)", color: "hsl(var(--accent))" }}
          >
            🗓 {scheduleInfo}
          </div>
        )}

        {/* ─── Submit ─── */}
        <button
          type="submit"
          disabled={isSaving || !!scheduleInfo}
          className="w-full py-4 rounded-2xl font-extrabold text-base text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 6px 20px hsl(var(--primary) / 0.35)",
          }}
        >
          {scheduleInfo ? "✅ تم الجدولة" : isSaving ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة المادة"}
        </button>
      </form>
    </div>
  );
}
