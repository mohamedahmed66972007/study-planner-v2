import { ReactNode, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Calendar, Clock, Plus, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyPostponed } from "@/hooks/use-study";

function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOffline;
}

export function Layout({ children }: { children: ReactNode }) {
  const isOffline = useOfflineStatus();

  return (
    <div dir="rtl" className="h-dvh w-full flex justify-center bg-black/90 p-0 sm:p-4 md:p-8">
      <div className="w-full max-w-[420px] h-full bg-background/50 backdrop-blur-3xl sm:rounded-[2.5rem] shadow-2xl shadow-primary/10 overflow-hidden flex flex-col relative border-x border-t border-white/5 sm:border-white/10">

        {/* Offline Banner */}
        {isOffline && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/20 border-b border-yellow-500/30 text-yellow-300 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>أنت غير متصل بالإنترنت — البيانات محفوظة مؤقتاً</span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 w-full glass-panel border-t border-white/10 rounded-t-3xl sm:rounded-b-[2.5rem] p-4 px-6 flex justify-between items-center z-50">
          <NavItem href="/" icon={<Calendar className="w-5 h-5" />} label="الجدول" />
          
          <div className="relative -top-8">
            <Link 
              href="/add" 
              className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-accent shadow-lg shadow-primary/40 text-white hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <Plus className="w-7 h-7" />
            </Link>
          </div>
          
          <PostponedNavItem />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const [isActive] = useRoute(href);
  
  return (
    <Link 
      href={href} 
      className={cn(
        "flex flex-col items-center gap-1.5 transition-colors duration-300",
        isActive ? "text-primary" : "text-muted-foreground hover:text-white"
      )}
    >
      <div className={cn(
        "p-2 rounded-2xl transition-all duration-300",
        isActive ? "bg-primary/20" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function PostponedNavItem() {
  const [isActive] = useRoute("/postponed");
  const { data: postponed } = useStudyPostponed();
  const count = postponed?.length || 0;

  return (
    <Link 
      href="/postponed" 
      className={cn(
        "flex flex-col items-center gap-1.5 transition-colors duration-300 relative",
        isActive ? "text-accent" : "text-muted-foreground hover:text-white"
      )}
    >
      <div className={cn(
        "p-2 rounded-2xl transition-all duration-300",
        isActive ? "bg-accent/20" : "bg-transparent"
      )}>
        <Clock className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-0 right-1 w-4 h-4 bg-destructive text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-md animate-in zoom-in">
            {count}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium">المؤجلة</span>
    </Link>
  );
}
