import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, X, BookOpen, Clock, Calendar, CheckCircle2, Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Subject } from "@/lib/storage";
import { getSubjects, saveSubjects, newId } from "@/lib/storage";

// ── Encoding helpers ───────────────────────────────────────────────────────────

function encodeSchedule(subjects: Subject[]): string {
  const stripped = subjects.map((s) => ({
    name: s.name,
    date: s.date,
    description: s.description,
    timeMode: s.timeMode,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    distributeTime: s.distributeTime,
    lessons: s.lessons.map((l) => ({
      name: l.name,
      allocatedMinutes: l.allocatedMinutes,
    })),
  }));
  const json = JSON.stringify(stripped);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeSchedule(encoded: string): Subject[] | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as Array<{
      name: string;
      date: string;
      description?: string | null;
      timeMode: "fixed" | "duration";
      startTime?: string | null;
      endTime?: string | null;
      durationMinutes?: number | null;
      distributeTime: boolean;
      lessons: Array<{ name: string; allocatedMinutes?: number | null }>;
    }>;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((s, si) => {
      const base = newId() + si * 1000;
      return {
        id: base,
        name: s.name ?? "",
        date: s.date ?? "",
        description: s.description ?? null,
        timeMode: s.timeMode === "fixed" ? "fixed" : "duration",
        startTime: s.startTime ?? null,
        endTime: s.endTime ?? null,
        durationMinutes: s.durationMinutes ?? null,
        distributeTime: !!s.distributeTime,
        status: "pending" as const,
        lessons: (s.lessons ?? []).map((l, li) => ({
          id: base + li + 1,
          name: l.name ?? "",
          completed: false,
          allocatedMinutes: l.allocatedMinutes ?? null,
        })),
      };
    });
  } catch {
    return null;
  }
}

function buildShareUrl(subjects: Subject[]): string {
  const encoded = encodeSchedule(subjects);
  const base = window.location.origin + window.location.pathname;
  return `${base}?import=${encoded}`;
}

// ── Subject preview card ───────────────────────────────────────────────────────

function SubjectPreviewCard({ subject }: { subject: Subject }) {
  const isFixed = subject.timeMode === "fixed";
  let dateLabel = subject.date;
  try {
    dateLabel = format(new Date(subject.date), "EEEE، d MMMM yyyy", { locale: ar });
  } catch {}

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-2 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-base">{subject.name}</h4>
        {isFixed && subject.startTime && subject.endTime ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0 font-medium">
            <Clock className="w-3 h-3" />
            {subject.startTime} - {subject.endTime}
          </span>
        ) : subject.durationMinutes ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0 font-medium">
            <Clock className="w-3 h-3" />
            {subject.durationMinutes >= 60
              ? `${Math.floor(subject.durationMinutes / 60)}س ${subject.durationMinutes % 60 > 0 ? `${subject.durationMinutes % 60}د` : ""}`
              : `${subject.durationMinutes} د`}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="w-3.5 h-3.5" />
        <span>{dateLabel}</span>
      </div>

      {subject.description && (
        <p className="text-xs text-muted-foreground">{subject.description}</p>
      )}

      {subject.lessons.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{subject.lessons.length} {subject.lessons.length === 1 ? "درس" : "دروس"}</span>
          <span className="text-white/30">·</span>
          <span className="truncate">{subject.lessons.map((l) => l.name).join("، ")}</span>
        </div>
      )}
    </div>
  );
}

// ── Import preview modal ───────────────────────────────────────────────────────

