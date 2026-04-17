import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, Check, MoreVertical, Trash2, BookOpen,
  Timer, Pencil, ChevronDown, Pause, Play, Square, Zap, CalendarDays
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { useLocation } from "wouter";
import {
  useStudySubjects,
  useStudyStartSubject,
  useStudyCompleteSubject,
  useStudyToggleLesson,
  useStudyDeleteSubject,
  useStudyResetSubject,
} from "@/hooks/use-study";
import { useTimer, useLessonTimer } from "@/hooks/use-timer";
import { formatTimeMMSS, cn } from "@/lib/utils";
import type { Subject, Lesson } from "@/lib/storage";
import { useApplyTheme } from "@/hooks/use-subject-theme";
import { ShareImportButtons, ImportPreviewModal } from "@/components/share-import-dialog";
import { useImportFromUrl } from "@/hooks/use-import-from-url";
import { TelegramBellButton, TelegramSetupDialog } from "@/components/telegram-setup-dialog";
import {
  getTelegramSettings,
  sendTelegramMessage,
  cancelSubjectNotifications,
  getSubjectScheduledCount,
  buildPostponedMsg,
  type TelegramSettings,
} from "@/lib/telegram";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";

// ── helpers ───────────────────────────────────────────────────────────────────

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesUntil(timeStr: string): number {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return timeStrToMinutes(timeStr) - nowMins;
}

