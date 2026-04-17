// ── Types ──────────────────────────────────────────────────────────────────────

export interface TelegramNotificationSettings {
  beforeStart: boolean;
  beforeStartMinutes: number;
  onStart: boolean;
  beforeEnd: boolean;
  beforeEndMinutes: number;
  onEnd: boolean;
  onPostponed: boolean;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  notifications: TelegramNotificationSettings;
}

/** A locally-scheduled pending notification (stored in localStorage) */
export interface PendingNotif {
  id: string;             // unique key: `${subjectId}_${type}`
  subjectId: number;
  type: "beforeStart" | "onStart" | "beforeEnd" | "onEnd";
  scheduledAt: number;    // Unix ms
  text: string;
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const TELEGRAM_KEY = "telegram_settings";
const PENDING_KEY  = "telegram_pending_notifs";

// ── Default settings ───────────────────────────────────────────────────────────

export const defaultNotificationSettings: TelegramNotificationSettings = {
  beforeStart: true,
  beforeStartMinutes: 5,
  onStart: true,
  beforeEnd: true,
  beforeEndMinutes: 5,
  onEnd: true,
  onPostponed: true,
};

// ── Settings CRUD ──────────────────────────────────────────────────────────────

export function getTelegramSettings(): TelegramSettings | null {
  try {
    const raw = localStorage.getItem(TELEGRAM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TelegramSettings;
    parsed.notifications = { ...defaultNotificationSettings, ...parsed.notifications };
    return parsed;
  } catch {
    return null;
  }
}

export function saveTelegramSettings(settings: TelegramSettings): void {
  localStorage.setItem(TELEGRAM_KEY, JSON.stringify(settings));
}

export function clearTelegramSettings(): void {
  localStorage.removeItem(TELEGRAM_KEY);
}

// ── Pending notifications storage ──────────────────────────────────────────────

export function getPendingNotifs(): PendingNotif[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingNotif[]) : [];
  } catch {
    return [];
  }
}

