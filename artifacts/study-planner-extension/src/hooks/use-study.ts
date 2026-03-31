import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubjects,
  saveSubjects,
  getPostponed,
  savePostponed,
  newId,
} from "@/lib/storage";
import type { Subject } from "@/lib/storage";

const SUBJECTS_QK = ["subjects"] as const;
const POSTPONED_QK = ["postponed"] as const;

// ── Read hooks ────────────────────────────────────────────────────────────────

export function useStudySubjects() {
  return useQuery({ queryKey: SUBJECTS_QK, queryFn: getSubjects });
}

export function useStudySubject(id: number | undefined) {
  return useQuery({
    queryKey: [...SUBJECTS_QK, id],
    queryFn: () => getSubjects().find((s) => s.id === id) ?? null,
    enabled: !!id,
  });
}

export function useStudyPostponed() {
  return useQuery({ queryKey: POSTPONED_QK, queryFn: getPostponed });
}

// ── Mutation types ────────────────────────────────────────────────────────────

type SubjectPayload = {
  name: string;
  date: string;
  timeMode: "fixed" | "duration";
  description?: string | null;
  distributeTime: boolean;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  lessons: { name: string; allocatedMinutes?: number | null }[];
};

// ── Write hooks ───────────────────────────────────────────────────────────────

export function useStudyCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: SubjectPayload }) => {
      const subjects = getSubjects();
      const base = newId();
      const subject: Subject = {
        id: base,
        name: data.name,
        date: data.date,
        description: data.description ?? null,
        timeMode: data.timeMode,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: data.durationMinutes ?? null,
        distributeTime: data.distributeTime,
        status: "pending",
        lessons: data.lessons.map((l, i) => ({
          id: base + i + 1,
          name: l.name,
          completed: false,
          allocatedMinutes: l.allocatedMinutes ?? null,
        })),
      };
      saveSubjects([...subjects, subject]);
      return subject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBJECTS_QK }),
  });
}

export function useStudyUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SubjectPayload }) => {
      const base = newId();
      const subjects = getSubjects().map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          name: data.name,
          date: data.date,
          description: data.description ?? null,
          timeMode: data.timeMode,
          startTime: data.startTime ?? null,
          endTime: data.endTime ?? null,
          durationMinutes: data.durationMinutes ?? null,
          distributeTime: data.distributeTime,
          lessons: data.lessons.map((l, i) => ({
            id: base + i + 1,
            name: l.name,
            completed: false,
            allocatedMinutes: l.allocatedMinutes ?? null,
          })),
        };
      });
      saveSubjects(subjects);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBJECTS_QK }),
  });
}

export function useStudyDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      saveSubjects(getSubjects().filter((s) => s.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBJECTS_QK }),
  });
}

export function useStudyStartSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      saveSubjects(
        getSubjects().map((s) => ({
          ...s,
          status:
            s.id === id
              ? "active"
              : s.status === "active"
              ? "pending"
              : s.status,
        }))
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBJECTS_QK }),
  });
}

export function useStudyCompleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const subjects = getSubjects();
      const subject = subjects.find((s) => s.id === id);
      if (subject) {
        const incomplete = subject.lessons.filter((l) => !l.completed);
        if (incomplete.length > 0) {
          const base = newId();
          const newPostponed = incomplete.map((l, i) => ({
            id: base + i,
            lessonName: l.name,
            subjectName: subject.name,
            originalDate: subject.date,
          }));
          savePostponed([...getPostponed(), ...newPostponed]);
        }
      }
      saveSubjects(
        subjects.map((s) => (s.id === id ? { ...s, status: "completed" } : s))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBJECTS_QK });
      qc.invalidateQueries({ queryKey: POSTPONED_QK });
    },
  });
}

export function useStudyToggleLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      saveSubjects(
        getSubjects().map((s) => ({
          ...s,
          lessons: s.lessons.map((l) =>
            l.id === id ? { ...l, completed: !l.completed } : l
          ),
        }))
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUBJECTS_QK }),
  });
}

export function useStudyDeletePostponed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      savePostponed(getPostponed().filter((p) => p.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTPONED_QK }),
  });
}

export function useStudyDeletePostponedGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: { ids: number[] }) => {
      savePostponed(getPostponed().filter((p) => !ids.includes(p.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTPONED_QK }),
  });
}

export function useStudyReschedulePostponed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      subjectName,
      date,
      timeMode,
      startTime,
      endTime,
      durationMinutes: durationMins,
    }: {
      ids: number[];
      subjectName: string;
      date: string;
      timeMode: "fixed" | "duration";
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
    }) => {
      const postponed = getPostponed();
      const toReschedule = postponed.filter((p) => ids.includes(p.id));
      const remaining = postponed.filter((p) => !ids.includes(p.id));

      const base = newId();
      const newSubject: Subject = {
        id: base,
        name: subjectName,
        date,
        description: null,
        timeMode,
        startTime: startTime || null,
        endTime: endTime || null,
        durationMinutes: timeMode === "duration" ? (durationMins ?? 60) : null,
        distributeTime: false,
        status: "pending",
        lessons: toReschedule.map((l, i) => ({
          id: base + i + 1,
          name: l.lessonName,
          completed: false,
          allocatedMinutes: null,
        })),
      };

      saveSubjects([...getSubjects(), newSubject]);
      savePostponed(remaining);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBJECTS_QK });
      qc.invalidateQueries({ queryKey: POSTPONED_QK });
    },
  });
}
