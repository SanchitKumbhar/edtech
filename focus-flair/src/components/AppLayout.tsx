import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen flex w-full relative bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Ambient background glows for realistic glassy refraction */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute top-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-indigo-500/10 blur-[130px]" />
        <div className="absolute -bottom-32 left-1/3 w-[32rem] h-[32rem] rounded-full bg-purple-600/10 blur-[140px]" />
        <div className="absolute top-2/3 -left-20 w-80 h-80 rounded-full bg-pink-500/8 blur-[130px]" />
      </div>

      <AppSidebar />

      <main className="flex-1 min-w-0 relative z-10">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-8 pb-24 lg:pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
