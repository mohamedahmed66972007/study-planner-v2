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

const TELEGRAM_KEY = "telegram_settings";

export const defaultNotificationSettings: TelegramNotificationSettings = {
  beforeStart: true,
  beforeStartMinutes: 5,
  onStart: true,
  beforeEnd: true,
  beforeEndMinutes: 5,
  onEnd: true,
  onPostponed: true,
};

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
