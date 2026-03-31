import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import LZString from "lz-string";
import type { Subject } from "@/lib/storage";
import { getSubjects, saveSubjects, newId } from "@/lib/storage";

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

function parsePayload(json: string): Subject[] | null {
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

export function decodeScheduleParam(encoded: string): Subject[] | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (json) {
      const result = parsePayload(json);
      if (result) return result;
    }
  } catch {}

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
    const decoded = decodeScheduleParam(encoded);
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
