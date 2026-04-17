import { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { CalendarDays, Clock3, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyPostponed } from "@/hooks/use-study";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div
      dir="rtl"
      className="app-root w-full flex justify-center"
      style={{ background: "hsl(240 15% 5%)" }}
    >
      <div
        className="w-full max-w-[420px] relative flex flex-col"
        style={{ height: "100%", overflow: "hidden" }}
      >
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute -top-32 -right-32 w-72 h-72 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
          />
        </div>

        {/* Main Content — no z-index stacking context so fixed dialogs (z-[200]) render above nav */}
        <main
          className="flex-1 overflow-y-auto no-scrollbar pb-28"
          style={{ position: "relative" }}
        >
          {children}
        </main>

        {/* Bottom Navigation — z-40 so fixed dialogs (z-[200]) appear above it */}
        <div
          className="absolute bottom-0 inset-x-0 flex justify-center px-4"
          style={{
            zIndex: 40,
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <nav
      className="flex items-center gap-2 px-3 py-2 rounded-[2rem]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <NavItem href="/" icon={<CalendarDays className="w-5 h-5" />} label="الجدول" />

      {/* Add button */}
      <Link href="/add">
        <div
          className="mx-1 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
            boxShadow: "0 4px 16px hsl(var(--primary) / 0.45)",
          }}
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
      </Link>

      <PostponedNavItem />
    </nav>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const [isActive] = useRoute(href);

  return (
    <Link href={href}>
      <div
        className={cn(
          "flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200",
          isActive ? "text-primary" : "text-muted-foreground hover:text-white"
        )}
        style={isActive ? { background: "hsl(var(--primary) / 0.12)" } : {}}
      >
        {icon}
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
      </div>
    </Link>
  );
}

function PostponedNavItem() {
  const [isActive] = useRoute("/postponed");
  const { data: postponed } = useStudyPostponed();
  const count = postponed?.length || 0;

  return (
    <Link href="/postponed">
      <div
        className={cn(
          "relative flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200",
          isActive ? "text-accent" : "text-muted-foreground hover:text-white"
        )}
        style={isActive ? { background: "hsl(var(--accent) / 0.12)" } : {}}
      >
        <Clock3 className="w-5 h-5" />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black text-white px-1"
            style={{ background: "hsl(var(--destructive))" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
        <span className="text-[10px] font-bold tracking-wide">المؤجلة</span>
      </div>
    </Link>
  );
}
