import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { format, parse } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarX2, ChevronDown, Check, Trash2, CalendarClock, X, Clock } from "lucide-react";
import {
  useStudyPostponed,
  useStudyDeletePostponed,
  useStudyDeletePostponedGroup,
  useStudyReschedulePostponed,
} from "@/hooks/use-study";
import type { PostponedLesson } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { DatePickerRow, TimePicker12, NumberPicker } from "@/components/time-date-pickers";

interface PostponedGroup {
  key: string;
  subjectName: string;
  date: string;
  lessons: PostponedLesson[];
}

function groupPostponed(items: PostponedLesson[]): PostponedGroup[] {
  const map = new Map<string, PostponedGroup>();
  for (const item of items) {
    const key = `${item.subjectName}__${item.originalDate}`;
    if (!map.has(key)) {
      map.set(key, { key, subjectName: item.subjectName, date: item.originalDate, lessons: [] });
    }
    map.get(key)!.lessons.push(item);
  }
  return Array.from(map.values());
}

function formatDateAr(dateStr: string): string {
  try {
    const d = parse(dateStr, "yyyy-MM-dd", new Date());
    return format(d, "EEEE، d MMMM", { locale: ar });
  } catch {
    return dateStr;
  }
}

// ── Reschedule Form ────────────────────────────────────────────────────────────

function RescheduleForm({ group, onClose }: { group: PostponedGroup; onClose: () => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [timeMode, setTimeMode] = useState<"fixed" | "duration">("duration");
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(9);
  const [endMinute, setEndMinute] = useState(0);
  const [durationHours, setDurationHours] = useState(1);
  const [durationMins, setDurationMins] = useState(0);
  const rescheduleMutation = useStudyReschedulePostponed();
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const handleSubmit = () => {
    if (!date) return;
    const isFixed = timeMode === "fixed";
    rescheduleMutation.mutate(
      {
        ids: group.lessons.map((l) => l.id),
        subjectName: group.subjectName,
        date,
        timeMode,
        startTime: isFixed ? `${pad2(startHour)}:${pad2(startMinute)}` : undefined,
        endTime: isFixed ? `${pad2(endHour)}:${pad2(endMinute)}` : undefined,
        durationMinutes: !isFixed ? durationHours * 60 + durationMins : undefined,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div
        className="mt-3 p-4 rounded-2xl space-y-4"
        style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">إعادة جدولة</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">التاريخ الجديد</p>
          <DatePickerRow value={date} onChange={setDate} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-bold text-muted-foreground">نظام الوقت</p>
          </div>
          <div className="flex p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
            {(["fixed", "duration"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTimeMode(mode)}
                className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", timeMode === mode ? "text-white" : "text-muted-foreground")}
                style={timeMode === mode ? { background: "rgba(255,255,255,0.1)" } : {}}
              >
                {mode === "fixed" ? "⏰ وقت ثابت" : "⏱ مدة زمنية"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {timeMode === "fixed" ? (
              <motion.div key="fixed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
                <TimePicker12 hour24={startHour} minute={startMinute} onHourChange={setStartHour} onMinuteChange={setStartMinute} label="البداية" />
                <TimePicker12 hour24={endHour} minute={endMinute} onHourChange={setEndHour} onMinuteChange={setEndMinute} label="النهاية" />
              </motion.div>
            ) : (
              <motion.div key="duration" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs text-muted-foreground font-bold mb-3 text-center">المدة الزمنية</p>
                  <div className="flex items-center justify-center gap-4">
                    <NumberPicker value={durationHours} onChange={setDurationHours} min={0} max={12} label="ساعة" pad={false} />
                    <div className="flex flex-col gap-1.5 pb-6">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.5)" }} />
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.5)" }} />
                    </div>
                    <NumberPicker value={durationMins} onChange={setDurationMins} min={0} max={59} label="دقيقة" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!date || rescheduleMutation.isPending}
          className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 4px 14px hsl(var(--primary) / 0.3)",
          }}
        >
          {rescheduleMutation.isPending ? "جاري الإضافة..." : "إضافة للجدول"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Group Card ─────────────────────────────────────────────────────────────────

function PostponedGroupCard({ group }: { group: PostponedGroup }) {
  const [expanded, setExpanded] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteMutation = useStudyDeletePostponed();
  const deleteGroupMutation = useStudyDeletePostponedGroup();

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Left accent bar */}
        <div className="flex">
          <div className="w-1 self-stretch rounded-r-full shrink-0"
            style={{ background: "hsl(var(--destructive))", opacity: 0.7 }} />

          <div className="flex-1 p-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex-1 flex items-center gap-3 min-w-0 text-right"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
                    >
                      {group.subjectName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatDateAr(group.date)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {group.lessons.length} {group.lessons.length === 1 ? "درس مؤجل" : "دروس مؤجلة"}
                  </p>
                </div>
                <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </motion.div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setRescheduling(!rescheduling)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={rescheduling
                    ? { background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }
                    : { background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)" }
                  }
                >
                  <CalendarClock className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteGroupMutation.isPending}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "hsl(var(--destructive) / 0.15)";
                    (e.currentTarget as HTMLElement).style.color = "hsl(var(--destructive))";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLElement).style.color = "";
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reschedule */}
            <AnimatePresence>
              {rescheduling && (
                <RescheduleForm key="reschedule" group={group} onClose={() => setRescheduling(false)} />
              )}
            </AnimatePresence>

            {/* Lessons list */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {group.lessons.map((lesson) => (
                        <motion.div
                          key={lesson.id}
                          layout
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -24, scale: 0.95 }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <span className="flex-1 text-sm font-medium text-right">{lesson.lessonName}</span>
                          <button
                            onClick={() => deleteMutation.mutate({ id: lesson.id })}
                            disabled={deleteMutation.isPending}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "rgb(74,222,128)" }}
                            title="تم الإنجاز"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`حذف دروس ${group.subjectName}`}
        description={`هل أنت متأكد من حذف جميع دروس "${group.subjectName}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        onConfirm={() => deleteGroupMutation.mutate({ ids: group.lessons.map((l) => l.id) })}
      />
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Postponed() {
  const { data: postponed, isLoading } = useStudyPostponed();
  const groups = groupPostponed(postponed ?? []);

  return (
    <div className="p-5">
      <header className="mb-6">
        <h1 className="text-3xl font-black mb-1">المؤجلة</h1>
        <p className="text-sm text-muted-foreground">الدروس التي لم يتم إنجازها في وقتها</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-3xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <CalendarX2 className="w-9 h-9 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-extrabold mb-1">لا توجد دروس مؤجلة</h3>
          <p className="text-sm text-muted-foreground">أنت تسير حسب الخطة، ممتاز!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {groups.map((group) => (
              <PostponedGroupCard key={group.key} group={group} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
