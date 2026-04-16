import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Settings,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  getTelegramSettings,
  saveTelegramSettings,
  clearTelegramSettings,
  sendTelegramMessage,
  defaultNotificationSettings,
  type TelegramSettings,
  type TelegramNotificationSettings,
} from "@/lib/telegram";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "token" | "chatid" | "success";

function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold text-lg transition-colors"
      >
        -
      </button>
      <span className="w-8 text-center text-sm font-bold text-white">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold text-lg transition-colors"
      >
        +
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0 ${
        checked ? "bg-primary" : "bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
          checked ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function TelegramSetupDialog({ open, onClose }: Props) {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [step, setStep] = useState<Step>("token");
  const [tokenInput, setTokenInput] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [chatIdError, setChatIdError] = useState("");
  const [testing, setTesting] = useState(false);
  const [showReconfigure, setShowReconfigure] = useState(false);

  useEffect(() => {
    if (open) {
      const s = getTelegramSettings();
      setSettings(s);
      setStep("token");
      setTokenInput("");
      setChatIdInput("");
      setTokenError("");
      setChatIdError("");
      setShowReconfigure(false);
    }
  }, [open]);

  const isConfigured = !!(settings?.botToken && settings?.chatId) && !showReconfigure;

  function updateNotif(partial: Partial<TelegramNotificationSettings>) {
    if (!settings) return;
    const updated: TelegramSettings = {
      ...settings,
      notifications: { ...settings.notifications, ...partial },
    };
    saveTelegramSettings(updated);
    setSettings(updated);
  }

  function handleNextFromToken() {
    const token = tokenInput.trim();
    if (!token) {
      setTokenError("أدخل توكن البوت");
      return;
    }
    if (!token.includes(":")) {
      setTokenError("التوكن يبدو غير صحيح، تأكد من نسخه كاملاً");
      return;
    }
    setTokenError("");
    setStep("chatid");
  }

  async function handleFinish() {
    const chatId = chatIdInput.trim();
    if (!chatId) {
      setChatIdError("أدخل الشات أي دي");
      return;
    }
    if (!/^-?\d+$/.test(chatId)) {
      setChatIdError("الشات أي دي يجب أن يكون أرقام فقط");
      return;
    }

    setTesting(true);
    const ok = await sendTelegramMessage(
      tokenInput.trim(),
      chatId,
      "✅ <b>تم ربط مخططك الدراسي بتيليجرام!</b>\n\nستصلك إشعارات موادك الدراسية هنا."
    );
    setTesting(false);

    if (!ok) {
      setChatIdError(
        "تعذر إرسال رسالة تجريبية. تأكد من أنك أرسلت /start للبوت وأن الشات أي دي صحيح."
      );
      return;
    }

    const existing = getTelegramSettings();
    const newSettings: TelegramSettings = {
      botToken: tokenInput.trim(),
      chatId,
      notifications: existing?.notifications ?? defaultNotificationSettings,
    };
    saveTelegramSettings(newSettings);
    setSettings(newSettings);
    setShowReconfigure(false);
    setStep("success");
  }

  function handleClear() {
    clearTelegramSettings();
    setSettings(null);
    setStep("token");
    setTokenInput("");
    setChatIdInput("");
  }

  const notif = settings?.notifications ?? defaultNotificationSettings;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ direction: "rtl" }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[420px] bg-[#12082a] rounded-t-3xl border border-white/10 shadow-2xl flex flex-col"
            style={{ maxHeight: "88dvh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">إشعارات تيليجرام</h2>
                  {isConfigured && (
                    <p className="text-[10px] text-green-400 font-medium">مفعّل ✓</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── CONFIGURED VIEW ── */}
            {isConfigured && settings ? (
              <>
                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 no-scrollbar px-5 py-4 space-y-4">
                  {/* Connected badge */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                    <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-green-400">متصل بتيليجرام</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Chat ID: {settings.chatId}
                      </p>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-muted-foreground px-1">
                    اختر الإشعارات التي تريدها
                  </h3>

                  {/* Before Start */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">قبل بدء المادة</p>
                        <p className="text-[11px] text-muted-foreground">تنبيه قبل بداية وقت الدراسة</p>
                      </div>
                      <Toggle checked={notif.beforeStart} onChange={(v) => updateNotif({ beforeStart: v })} />
                    </div>
                    {notif.beforeStart && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-xs text-muted-foreground">قبل بكم دقيقة؟</span>
                        <NumInput value={notif.beforeStartMinutes} onChange={(v) => updateNotif({ beforeStartMinutes: v })} min={1} max={30} />
                      </div>
                    )}
                  </div>

                  {/* On Start */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/8">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">عند بدء المادة</p>
                        <p className="text-[11px] text-muted-foreground">إشعار فور ما تبدأ المادة</p>
                      </div>
                      <Toggle checked={notif.onStart} onChange={(v) => updateNotif({ onStart: v })} />
                    </div>
                  </div>

                  {/* Before End */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/8 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">قبل انتهاء المادة</p>
                        <p className="text-[11px] text-muted-foreground">تنبيه قبل نهاية وقت الدراسة</p>
                      </div>
                      <Toggle checked={notif.beforeEnd} onChange={(v) => updateNotif({ beforeEnd: v })} />
                    </div>
                    {notif.beforeEnd && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-xs text-muted-foreground">قبل بكم دقيقة؟</span>
                        <NumInput value={notif.beforeEndMinutes} onChange={(v) => updateNotif({ beforeEndMinutes: v })} min={1} max={30} />
                      </div>
                    )}
                  </div>

                  {/* On End */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/8">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">عند انتهاء المادة</p>
                        <p className="text-[11px] text-muted-foreground">إشعار فور ما تنتهي المادة</p>
                      </div>
                      <Toggle checked={notif.onEnd} onChange={(v) => updateNotif({ onEnd: v })} />
                    </div>
                  </div>

                  {/* On Postponed */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/8">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">عند وجود دروس مؤجلة</p>
                        <p className="text-[11px] text-muted-foreground">لما تنتهي المادة وفيه دروس لم تكتمل</p>
                      </div>
                      <Toggle checked={notif.onPostponed} onChange={(v) => updateNotif({ onPostponed: v })} />
                    </div>
                  </div>
                </div>

                {/* Fixed footer buttons */}
                <div className="px-5 py-4 border-t border-white/5 shrink-0 flex gap-2">
                  <button
                    onClick={() => {
                      setShowReconfigure(true);
                      setStep("token");
                      setTokenInput("");
                      setChatIdInput("");
                      setTokenError("");
                      setChatIdError("");
                    }}
                    className="flex-1 py-3 rounded-2xl bg-white/8 border border-white/10 text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/15 flex items-center justify-center gap-2 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    إعادة الإعداد
                  </button>
                  <button
                    onClick={handleClear}
                    className="flex-1 py-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm font-bold text-destructive hover:bg-destructive/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    إلغاء الربط
                  </button>
                </div>
              </>
            ) : (
              /* ── SETUP WIZARD ── */
              <>
                <AnimatePresence mode="wait">
                  {/* Step: Token */}
                  {step === "token" && (
                    <motion.div
                      key="token"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="overflow-y-auto flex-1 no-scrollbar px-5 py-4 space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/30 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                        <p className="text-sm font-bold text-white">أدخل توكن البوت</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                        <p className="text-xs font-bold text-blue-400 mb-2">كيف تحصل على توكن البوت؟</p>
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <p>١. افتح تيليجرام وابحث عن <span className="text-white font-bold">@BotFather</span></p>
                          <p>٢. أرسل له: <span className="text-white font-bold">/newbot</span></p>
                          <p>٣. اختر اسم للبوت</p>
                          <p>٤. سيعطيك توكن يبدو كده: <span className="text-white font-mono text-[10px]">123456:ABC-DEF...</span></p>
                        </div>
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors w-fit"
                        >
                          <ExternalLink className="w-3 h-3" />
                          افتح BotFather مباشرة
                        </a>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">التوكن</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={tokenInput}
                          onChange={(e) => { setTokenInput(e.target.value); setTokenError(""); }}
                          placeholder="123456789:ABC-DEFGHIJKLmnopq..."
                          className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-mono"
                        />
                        {tokenError && (
                          <p className="flex items-center gap-1 text-destructive text-xs mt-1.5">
                            <AlertCircle className="w-3 h-3" />
                            {tokenError}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step: Chat ID */}
                  {step === "chatid" && (
                    <motion.div
                      key="chatid"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="overflow-y-auto flex-1 no-scrollbar px-5 py-4 space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/30 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                        <p className="text-sm font-bold text-white">أدخل الشات أي دي بتاعك</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/25">
                        <p className="text-xs font-bold text-yellow-400 mb-1">⚠️ مهم جداً!</p>
                        <p className="text-xs text-muted-foreground">
                          قبل أي حاجة، افتح البوت اللي أنشأته وابعت له{" "}
                          <span className="text-white font-bold">/start</span> عشان يقدر يراسلك.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                        <p className="text-xs font-bold text-blue-400 mb-2">كيف تحصل على الشات أي دي؟</p>
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <p>١. ابحث في تيليجرام عن <span className="text-white font-bold">@userinfobot</span></p>
                          <p>٢. ابعت له <span className="text-white font-bold">/start</span></p>
                          <p>٣. هيرد عليك بمعلوماتك وبالـ <span className="text-white font-bold">Id</span> بتاعك</p>
                          <p>٤. انسخ الرقم وضعه هنا</p>
                        </div>
                        <a
                          href="https://t.me/userinfobot"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors w-fit"
                        >
                          <ExternalLink className="w-3 h-3" />
                          افتح userinfobot مباشرة
                        </a>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">الشات أي دي</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={chatIdInput}
                          onChange={(e) => { setChatIdInput(e.target.value); setChatIdError(""); }}
                          placeholder="123456789"
                          className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-mono"
                        />
                        {chatIdError && (
                          <p className="flex items-center gap-1 text-destructive text-xs mt-1.5">
                            <AlertCircle className="w-3 h-3" />
                            {chatIdError}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step: Success */}
                  {step === "success" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center gap-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-white mb-1">تم الربط بنجاح!</h3>
                        <p className="text-xs text-muted-foreground">
                          راجع تيليجرام — هتلاقي رسالة ترحيبية وصلتلك من البوت
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fixed footer buttons */}
                <div className="px-5 py-4 border-t border-white/5 shrink-0">
                  {step === "token" && (
                    <button
                      onClick={handleNextFromToken}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-white flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}

                  {step === "chatid" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep("token")}
                        className="flex-1 py-3.5 rounded-2xl bg-white/8 border border-white/10 font-bold text-muted-foreground hover:text-white hover:bg-white/15 flex items-center justify-center gap-2 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                        رجوع
                      </button>
                      <button
                        onClick={handleFinish}
                        disabled={testing}
                        className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-white flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:scale-100"
                      >
                        {testing ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />جاري التحقق...</>
                        ) : (
                          <><Check className="w-4 h-4" />تأكيد</>
                        )}
                      </button>
                    </div>
                  )}

                  {step === "success" && (
                    <button
                      onClick={() => { setSettings(getTelegramSettings()); }}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent font-bold text-white flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                    >
                      <Bell className="w-4 h-4" />
                      إعداد الإشعارات
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TelegramBellButton({ onClick }: { onClick: () => void }) {
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const s = getTelegramSettings();
    setConfigured(!!(s?.botToken && s?.chatId));
  }, []);

  return (
    <button
      onClick={() => {
        setConfigured(!!(getTelegramSettings()?.botToken));
        onClick();
      }}
      className="relative p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
      title="إشعارات تيليجرام"
    >
      {configured ? (
        <Bell className="w-5 h-5 text-primary" />
      ) : (
        <BellOff className="w-5 h-5" />
      )}
      {configured && (
        <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-green-400 shadow" />
      )}
    </button>
  );
}
