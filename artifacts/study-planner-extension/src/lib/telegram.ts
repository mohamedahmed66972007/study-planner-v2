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

// Tracks scheduled message IDs per subject so we can cancel them later
export interface ScheduledNotifRecord {
  subjectId: number;
  messageId: number;
  type: string; // "beforeStart" | "onStart" | "beforeEnd" | "onEnd"
  scheduledAt: number; // Unix seconds
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const TELEGRAM_KEY = "telegram_settings";
const SCHEDULED_KEY = "telegram_scheduled_notifs";

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

// ── Scheduled notifications storage ───────────────────────────────────────────

export function getScheduledNotifs(): ScheduledNotifRecord[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_KEY);
    return raw ? (JSON.parse(raw) as ScheduledNotifRecord[]) : [];
  } catch {
    return [];
  }
}

function saveScheduledNotifs(records: ScheduledNotifRecord[]): void {
  localStorage.setItem(SCHEDULED_KEY, JSON.stringify(records));
}

// ── Telegram API helpers ───────────────────────────────────────────────────────

/**
 * Send a message immediately via Telegram Bot API.
 */
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

/**
 * Schedule a Telegram message at a specific Unix timestamp (seconds).
 * Returns the message_id if successful, or null on failure.
 * Requires: scheduleDate must be at least 10 seconds in the future.
 */
export async function scheduleTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  scheduleDate: number  // Unix timestamp in seconds
): Promise<number | null> {
  const now = Math.floor(Date.now() / 1000);
  // Telegram requires at least 10 seconds in the future
  if (scheduleDate <= now + 10) return null;
  // At most 366 days in the future
  if (scheduleDate > now + 366 * 24 * 3600) return null;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          schedule_date: scheduleDate,
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.message_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete (cancel) a previously scheduled Telegram message.
 */
export async function deleteTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function toUnixTimestamp(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return Math.floor(new Date(y, m - 1, d, h, min, 0, 0).getTime() / 1000);
}

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

export interface SubjectForScheduling {
  id: number;
  name: string;
  date: string;
  timeMode: "fixed" | "duration";
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * Schedule all Telegram notifications for a subject with a fixed time.
 * Replaces any previously scheduled notifications for this subject.
 * Returns the number of successfully scheduled messages.
 */
export async function scheduleSubjectNotifications(
  subject: SubjectForScheduling,
  settings: TelegramSettings
): Promise<{ scheduled: number; skipped: number }> {
  // Only fixed-time subjects can be scheduled in advance
  if (subject.timeMode !== "fixed" || !subject.startTime) {
    return { scheduled: 0, skipped: 0 };
  }

  // First cancel any existing scheduled notifications for this subject
  await cancelSubjectNotifications(subject.id, settings.botToken, settings.chatId);

  const n = settings.notifications;
  const { botToken, chatId } = settings;
  const startTs = toUnixTimestamp(subject.date, subject.startTime);
  const endTs = subject.endTime ? toUnixTimestamp(subject.date, subject.endTime) : null;
  const now = Math.floor(Date.now() / 1000);

  const tasks: Array<{ type: string; ts: number; text: string }> = [];

  if (n.beforeStart) {
    tasks.push({
      type: "beforeStart",
      ts: startTs - n.beforeStartMinutes * 60,
      text: buildBeforeStartMsg(subject.name, n.beforeStartMinutes, subject.startTime),
    });
  }
  if (n.onStart) {
    tasks.push({
      type: "onStart",
      ts: startTs,
      text: buildOnStartMsg(subject.name, subject.endTime),
    });
  }
  if (n.beforeEnd && endTs) {
    tasks.push({
      type: "beforeEnd",
      ts: endTs - n.beforeEndMinutes * 60,
      text: buildBeforeEndMsg(subject.name, n.beforeEndMinutes),
    });
  }
  if (n.onEnd && endTs) {
    tasks.push({
      type: "onEnd",
      ts: endTs,
      text: buildOnEndMsg(subject.name),
    });
  }

  let scheduled = 0;
  let skipped = 0;
  const newRecords: ScheduledNotifRecord[] = [];

  for (const task of tasks) {
    // Skip if in the past or within 10 seconds
    if (task.ts <= now + 10) {
      skipped++;
      continue;
    }
    const msgId = await scheduleTelegramMessage(botToken, chatId, task.text, task.ts);
    if (msgId !== null) {
      newRecords.push({ subjectId: subject.id, messageId: msgId, type: task.type, scheduledAt: task.ts });
      scheduled++;
    } else {
      skipped++;
    }
  }

  // Persist the new records
  const existing = getScheduledNotifs().filter((r) => r.subjectId !== subject.id);
  saveScheduledNotifs([...existing, ...newRecords]);

  return { scheduled, skipped };
}

/**
 * Cancel all scheduled Telegram notifications for a subject.
 * Pass botToken/chatId if you want to also delete them from Telegram servers.
 */
export async function cancelSubjectNotifications(
  subjectId: number,
  botToken?: string,
  chatId?: string
): Promise<void> {
  const all = getScheduledNotifs();
  const toCancel = all.filter((r) => r.subjectId === subjectId);
  const remaining = all.filter((r) => r.subjectId !== subjectId);

  // Try to delete from Telegram if credentials are provided
  if (botToken && chatId && toCancel.length > 0) {
    await Promise.allSettled(
      toCancel.map((r) => deleteTelegramMessage(botToken, chatId, r.messageId))
    );
  }

  saveScheduledNotifs(remaining);
}

/**
 * Send an immediate Telegram notification for postponed lessons.
 */
export function buildPostponedMsg(subjectName: string, lessonNames: string[]) {
  const lines = [
    `📋 <b>دروس مؤجلة — ${subjectName}</b>`,
    tgSep(),
    `تم تأجيل <b>${lessonNames.length} ${lessonNames.length === 1 ? "درس" : "دروس"}</b> من اليوم:`,
    ...lessonNames.map((n) => `• ${n}`),
    tgSep(),
    `<i>اجعل لها موعداً قريباً ⭐</i>`,
  ];
  return lines.join("\n");
}
