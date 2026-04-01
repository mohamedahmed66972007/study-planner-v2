import { useState, useEffect, useCallback } from "react";
import type { Lesson } from "@/lib/storage";

export interface LessonTimerState {
  currentLessonIndex: number;
  currentLessonSecondsLeft: number;
  currentLessonTotalSeconds: number;
  lessonFinished: boolean;
  overallSecondsLeft: number;
  overallProgress: number;
}

export function useTimer(subjectId: number, durationMinutes: number | undefined, isActive: boolean) {
  const START_KEY = `timer_start_${subjectId}`;
  const PAUSE_KEY = `timer_paused_elapsed_${subjectId}`;

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(() => localStorage.getItem(PAUSE_KEY) !== null);

  useEffect(() => {
    if (!isActive || !durationMinutes) {
      setSecondsLeft(0);
      setProgress(0);
      return;
    }

    const totalSeconds = durationMinutes * 60;

    if (isPaused) {
      const pausedElapsed = parseInt(localStorage.getItem(PAUSE_KEY) || "0", 10);
      const remaining = Math.max(0, totalSeconds - pausedElapsed);
      setSecondsLeft(remaining);
      setProgress(Math.min(100, (pausedElapsed / totalSeconds) * 100));
      return;
    }

    let startTime = parseInt(localStorage.getItem(START_KEY) || "0", 10);
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(START_KEY, startTime.toString());
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      setSecondsLeft(remaining);
      setProgress(Math.min(100, (elapsedSeconds / totalSeconds) * 100));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [subjectId, durationMinutes, isActive, isPaused]);

  const pause = useCallback(() => {
    if (!durationMinutes) return;
    const startTime = parseInt(localStorage.getItem(START_KEY) || "0", 10);
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    localStorage.setItem(PAUSE_KEY, elapsed.toString());
    setIsPaused(true);
  }, [subjectId, durationMinutes]);

  const resume = useCallback(() => {
    const pausedElapsed = localStorage.getItem(PAUSE_KEY);
    if (pausedElapsed !== null) {
      const elapsed = parseInt(pausedElapsed, 10);
      const newStartTime = Date.now() - elapsed * 1000;
      localStorage.setItem(START_KEY, newStartTime.toString());
      localStorage.removeItem(PAUSE_KEY);
    }
    setIsPaused(false);
  }, [subjectId]);

  const reset = useCallback(() => {
    localStorage.removeItem(START_KEY);
    localStorage.removeItem(PAUSE_KEY);
    setIsPaused(false);
    setSecondsLeft(0);
    setProgress(0);
  }, [subjectId]);

  return { secondsLeft, progress, isPaused, pause, resume, reset };
}

export function useLessonTimer(
  subjectId: number,
  lessons: Lesson[],
  totalDurationMinutes: number | undefined,
  isActive: boolean,
  isPaused: boolean
): LessonTimerState {
  const [state, setState] = useState<LessonTimerState>({
    currentLessonIndex: 0,
    currentLessonSecondsLeft: 0,
    currentLessonTotalSeconds: 0,
    lessonFinished: false,
    overallSecondsLeft: 0,
    overallProgress: 0,
  });

  const hasDistributedTime = lessons.some((l) => l.allocatedMinutes && l.allocatedMinutes > 0);

  useEffect(() => {
    if (!isActive || !totalDurationMinutes || isPaused) return;

    const storageKey = `timer_start_${subjectId}`;
    let startTime = parseInt(localStorage.getItem(storageKey) || "0", 10);
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(storageKey, startTime.toString());
    }

    const totalSeconds = totalDurationMinutes * 60;

    const lessonBoundaries: number[] = [];
    if (hasDistributedTime) {
      let cumulative = 0;
      for (const lesson of lessons) {
        cumulative += (lesson.allocatedMinutes || 0) * 60;
        lessonBoundaries.push(cumulative);
      }
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const overallRemaining = Math.max(0, totalSeconds - elapsedSeconds);
      const overallProgress = Math.min(100, (elapsedSeconds / totalSeconds) * 100);

      if (!hasDistributedTime || lessonBoundaries.length === 0) {
        setState({
          currentLessonIndex: 0,
          currentLessonSecondsLeft: overallRemaining,
          currentLessonTotalSeconds: totalSeconds,
          lessonFinished: false,
          overallSecondsLeft: overallRemaining,
          overallProgress,
        });
        return;
      }

      let lessonIndex = 0;
      for (let i = 0; i < lessonBoundaries.length; i++) {
        if (elapsedSeconds < lessonBoundaries[i]) {
          lessonIndex = i;
          break;
        }
        lessonIndex = Math.min(i + 1, lessons.length - 1);
      }

      const lessonStartSeconds = lessonIndex === 0 ? 0 : lessonBoundaries[lessonIndex - 1];
      const lessonEndSeconds = lessonBoundaries[lessonIndex] ?? totalSeconds;
      const lessonTotalSeconds = lessonEndSeconds - lessonStartSeconds;
      const elapsedInLesson = elapsedSeconds - lessonStartSeconds;
      const lessonRemaining = Math.max(0, lessonTotalSeconds - elapsedInLesson);
      const lessonFinished = lessonRemaining === 0 && lessonIndex < lessons.length - 1;

      setState({
        currentLessonIndex: lessonIndex,
        currentLessonSecondsLeft: lessonRemaining,
        currentLessonTotalSeconds: lessonTotalSeconds,
        lessonFinished,
        overallSecondsLeft: overallRemaining,
        overallProgress,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [subjectId, totalDurationMinutes, isActive, isPaused, hasDistributedTime, lessons]);

  return state;
}