function savePendingNotifs(items: PendingNotif[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

/** Remove all pending notifications for a given subject */
export function cancelSubjectNotifications(subjectId: number): void {
  const filtered = getPendingNotifs().filter((n) => n.subjectId !== subjectId);
  savePendingNotifs(filtered);
}

/** Mark a set of notifications as sent (remove them) */
export function markNotifsSent(ids: string[]): void {
  const filtered = getPendingNotifs().filter((n) => !ids.includes(n.id));
  savePendingNotifs(filtered);
}

// ── Telegram API ───────────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Message builders ───────────────────────────────────────────────────────────

function tgSep() { return "━━━━━━━━━━━━━━━━━━"; }

function buildBeforeStartMsg(subjectName: string, mins: number, startTime: string) {
  return [
    `🔔 <b>تذكير — مادة قادمة</b>`,
    tgSep(),
    `📚 <b>${subjectName}</b>`,
    `⏱ تبدأ خلال <b>${mins} دقيقة</b>`,
    `🕐 في الساعة <b>${startTime}</b>`,
    tgSep(),
    `<i>استعد للمذاكرة! 💪</i>`,
  ].join("\n");
}

function buildOnStartMsg(subjectName: string, endTime?: string | null) {
  const lines = [
    `📚 <b>بدأت المادة الآن!</b>`,
    tgSep(),
    `📖 <b>${subjectName}</b>`,
  ];
  if (endTime) lines.push(`🕑 وقت الانتهاء: <b>${endTime}</b>`);
  lines.push(tgSep(), `<i>ركّز وأنت قادر! 🌟</i>`);
  return lines.join("\n");
}

function buildBeforeEndMsg(subjectName: string, mins: number) {
  return [
    `⏳ <b>قارب الوقت على الانتهاء!</b>`,
    tgSep(),
    `📖 <b>${subjectName}</b>`,
    `⏱ تبقّى <b>${mins} دقيقة</b> فقط`,
    tgSep(),
    `<i>أكمل ما بدأت! 🎯</i>`,
  ].join("\n");
}

function buildOnEndMsg(subjectName: string) {
  return [
    `✅ <b>انتهت المادة!</b>`,
    tgSep(),
    `🎉 أتممت مذاكرة <b>${subjectName}</b> بنجاح`,
    tgSep(),
    `<i>عمل رائع، واصل التقدم! ⭐</i>`,
  ].join("\n");
}

export function buildPostponedMsg(subjectName: string, lessonNames: string[]) {
  const count = lessonNames.length;
  return [
    `📋 <b>دروس مؤجلة — ${subjectName}</b>`,
    tgSep(),
    `تم تأجيل <b>${count} ${count === 1 ? "درس" : "دروس"}</b> من اليوم:`,
    ...lessonNames.map((n) => `• ${n}`),
    tgSep(),
    `<i>اجعل لها موعداً قريباً ⭐</i>`,
  ].join("\n");
}

// ── Scheduling ─────────────────────────────────────────────────────────────────

export interface SubjectForScheduling {
  id: number;
  name: string;
  date: string;
  timeMode: "fixed" | "duration";
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * Store locally-scheduled notifications for a fixed-time subject.
 * These are checked by useNotificationScheduler and sent at the right time.
 * Returns the number of notifications that were queued (future only).
 */
export function scheduleSubjectNotifications(
  subject: SubjectForScheduling,
  settings: TelegramSettings
): number {
  if (subject.timeMode !== "fixed" || !subject.startTime) return 0;

  // Remove any old notifications for this subject first
  cancelSubjectNotifications(subject.id);

  const n = settings.notifications;
  const [sy, sm, sd] = subject.date.split("-").map(Number);
  const [sh, smin] = subject.startTime.split(":").map(Number);
  const startMs = new Date(sy, sm - 1, sd, sh, smin, 0, 0).getTime();

  let endMs: number | null = null;
  if (subject.endTime) {
    const [eh, emin] = subject.endTime.split(":").map(Number);
    endMs = new Date(sy, sm - 1, sd, eh, emin, 0, 0).getTime();
  }

  const now = Date.now();
  const tasks: PendingNotif[] = [];

  if (n.beforeStart) {
    const ts = startMs - n.beforeStartMinutes * 60 * 1000;
    if (ts > now) {
      tasks.push({
        id: `${subject.id}_beforeStart`,
        subjectId: subject.id,
        type: "beforeStart",
        scheduledAt: ts,
        text: buildBeforeStartMsg(subject.name, n.beforeStartMinutes, subject.startTime),
      });
    }
  }
  if (n.onStart) {
    if (startMs > now) {
      tasks.push({
        id: `${subject.id}_onStart`,
        subjectId: subject.id,
        type: "onStart",
        scheduledAt: startMs,
        text: buildOnStartMsg(subject.name, subject.endTime),
      });
    }
  }
  if (n.beforeEnd && endMs !== null) {
    const ts = endMs - n.beforeEndMinutes * 60 * 1000;
    if (ts > now) {
      tasks.push({
        id: `${subject.id}_beforeEnd`,
        subjectId: subject.id,
        type: "beforeEnd",
        scheduledAt: ts,
        text: buildBeforeEndMsg(subject.name, n.beforeEndMinutes),
      });
    }
  }
  if (n.onEnd && endMs !== null) {
    if (endMs > now) {
      tasks.push({
        id: `${subject.id}_onEnd`,
        subjectId: subject.id,
        type: "onEnd",
        scheduledAt: endMs,
        text: buildOnEndMsg(subject.name),
      });
    }
  }

  const existing = getPendingNotifs().filter((r) => r.subjectId !== subject.id);
  savePendingNotifs([...existing, ...tasks]);

  return tasks.length;
}

/** Check how many locally-scheduled notifs exist for a subject */
export function getSubjectScheduledCount(subjectId: number): number {
  return getPendingNotifs().filter((n) => n.subjectId === subjectId).length;
}
