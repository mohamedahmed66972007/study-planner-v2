import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, X, BookOpen, Clock, Calendar, CheckCircle2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Subject } from "@/lib/storage";
import { getSubjects, saveSubjects, newId } from "@/lib/storage";

// ── Compression helpers (no external deps) ────────────────────────────────────

async function deflateEncode(data: string): Promise<string> {
  const input = new TextEncoder().encode(data);
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let len = 0;
  for (const c of chunks) len += c.length;
  const buf = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function deflateDecodeOrNull(encoded: string): Promise<string | null> {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "==".slice(0, (4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(buf);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let len = 0;
    for (const c of chunks) len += c.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

// ── Payload types ─────────────────────────────────────────────────────────────

type SchedulePayload = Array<{
  n: string;
  d: string;
  tm: "f" | "du";
  ds?: string;
  st?: string;
  et?: string;
  dm?: number;
  dt?: 1;
  l?: Array<{ n: string; am?: number }>;
}>;

// ── Encode ────────────────────────────────────────────────────────────────────

async function encodeSchedule(subjects: Subject[]): Promise<string> {
  const payload: SchedulePayload = subjects.map((s) => {
    const entry: SchedulePayload[number] = {
      n: s.name,
      d: s.date,
      tm: s.timeMode === "fixed" ? "f" : "du",
    };
    if (s.description) entry.ds = s.description;
    if (s.startTime) entry.st = s.startTime;
    if (s.endTime) entry.et = s.endTime;
    if (s.durationMinutes) entry.dm = s.durationMinutes;
    if (s.distributeTime) entry.dt = 1;
    if (s.lessons.length > 0) {
      entry.l = s.lessons.map((l) => {
        const lesson: { n: string; am?: number } = { n: l.name };
        if (l.allocatedMinutes) lesson.am = l.allocatedMinutes;
        return lesson;
      });
    }
    return entry;
  });
  return deflateEncode(JSON.stringify(payload));
}

// ── Decode ────────────────────────────────────────────────────────────────────

export function parseSchedulePayload(json: string): Subject[] | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return (parsed as SchedulePayload).map((s, si) => {
      const base = newId() + si * 1000;
      return {
        id: base,
        name: s.n ?? "",
        date: s.d ?? "",
        description: s.ds ?? null,
        timeMode: s.tm === "f" ? ("fixed" as const) : ("duration" as const),
        startTime: s.st ?? null,
        endTime: s.et ?? null,
        durationMinutes: s.dm ?? null,
        distributeTime: s.dt === 1,
        status: "pending" as const,
        lessons: (s.l ?? []).map((l, li) => ({
          id: base + li + 1,
          name: l.n ?? "",
          completed: false,
          allocatedMinutes: l.am ?? null,
        })),
      };
    });
  } catch {
    return null;
  }
}

export async function decodeSchedule(encoded: string): Promise<Subject[] | null> {
  // 1) Try new deflate-raw format
  const deflated = await deflateDecodeOrNull(encoded);
  if (deflated) {
    const result = parseSchedulePayload(deflated);
    if (result && result.length > 0) return result;
  }

  // 2) Fallback: plain base64 JSON (original format before compression)
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as Array<{
      name: string; date: string;
      description?: string | null;
      timeMode: "fixed" | "duration";
      startTime?: string | null; endTime?: string | null;
      durationMinutes?: number | null;
      distributeTime: boolean;
      lessons: Array<{ name: string; allocatedMinutes?: number | null }>;
    }>;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((s, si) => {
      const base = newId() + si * 1000;
      return {
        id: base, name: s.name ?? "", date: s.date ?? "",
        description: s.description ?? null,
        timeMode: s.timeMode === "fixed" ? "fixed" : "duration",
        startTime: s.startTime ?? null, endTime: s.endTime ?? null,
        durationMinutes: s.durationMinutes ?? null,
        distributeTime: !!s.distributeTime,
        status: "pending" as const,
        lessons: (s.lessons ?? []).map((l, li) => ({
          id: base + li + 1, name: l.name ?? "", completed: false,
          allocatedMinutes: l.allocatedMinutes ?? null,
        })),
      };
    });
  } catch {
    return null;
  }
}

async function buildShareUrl(subjects: Subject[]): Promise<string> {
  const encoded = await encodeSchedule(subjects);
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
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setError("");
    setLoading(true);
    try {
      let encoded = url.trim();
      try {
        const urlObj = new URL(encoded);
        const param = urlObj.searchParams.get("import");
        if (param) encoded = param;
      } catch {
        const match = encoded.match(/[?&]import=([^&]+)/);
        if (match) encoded = match[1];
      }
      const decoded = await decodeSchedule(encoded);
      if (!decoded || decoded.length === 0) {
        setError("الرابط غير صالح أو لا يحتوي على بيانات");
        return;
      }
      onDecoded(decoded);
    } finally {
      setLoading(false);
    }
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
            disabled={!url.trim() || loading}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            {loading ? "جاري التحقق..." : "استيراد"}
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

// ── Share + Import buttons ─────────────────────────────────────────────────────

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
    const url = await buildShareUrl(subjects);
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
      saveSubjects([...getSubjects(), ...previewSubjects]);
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
