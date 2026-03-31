import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { format, parse } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarX2,
  ChevronDown,
  Check,
  Trash2,
  CalendarClock,
  X,
  Clock,
} from "lucide-react";
import {
  useStudyPostponed,
  useStudyDeletePostponed,
  useStudyDeletePostponedGroup,
  useStudyReschedulePostponed,
} from "@/hooks/use-study";
import type { PostponedLesson } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  DatePickerRow,
  TimePicker12,
  NumberPicker,
  to24h,
} from "@/components/time-date-pickers";

// ── Grouping ──────────────────────────────────────────────────────────────────

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
      map.set(key, {
        key,
        subjectName: item.subjectName,
        date: item.originalDate,
        lessons: [],
      });
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

// ── Reschedule Form ───────────────────────────────────────────────────────────

interface RescheduleFormProps {
  group: PostponedGroup;
  onClose: () => void;
}

function RescheduleForm({ group, onClose }: RescheduleFormProps) {
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
      <div className="mt-3 p-4 rounded-2xl bg-black/30 border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">إعادة جدولة الدروس</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">التاريخ الجديد</p>
          <DatePickerRow value={date} onChange={setDate} />
        </div>

        {/* Time mode toggle */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold text-muted-foreground">نظام الوقت</p>
          </div>
          <div className="flex p-1 bg-black/40 rounded-xl">
            {(["fixed", "duration"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTimeMode(mode)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                  timeMode === mode
                    ? "bg-primary/20 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {mode === "fixed" ? "⏰ وقت ثابت" : "⏱ مدة زمنية"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {timeMode === "fixed" ? (
              <motion.div
                key="fixed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <TimePicker12
                  hour24={startHour}
                  minute={startMinute}
                  onHourChange={setStartHour}
                  onMinuteChange={setStartMinute}
                  label="وقت البداية"
                />
                <TimePicker12
                  hour24={endHour}
                  minute={endMinute}
                  onHourChange={setEndHour}
                  onMinuteChange={setEndMinute}
                  label="وقت النهاية"
                />
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
                    value={durationHours}
                    onChange={setDurationHours}
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
                    value={durationMins}
                    onChange={setDurationMins}
                    min={0}
                    max={59}
                    label="دقيقة"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!date || rescheduleMutation.isPending}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary/80 to-accent/80 hover:from-primary hover:to-accent font-bold text-sm transition-all disabled:opacity-50"
        >
          {rescheduleMutation.isPending ? "جاري الإضافة..." : "إضافة للجدول"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Group Card ────────────────────────────────────────────────────────────────

function PostponedGroupCard({ group }: { group: PostponedGroup }) {
  const [expanded, setExpanded] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteMutation = useStudyDeletePostponed();
  const deleteGroupMutation = useStudyDeletePostponedGroup();

  const handleDeleteLesson = (id: number) => {
    deleteMutation.mutate({ id });
  };

  const handleDeleteGroup = () => {
    setShowDeleteDialog(true);
  };

  return (
    <>
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      {/* Group Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 min-w-0 text-right"
        >
          <motion.div
            animate={{ rotate: expanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                {group.subjectName}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatDateAr(group.date)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {group.lessons.length} {group.lessons.length === 1 ? "درس مؤجل" : "دروس مؤجلة"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setRescheduling(!rescheduling); }}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
              rescheduling
                ? "bg-primary/30 text-primary"
                : "bg-white/5 hover:bg-primary/20 text-muted-foreground hover:text-primary"
            )}
            title="إعادة جدولة"
          >
            <CalendarClock className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteGroup}
            disabled={deleteGroupMutation.isPending}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors disabled:opacity-50"
            title="حذف الكل"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reschedule Form */}
      <div className="px-4">
        <AnimatePresence>
          {rescheduling && (
            <RescheduleForm
              key="reschedule"
              group={group}
              onClose={() => setRescheduling(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Lessons List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              <AnimatePresence mode="popLayout">
                {group.lessons.map((lesson) => (
                  <motion.div
                    key={lesson.id}
                    layout
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30, scale: 0.95 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/30 border border-white/5"
                  >
                    <span className="flex-1 text-sm font-medium text-white text-right">
                      {lesson.lessonName}
                    </span>
                    <button
                      onClick={() => handleDeleteLesson(lesson.id)}
                      disabled={deleteMutation.isPending}
                      className="w-8 h-8 rounded-full bg-green-500/10 hover:bg-green-500/30 border border-green-500/20 hover:border-green-500/50 flex items-center justify-center text-green-400 transition-colors shrink-0 disabled:opacity-50"
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Postponed() {
  const { data: postponed, isLoading } = useStudyPostponed();
  const groups = groupPostponed(postponed ?? []);

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">المؤجلة</h1>
        <p className="text-muted-foreground text-sm">
          الدروس التي لم يتم إنجازها في وقتها
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center opacity-70">
          <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
            <CalendarX2 className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد دروس مؤجلة</h3>
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
