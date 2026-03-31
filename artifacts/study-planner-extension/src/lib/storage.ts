// ── Types ─────────────────────────────────────────────────────────────────────

export interface Lesson {
  id: number;
  name: string;
  completed: boolean;
  allocatedMinutes?: number | null;
}

export interface Subject {
  id: number;
  name: string;
  date: string;
  description?: string | null;
  timeMode: "fixed" | "duration";
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  distributeTime: boolean;
  status: "pending" | "active" | "completed";
  lessons: Lesson[];
}

export interface PostponedLesson {
  id: number;
  lessonName: string;
  subjectName: string;
  originalDate: string;
}

// ── Keys ──────────────────────────────────────────────────────────────────────

const SUBJECTS_KEY = "study_subjects";
const POSTPONED_KEY = "study_postponed";

// ── Subjects ──────────────────────────────────────────────────────────────────

export function getSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    return raw ? (JSON.parse(raw) as Subject[]) : [];
  } catch {
    return [];
  }
}

export function saveSubjects(subjects: Subject[]): void {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
}

// ── Postponed ─────────────────────────────────────────────────────────────────

export function getPostponed(): PostponedLesson[] {
  try {
    const raw = localStorage.getItem(POSTPONED_KEY);
    return raw ? (JSON.parse(raw) as PostponedLesson[]) : [];
  } catch {
    return [];
  }
}

export function savePostponed(lessons: PostponedLesson[]): void {
  localStorage.setItem(POSTPONED_KEY, JSON.stringify(lessons));
}

// ── ID generator ──────────────────────────────────────────────────────────────

export function newId(): number {
  return Date.now() + Math.floor(Math.random() * 10000);
}