function fmtCountdown(mins: number): string {
  if (mins <= 0) return "الآن";
  if (mins < 60) return `${mins} د`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}س ${m}د` : `${h} ساعة`;
}

function parseTimeToday(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function useFixedTimeTimer(startTime: string | null | undefined, endTime: string | null | undefined, isActive: boolean) {
  const [state, setState] = useState({ secondsLeft: 0, progress: 0 });

  useEffect(() => {
    if (!isActive || !startTime || !endTime) {
      setState({ secondsLeft: 0, progress: 0 });
      return;
    }
    const startMs = parseTimeToday(startTime);
    const endMs = parseTimeToday(endTime);
    const totalSeconds = Math.max(1, (endMs - startMs) / 1000);

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, (endMs - now) / 1000);
      const elapsed = Math.max(0, (now - startMs) / 1000);
      const progress = Math.min(100, (elapsed / totalSeconds) * 100);
      setState({ secondsLeft: Math.floor(remaining), progress });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime, isActive]);

  return state;
}

// Duration-mode Telegram message builders (for non-fixed subjects only)
function tgSep() { return "━━━━━━━━━━━━━━━━━━"; }

function buildDurationOnStartMsg(subjectName: string) {
  return [`📚 <b>بدأت المادة الآن!</b>`, tgSep(), `📖 <b>${subjectName}</b>`, tgSep(), `<i>ركّز وأنت قادر! 🌟</i>`].join("\n");
}

function buildDurationBeforeEndMsg(subjectName: string, mins: number) {
  return [`⏳ <b>قارب الوقت على الانتهاء!</b>`, tgSep(), `📖 <b>${subjectName}</b>`, `⏱ تبقّى <b>${mins} دقيقة</b> فقط`, tgSep(), `<i>أكمل ما بدأت! 🎯</i>`].join("\n");
}

function buildDurationOnEndMsg(subjectName: string) {
  return [`✅ <b>انتهت المادة!</b>`, tgSep(), `🎉 أتممت مذاكرة <b>${subjectName}</b> بنجاح`, tgSep(), `<i>عمل رائع، واصل التقدم! ⭐</i>`].join("\n");
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: subjects, isLoading } = useStudySubjects();
  const applyTheme = useApplyTheme();
  const [showCompleted, setShowCompleted] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings | null>(() => getTelegramSettings());
  const { previewSubjects, clearPreview, saveImported, saving: importSaving } = useImportFromUrl();

  const sendNotif = useCallback(async (text: string) => {
    const s = getTelegramSettings();
    if (!s?.botToken || !s?.chatId) return;
    await sendTelegramMessage(s.botToken, s.chatId, text);
  }, []);

  // Run background scheduler — checks every 20s and fires due notifications
  useNotificationScheduler(telegramSettings);

  const handleTelegramClose = useCallback(() => {
    setTelegramOpen(false);
    setTelegramSettings(getTelegramSettings());
  }, []);

  const allSubjects = Array.isArray(subjects) ? subjects : [];
  const pendingOrActive = allSubjects.filter((s) => s.status !== "completed");
  const completedSubjects = allSubjects.filter((s) => s.status === "completed");
  const sortedSubjects = [...pendingOrActive].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    return 0;
  });

  useEffect(() => {
    const active = sortedSubjects.find((s) => s.status === "active");
    applyTheme(active ? active.name : null);
  }, [sortedSubjects, applyTheme]);

  useEffect(() => () => applyTheme(null), []);

  const today = format(new Date(), "EEEE، d MMMM", { locale: ar });

  return (
    <div className="p-5 pb-6">
      {/* ── Header ── */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase mb-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {today}
          </p>
          <h1 className="text-3xl font-black text-gradient-soft leading-tight">مرحباً بك!</h1>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <TelegramBellButton onClick={() => setTelegramOpen(true)} />
          <ShareImportButtons subjects={allSubjects.filter((s) => s.status !== "completed")} />
        </div>
      </header>

      <TelegramSetupDialog open={telegramOpen} onClose={handleTelegramClose} />

      <AnimatePresence>
        {previewSubjects && (
          <ImportPreviewModal
            subjects={previewSubjects}
            onSave={saveImported}
            onCancel={clearPreview}
            saving={importSaving}
          />
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-3xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : sortedSubjects.length === 0 && completedSubjects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onActivate={applyTheme}
                telegramSettings={telegramSettings}
                sendNotif={sendNotif}
              />
            ))}
          </AnimatePresence>

          {completedSubjects.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold">مكتملة ({completedSubjects.length})</span>
                </div>
                <motion.div animate={{ rotate: showCompleted ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showCompleted && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2">
                      <AnimatePresence mode="popLayout">
                        {completedSubjects.map((subject) => (
                          <CompletedSubjectCard key={subject.id} subject={subject} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <BookOpen className="w-9 h-9 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-extrabold mb-1">لا توجد مواد حالياً</h3>
      <p className="text-sm text-muted-foreground">اضغط + لإضافة مادة جديدة</p>
    </div>
  );
}

// ── SubjectCard ───────────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  onActivate,
  telegramSettings,
  sendNotif,
}: {
  subject: Subject;
  onActivate: (name: string | null) => void;
  telegramSettings: TelegramSettings | null;
  sendNotif: (text: string) => Promise<void>;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [minsUntilStart, setMinsUntilStart] = useState<number | null>(null);
  const startMutation = useStudyStartSubject();
  const completeMutation = useStudyCompleteSubject();
  const deleteMutation = useStudyDeleteSubject();
  const resetMutation = useStudyResetSubject();
  const [, setLocation] = useLocation();
  const autoStartedRef = useRef(false);
  const autoCompleteRef = useRef(false);
  const autoCompleteByTimerRef = useRef(false);
  const sentNotifsRef = useRef(new Set<string>());

  const isActive = subject.status === "active";
  const isPending = subject.status === "pending";
  const lessons = subject.lessons || [];
  const totalDuration = subject.durationMinutes || 60;
  const hasDistributed = lessons.some((l) => l.allocatedMinutes && l.allocatedMinutes > 0);
  const isFixedTime = subject.timeMode === "fixed";
  const isToday = subject.date === format(new Date(), "yyyy-MM-dd");

  const tgEnabled = !!(telegramSettings?.botToken && telegramSettings?.chatId);
  const tgNotif = telegramSettings?.notifications;

  // Check if this subject has pre-scheduled Telegram messages (fixed-time subjects)
  const hasPreScheduled = isFixedTime && getSubjectScheduledCount(subject.id) > 0;

  function fireNotif(key: string, text: string) {
    if (!tgEnabled) return;
    // For fixed-time subjects with pre-scheduled messages, skip browser-side notifs
    // (except onPostponed which can't be pre-scheduled)
    if (hasPreScheduled && !key.startsWith("onPostponed")) return;
    if (sentNotifsRef.current.has(key)) return;
    sentNotifsRef.current.add(key);
    sendNotif(text);
  }

  // Auto-start for fixed-time subjects (browser side — detects when time arrives)
  useEffect(() => {
    if (!isPending || !isFixedTime || !subject.startTime || !isToday) return;
    const check = () => {
      const mins = minutesUntil(subject.startTime!);
      setMinsUntilStart(mins);

      if (mins <= 0 && !autoStartedRef.current && !startMutation.isPending) {
        autoStartedRef.current = true;
        startMutation.mutate({ id: subject.id });
      }
    };
    check();
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, [isPending, isFixedTime, subject.startTime, isToday, subject.id]);

  // Duration-mode: send onStart notification when subject starts (user pressed button)
  // This is handled inline in the start button click handler below

  // Auto-complete when all lessons done
  useEffect(() => {
    if (!isActive || lessons.length === 0 || autoCompleteRef.current) return;
    const allDone = lessons.every((l) => l.completed);
    if (allDone && !completeMutation.isPending) {
      autoCompleteRef.current = true;
      if (!isFixedTime && tgEnabled && tgNotif?.onEnd) {
        fireNotif(`onEnd_${subject.id}`, buildDurationOnEndMsg(subject.name));
      }
      completeMutation.mutate({ id: subject.id });
    }
  }, [isActive, lessons, subject.id]);

  const durationTimer = useTimer(subject.id, totalDuration, isActive && !isFixedTime);
  const fixedTimer = useFixedTimeTimer(subject.startTime, subject.endTime, isActive && isFixedTime);
  const simpleTimer = isFixedTime ? fixedTimer : durationTimer;
  const isDurationPaused = !isFixedTime && durationTimer.isPaused;
  const lessonTimer = useLessonTimer(subject.id, lessons, totalDuration, isActive && !isFixedTime, isDurationPaused);

  // Duration-mode: auto-complete when timer hits zero
  useEffect(() => {
    if (
      isActive && !isFixedTime && !isDurationPaused &&
      simpleTimer.secondsLeft === 0 &&
      simpleTimer.progress >= 100 &&
      !autoCompleteByTimerRef.current &&
      !completeMutation.isPending
    ) {
      autoCompleteByTimerRef.current = true;
      const incomplete = lessons.filter((l) => !l.completed);
      if (tgEnabled && tgNotif?.onEnd) {
        fireNotif(`onEnd_${subject.id}`, buildDurationOnEndMsg(subject.name));
      }
      if (tgEnabled && tgNotif?.onPostponed && incomplete.length > 0) {
        fireNotif(`onPostponed_${subject.id}`, buildPostponedMsg(subject.name, incomplete.map((l) => l.name)));
      }
      completeMutation.mutate({ id: subject.id });
      onActivate(null);
    }
  }, [isActive, isFixedTime, isDurationPaused, simpleTimer.secondsLeft, simpleTimer.progress, subject.id]);

  // Duration-mode: before-end notification
  useEffect(() => {
    if (!isActive || isFixedTime || !tgEnabled || !tgNotif?.beforeEnd) return;
    const threshold = (tgNotif.beforeEndMinutes ?? 5) * 60;
    if (simpleTimer.secondsLeft > 0 &&
        simpleTimer.secondsLeft <= threshold &&
        simpleTimer.secondsLeft > threshold - 30) {
      fireNotif(`beforeEnd_${subject.id}`, buildDurationBeforeEndMsg(subject.name, tgNotif.beforeEndMinutes ?? 5));
    }
  }, [isActive, isFixedTime, simpleTimer.secondsLeft, tgEnabled]);

  const completedLessons = lessons.filter((l) => l.completed).length;
  const progressPercent = lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;

  const handleDelete = () => {
    deleteMutation.mutate({ id: subject.id }, {
      onSuccess: () => {
        cancelSubjectNotifications(subject.id);
      }
    });
  };

  const handleComplete = () => {
    const incomplete = lessons.filter((l) => !l.completed);

    // Cancel any remaining pending notifications for this subject
    cancelSubjectNotifications(subject.id);

    // For duration-mode: send onEnd immediately
    if (!isFixedTime && tgEnabled && tgNotif?.onEnd) {
      fireNotif(`onEnd_${subject.id}`, buildDurationOnEndMsg(subject.name));
    }
    // Always send postponed notification immediately (can't be pre-scheduled)
    if (tgEnabled && tgNotif?.onPostponed && incomplete.length > 0) {
      fireNotif(`onPostponed_${subject.id}`, buildPostponedMsg(subject.name, incomplete.map((l) => l.name)));
    }
    completeMutation.mutate({ id: subject.id });
    onActivate(null);
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={cn("relative rounded-3xl overflow-hidden", showOptions && "z-50")}
        style={
          isActive
            ? {
                background: "rgba(255,255,255,0.05)",
                border: "1px solid hsl(var(--primary) / 0.4)",
                boxShadow: "0 0 0 1px hsl(var(--primary) / 0.15), 0 8px 32px hsl(var(--primary) / 0.12)",
              }
            : {
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }
        }
      >
        {/* Active glow stripe */}
        {isActive && (
          <div
            className="absolute top-0 right-0 bottom-0 w-1 rounded-l-full"
            style={{ background: "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--accent)))" }}
          />
        )}

        <div className="p-5">
          {/* Card Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {isActive ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider"
                    style={{ background: "hsl(var(--primary) / 0.18)", color: "hsl(var(--primary))" }}
                  >
                    <Zap className="w-3 h-3" />
                    نشط
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-muted-foreground"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    {isToday ? "اليوم" : subject.date}
                  </span>
                )}

                {isFixedTime && subject.startTime && subject.endTime ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-muted-foreground"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <Clock className="w-3 h-3" />
                    {subject.startTime} – {subject.endTime}
                  </span>
                ) : !isFixedTime && subject.durationMinutes ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-muted-foreground"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <Timer className="w-3 h-3" />
                    {subject.durationMinutes >= 60
                      ? `${Math.floor(subject.durationMinutes / 60)}س${subject.durationMinutes % 60 > 0 ? ` ${subject.durationMinutes % 60}د` : ""}`
                      : `${subject.durationMinutes}د`}
                  </span>
                ) : null}
              </div>

              <h3 className="text-xl font-extrabold truncate leading-tight">{subject.name}</h3>

              {subject.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{subject.description}</p>
              )}
            </div>

            {/* Menu */}
            <div className="relative shrink-0 mr-1">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute left-0 top-full mt-1 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[130px]"
                    style={{ background: "hsl(240 12% 12%)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <button
                      onClick={() => { setShowOptions(false); setLocation(`/edit/${subject.id}`); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors border-b border-white/5"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                      تعديل
                    </button>
                    <button
                      onClick={() => { setShowOptions(false); setShowDeleteDialog(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-destructive hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Lessons progress bar (when not active) */}
          {!isActive && lessons.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {lessons.length} دروس
                </span>
                {completedLessons > 0 && (
                  <span className="text-[11px] text-muted-foreground">{completedLessons}/{lessons.length}</span>
                )}
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(to left, hsl(var(--accent)), hsl(var(--primary)))" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* ── Pending / Active ── */}
          <AnimatePresence mode="wait">
            {!isActive ? (
              <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {isFixedTime && isToday ? (
                  <div
                    className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {startMutation.isPending ? (
                      <p className="text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>جاري البدء تلقائياً...</p>
                    ) : minsUntilStart !== null && minsUntilStart > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Timer className="w-4 h-4" />
                          <span className="text-xs font-medium">يبدأ تلقائياً خلال</span>
                        </div>
                        <p className="text-2xl font-black" style={{ color: "hsl(var(--primary))" }}>
                          {fmtCountdown(minsUntilStart)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">عند الساعة {subject.startTime}</p>
                        {hasPreScheduled && (
                          <p className="text-[10px] mt-1 px-2 py-0.5 rounded-lg" style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}>
                            🗓 الإشعارات مجدولة على تيليجرام
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-bold animate-pulse" style={{ color: "hsl(var(--primary))" }}>
                        جاري البدء...
                      </p>
                    )}
                  </div>
                ) : isFixedTime && !isToday ? (
                  <div
                    className="w-full py-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-muted-foreground"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      يبدأ {subject.date} الساعة {subject.startTime}
                    </span>
                    {hasPreScheduled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: "hsl(var(--accent) / 0.1)", color: "hsl(var(--accent))" }}>
                        🗓 الإشعارات مجدولة على تيليجرام
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      startMutation.mutate({ id: subject.id });
                      onActivate(subject.name);
                      // Duration-mode: send onStart immediately
                      if (!isFixedTime && tgEnabled && tgNotif?.onStart) {
                        fireNotif(`onStart_${subject.id}`, buildDurationOnStartMsg(subject.name));
                      }
                    }}
                    disabled={startMutation.isPending}
                    className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                      boxShadow: "0 4px 16px hsl(var(--primary) / 0.35)",
                    }}
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {startMutation.isPending ? "جاري البدء..." : "ابدأ المذاكرة"}
                  </button>
                )}
              </motion.div>
            ) : (
              /* ── Active State ── */
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Timer */}
                <div
                  className="rounded-2xl p-4 flex flex-col items-center relative overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      className="h-full"
                      style={{
                        background: "linear-gradient(to left, hsl(var(--accent)), hsl(var(--primary)))",
                        width: `${simpleTimer.progress}%`,
                        transition: "width 1s linear",
                      }}
                    />
                  </div>
                  <div className={cn("text-5xl font-mono font-light tracking-wider mb-1", isDurationPaused ? "text-white/40" : "text-white")}>
                    {formatTimeMMSS(simpleTimer.secondsLeft)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {isDurationPaused ? "⏸ متوقف مؤقتاً" : "الوقت المتبقي"}
                  </p>
                </div>

                {/* Controls (duration mode) */}
                {!isFixedTime && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => isDurationPaused ? durationTimer.resume() : durationTimer.pause()}
                      className="flex-1 py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                      style={isDurationPaused
                        ? { background: "hsl(var(--primary) / 0.15)", border: "1px solid hsl(var(--primary) / 0.4)", color: "hsl(var(--primary))" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }
                      }
                    >
                      {isDurationPaused ? <><Play className="w-4 h-4" />استكمال</> : <><Pause className="w-4 h-4" />إيقاف مؤقت</>}
                    </button>
                    <button
                      onClick={() => { durationTimer.reset(); resetMutation.mutate({ id: subject.id }); onActivate(null); }}
                      disabled={resetMutation.isPending}
                      className="flex-1 py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                      style={{ background: "hsl(var(--destructive) / 0.12)", border: "1px solid hsl(var(--destructive) / 0.25)", color: "hsl(var(--destructive))" }}
                    >
                      <Square className="w-4 h-4" />
                      إيقاف تام
                    </button>
                  </div>
                )}

                {/* Lessons */}
                <div className="rounded-2xl p-3 space-y-1" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[11px] font-bold text-muted-foreground px-1 pb-1">الدروس</p>
                  {lessons.map((lesson, idx) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      lessonIndex={idx}
                      isCurrentLesson={hasDistributed && lessonTimer.currentLessonIndex === idx && !lesson.completed}
                      currentLessonSecondsLeft={lessonTimer.currentLessonSecondsLeft}
                      hasDistributed={hasDistributed}
                    />
                  ))}
                  {lessons.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">لم يتم إضافة دروس</p>
                  )}
                </div>

                {/* Complete button */}
                <button
                  onClick={handleComplete}
                  disabled={completeMutation.isPending}
                  className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                    boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)",
                  }}
                >
                  <Check className="w-5 h-5" />
                  {completeMutation.isPending ? "جاري الإنهاء..." : "إنهاء المادة"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ── Lesson row ─────────────────────────────────────────────────────────────────

function LessonRow({
  lesson, lessonIndex, isCurrentLesson, currentLessonSecondsLeft, hasDistributed
}: {
  lesson: Lesson;
  lessonIndex: number;
  isCurrentLesson: boolean;
  currentLessonSecondsLeft: number;
  hasDistributed: boolean;
}) {
  const toggleMutation = useStudyToggleLesson();

  return (
    <motion.button
      layout
      onClick={() => toggleMutation.mutate({ id: lesson.id })}
      disabled={toggleMutation.isPending}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-start",
        lesson.completed ? "opacity-50" : isCurrentLesson ? "bg-white/5" : "hover:bg-white/5",
        toggleMutation.isPending && "opacity-50 cursor-not-allowed"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
          lesson.completed ? "border-transparent" : isCurrentLesson ? "border-primary" : "border-white/25"
        )}
        style={lesson.completed ? { background: "hsl(var(--primary))" } : {}}
      >
        {lesson.completed && <Check className="w-3 h-3 text-white" />}
      </div>

      <span className={cn(
        "flex-1 text-sm text-right leading-tight",
        lesson.completed ? "line-through text-muted-foreground" : isCurrentLesson ? "font-bold text-white" : "font-medium"
      )}>
        {lesson.name}
      </span>

      {hasDistributed && lesson.allocatedMinutes ? (
        isCurrentLesson && !lesson.completed ? (
          <span
            className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0"
            style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
          >
            {formatTimeMMSS(currentLessonSecondsLeft)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">{lesson.allocatedMinutes}د</span>
        )
      ) : null}
    </motion.button>
  );
}

// ── Completed card ─────────────────────────────────────────────────────────────

function CompletedSubjectCard({ subject }: { subject: Subject }) {
  const deleteMutation = useStudyDeleteSubject();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [, setLocation] = useLocation();
  const lessons = subject.lessons || [];
  const completedCount = lessons.filter((l) => l.completed).length;

  const handleDelete = () => {
    deleteMutation.mutate({ id: subject.id }, {
      onSuccess: () => {
        cancelSubjectNotifications(subject.id);
      }
    });
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex items-center gap-3 p-3.5 rounded-2xl"
        style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16, 185, 129, 0.12)" }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{subject.name}</p>
          <p className="text-[11px] text-muted-foreground">{subject.date} · {completedCount}/{lessons.length} درس</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLocation(`/edit/${subject.id}`)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteMutation.isPending}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-destructive transition-colors"
            style={{ background: "hsl(var(--destructive) / 0.1)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
      />
    </>
  );
}
