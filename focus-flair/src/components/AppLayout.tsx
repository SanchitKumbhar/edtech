import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 min-w-0 lg:pl-0 pl-0">
        <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-8 pb-24 lg:pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
