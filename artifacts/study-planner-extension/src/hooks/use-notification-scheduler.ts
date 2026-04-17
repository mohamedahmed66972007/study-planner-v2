import { useEffect, useRef } from "react";
import {
  getPendingNotifs,
  markNotifsSent,
  sendTelegramMessage,
  type TelegramSettings,
} from "@/lib/telegram";

/**
 * Runs in the background while the app is open.
 * Every 20 seconds it checks if any locally-scheduled notifications are due
 * and sends them via Telegram immediately.
 */
export function useNotificationScheduler(settings: TelegramSettings | null) {
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    if (!settings?.botToken || !settings?.chatId) return;

    async function checkAndSend() {
      const s = settingsRef.current;
      if (!s?.botToken || !s?.chatId) return;

      const pending = getPendingNotifs();
      const now = Date.now();
      const due = pending.filter((n) => n.scheduledAt <= now);
      if (due.length === 0) return;

      // Send all due notifications
      const sent: string[] = [];
      for (const notif of due) {
        const ok = await sendTelegramMessage(s.botToken, s.chatId, notif.text);
        if (ok) sent.push(notif.id);
      }

      // Remove the ones we successfully sent
      if (sent.length > 0) markNotifsSent(sent);
    }

    // Check immediately on mount
    checkAndSend();

    // Then check every 20 seconds
    const interval = setInterval(checkAndSend, 20_000);
    return () => clearInterval(interval);
  }, [settings?.botToken, settings?.chatId]);
}
