import { Trophy, Target, Flame, Star, Bell, ChevronRight, Play, Eye, BookOpen, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type DashboardData = {
  user: any;
  profile: any;
  stats: { pointsTotal: number; avgAccuracyPct: number; examsAttempted: number; streakDays: number };
  notices: any[];
  topicStats: any[];
  leaderboardPreview: any[];
};

export default function StudentDashboard() {
  const user = getStoredUser();

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["studentDashboard"],
    queryFn: () => apiRequest<DashboardData>("/dashboard/student"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  const stats = [
    { label: "Total Points", value: dashboardData.stats.pointsTotal.toLocaleString(), icon: Star, color: "gradient-accent" },
    { label: "Accuracy", value: `${dashboardData.stats.avgAccuracyPct}%`, icon: Target, color: "gradient-success" },
    { label: "Exams Attempted", value: dashboardData.stats.examsAttempted, icon: Trophy, color: "gradient-primary" },
    { label: "Streak", value: `${dashboardData.stats.streakDays} days`, icon: Flame, color: "bg-streak" },
  ];

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {user?.fullName}! 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your preparation overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
              <s.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-1 gap-6">
        {/* Leaderboard Preview */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">🏆 Leaderboard</h2>
            <Link to="/student/leaderboard" className="text-sm text-primary hover:underline flex items-center gap-1">
              Full rankings <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {dashboardData.leaderboardPreview.slice(0, 5).map((entry: any) => {
              const isCurrentUser = entry.studentId === user?._id;
              return (
                <div
                  key={entry._id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      entry.rankNo <= 3 ? "gradient-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {entry.rankNo}
                    </span>
                    <span className="text-sm font-medium">{entry.name}{isCurrentUser ? " (You)" : ""}</span>
                  </div>
                  <span className="text-sm font-semibold">{entry.points?.toLocaleString() || 0} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notices */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-lg">Notices</h2>
        </div>
        <div className="space-y-3">
          {dashboardData.notices.slice(0, 5).map((notice: any) => (
            <div key={notice._id} className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium leading-snug">{notice.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(notice.publishAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/student/practice" className="stat-card flex items-center gap-4 group">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold group-hover:text-primary transition-colors">Start Practice</p>
            <p className="text-xs text-muted-foreground">Continue where you left off</p>
          </div>
        </Link>
        <Link to="/student/analytics" className="stat-card flex items-center gap-4 group">
          <div className="w-11 h-11 rounded-xl gradient-success flex items-center justify-center">
            <Eye className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold group-hover:text-primary transition-colors">View Performance</p>
            <p className="text-xs text-muted-foreground">Track your progress</p>
          </div>
        </Link>
        <Link to="/student/pyq" className="stat-card flex items-center gap-4 group">
          <div className="w-11 h-11 rounded-xl gradient-accent flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold group-hover:text-primary transition-colors">PYQ Section</p>
            <p className="text-xs text-muted-foreground">Previous year questions</p>
          </div>
        </Link>
      </div>

      {/* Practice Topics by Subject */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Practice Questions by Topic</h2>
          <Link to="/student/practice" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all topics <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData.topicStats.slice(0, 6).map((topic: any) => {
            const topicName = topic.topicId?.topicName || topic.topicId?.name || "Topic";
            const icon = topic.topicId?.icon || ["⚙️", "🌡️", "⚡", "🔬", "📐", "∫"][(topicName.charCodeAt(0) || 0) % 6];
            return (
              <Link key={topic._id} to="/student/practice" className="stat-card space-y-4 cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="font-semibold group-hover:text-primary transition-colors">{topicName}</p>
                      <p className="text-xs text-muted-foreground">{topic.solvedCount} solved</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Mastery</span>
                      <span className="font-medium">{Math.round(topic.masteryPct)}%</span>
                    </div>
                    <Progress value={Math.round(topic.masteryPct)} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Accuracy</span>
                      <span className="font-medium">{Math.round(topic.accuracyPct)}%</span>
                    </div>
                    <Progress value={Math.round(topic.accuracyPct)} className="h-2" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
