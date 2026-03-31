import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Subject } from "@/lib/storage";
import { getSubjects, saveSubjects } from "@/lib/storage";
import { decodeSchedule } from "@/components/share-import-dialog";

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

    let cancelled = false;
    decodeSchedule(encoded).then((decoded) => {
      if (cancelled) return;
      if (decoded && decoded.length > 0) setPreviewSubjects(decoded);
    });
    return () => { cancelled = true; };
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
      saveSubjects([...getSubjects(), ...previewSubjects]);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      clearPreview();
    } finally {
      setSaving(false);
    }
  };

  return { previewSubjects, clearPreview, saveImported, saving };
}