interface ImportPreviewProps {
  subjects: Subject[];
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ImportPreviewModal({ subjects, onSave, onCancel, saving }: ImportPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="relative w-full max-w-[420px] glass-panel rounded-3xl p-5 shadow-2xl border border-white/10 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-lg font-extrabold">استيراد الجدول</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subjects.length} {subjects.length === 1 ? "مادة" : "مواد"} سيتم استيرادها
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-4">
          {subjects.map((s, i) => (
            <SubjectPreviewCard key={i} subject={s} />
          ))}
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-bold text-muted-foreground hover:text-white transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ الجدول"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Import dialog (paste URL) ──────────────────────────────────────────────────

interface ImportDialogProps {
  onClose: () => void;
  onDecoded: (subjects: Subject[]) => void;
}

function ImportDialog({ onClose, onDecoded }: ImportDialogProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleImport = () => {
    setError("");
    let encoded = url.trim();
    try {
      const urlObj = new URL(encoded);
      const param = urlObj.searchParams.get("import");
      if (param) encoded = param;
    } catch {
      const match = encoded.match(/[?&]import=([^&]+)/);
      if (match) encoded = match[1];
    }
    const decoded = decodeSchedule(encoded);
    if (!decoded || decoded.length === 0) {
      setError("الرابط غير صالح أو لا يحتوي على بيانات");
      return;
    }
    onDecoded(decoded);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="relative w-full max-w-[420px] glass-panel rounded-3xl p-5 shadow-2xl border border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold">استيراد جدول</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          الصق رابط الجدول المشارك معك هنا
        </p>

        <textarea
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="الصق الرابط هنا..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none font-mono text-xs leading-relaxed"
          dir="ltr"
        />

        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-bold text-muted-foreground hover:text-white transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleImport}
            disabled={!url.trim()}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            استيراد
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Share success toast ────────────────────────────────────────────────────────

function ShareToast({ onHide }: { onHide: () => void }) {
  useEffect(() => {
    const t = setTimeout(onHide, 2500);
    return () => clearTimeout(t);
  }, [onHide]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[300] bg-green-600/90 backdrop-blur-sm text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap"
    >
      <Check className="w-4 h-4" />
      تم نسخ الرابط!
    </motion.div>
  );
}

// ── Main exported hook + buttons ──────────────────────────────────────────────

interface ShareImportProps {
  subjects: Subject[];
}

export function ShareImportButtons({ subjects }: ShareImportProps) {
  const qc = useQueryClient();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [previewSubjects, setPreviewSubjects] = useState<Subject[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleShare = async () => {
    if (subjects.length === 0) return;
    const url = buildShareUrl(subjects);

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: "مخططي الدراسي - مشاركة الجدول",
          text: "شاركت معك جدولي الدراسي، اضغط على الرابط لعرضه وحفظه:",
          url,
        });
      } catch {
        await navigator.clipboard.writeText(url).catch(() => {});
        setShowToast(true);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setShowToast(true);
    }
  };

  const handleSave = () => {
    if (!previewSubjects) return;
    setSaving(true);
    try {
      const current = getSubjects();
      saveSubjects([...current, ...previewSubjects]);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setPreviewSubjects(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("import");
      window.history.replaceState({}, "", url.toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-muted-foreground hover:text-white transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          استيراد
        </button>
        <button
          onClick={handleShare}
          disabled={subjects.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-xs font-bold text-primary transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Share2 className="w-3.5 h-3.5" />
          مشاركة
        </button>
      </div>

      <AnimatePresence>
        {showImportDialog && (
          <ImportDialog
            onClose={() => setShowImportDialog(false)}
            onDecoded={(decoded) => {
              setShowImportDialog(false);
              setPreviewSubjects(decoded);
            }}
          />
        )}

        {previewSubjects && (
          <ImportPreviewModal
            subjects={previewSubjects}
            onSave={handleSave}
            onCancel={() => {
              setPreviewSubjects(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("import");
              window.history.replaceState({}, "", url.toString());
            }}
            saving={saving}
          />
        )}

        {showToast && <ShareToast onHide={() => setShowToast(false)} />}
      </AnimatePresence>
    </>
  );
}

// ── URL auto-detect hook ───────────────────────────────────────────────────────

export function useImportFromUrl(): {
  previewSubjects: Subject[] | null;
  clearPreview: () => void;
  saveImported: () => void;
  saving: boolean;
} {
  const qc = useQueryClient();
  const [previewSubjects, setPreviewSubjects] = useState<Subject[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("import");
    if (!encoded) return;
    const decoded = decodeSchedule(encoded);
    if (decoded && decoded.length > 0) {
      setPreviewSubjects(decoded);
    }
  }, []);

  const clearPreview = () => {
    setPreviewSubjects(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("import");
    window.history.replaceState({}, "", url.toString());
  };

  const saveImported = () => {
    if (!previewSubjects) return;
    setSaving(true);
    try {
      const current = getSubjects();
      saveSubjects([...current, ...previewSubjects]);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      clearPreview();
    } finally {
      setSaving(false);
    }
  };

  return { previewSubjects, clearPreview, saveImported, saving };
}
