import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthSession } from "@/lib/auth";
import {
  LayoutDashboard,
  FileText,
  Gamepad2,
  BarChart3,
  BookOpen,
  User,
  Trophy,
  Settings,
  Users,
  Eye,
  PlusCircle,
  Menu,
  X,
  GraduationCap,
} from "lucide-react";

const studentNav = [
  { label: "Dashboard", path: "/student/dashboard", icon: LayoutDashboard },
  { label: "Exams", path: "/student/exam/instructions", icon: FileText },
  { label: "Practice", path: "/student/practice", icon: Gamepad2 },
  { label: "Analytics", path: "/student/analytics", icon: BarChart3 },
  { label: "PYQ", path: "/student/pyq", icon: BookOpen },
  { label: "Leaderboard", path: "/student/leaderboard", icon: Trophy },
  { label: "Profile", path: "/student/profile", icon: User },
];

const adminNav = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Exams", path: "/admin/exams", icon: FileText },
  { label: "Exam Scores", path: "/admin/exam-scores", icon: FileText },
  { label: "Syllabus", path: "/admin/syllabus", icon: GraduationCap },
  { label: "Create Exam", path: "/admin/create-exam", icon: PlusCircle },
  { label: "Create Practice", path: "/admin/create-practice", icon: Gamepad2 },
  { label: "PYQ Papers", path: "/admin/pyq", icon: BookOpen },
  { label: "Notices", path: "/admin/notices", icon: FileText },
  { label: "Monitoring", path: "/admin/monitoring", icon: Eye },
  { label: "Students", path: "/admin/students", icon: Users },
  { label: "Profile", path: "/admin/profile", icon: Settings },
];

const studentMobileNav = [
  { label: "Home", path: "/student/dashboard", icon: LayoutDashboard },
  { label: "Exams", path: "/student/exam/instructions", icon: FileText },
  { label: "Practice", path: "/student/practice", icon: Gamepad2 },
  { label: "Analytics", path: "/student/analytics", icon: BarChart3 },
  { label: "Profile", path: "/student/profile", icon: User },
];

const adminMobileNav = [
  { label: "Home", path: "/admin", icon: LayoutDashboard },
  { label: "Exams", path: "/admin/exams", icon: FileText },
  { label: "Notices", path: "/admin/notices", icon: FileText },
  { label: "Live", path: "/admin/monitoring", icon: Eye },
  { label: "Students", path: "/admin/students", icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = location.pathname.startsWith("/admin") ? "admin" : "student";
  const nav = role === "student" ? studentNav : adminNav;
  const mobileNav = role === "student" ? studentMobileNav : adminMobileNav;

  const isActive = (path: string) => {
    if (path === "/" || path === "/admin") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const navigate = useNavigate();
  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };
  const sidebarContent = (
    <>
      <div className="p-5 flex items-center gap-3 border-b border-sidebar-border/30">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold text-sidebar-accent-foreground tracking-tight truncate">FocusFlair</h1>
          <p className="text-[11px] font-medium text-sidebar-foreground/60 uppercase tracking-wider">{role} Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`nav-item ${isActive(item.path) ? "nav-item-active" : ""}`}
          >
            <item.icon className="w-4.5 h-4.5 shrink-0" />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="nav-item w-full flex items-center gap-2 mt-4 text-destructive hover:bg-destructive/15 transition-all"
        >
          <X className="w-4.5 h-4.5 shrink-0" />
          <span className="text-sm">Logout</span>
        </button>
      </nav>

      <div className="p-3 mt-auto" />
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl glass-card flex items-center justify-center border border-white/20 shadow-lg text-foreground"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-sidebar/90 backdrop-blur-2xl border-r border-sidebar-border/40 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:top-0 shadow-2xl`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/85 backdrop-blur-2xl lg:hidden shadow-2xl">
        <nav className="grid grid-cols-5 px-1 py-1">
          {mobileNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${isActive(item.path) ? "mobile-nav-item-active" : ""}`}
            >
              <item.icon className="w-4.5 h-4.5" />
              <span>{item.label}</span>
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="mobile-nav-item text-destructive hover:bg-destructive/10 rounded-lg"
            style={{ border: "none", background: "none" }}
          >
            <X className="w-4.5 h-4.5" />
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </>
  );
}
