import { Users, FileText, Activity, PlusCircle, Upload, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type AdminDashboardData = {
  stats: {
    totalStudents: number;
    activeExams: number;
    ongoingSessions: number;
  };
  recentExams: any[];
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "live":
      return "bg-success/10 text-success";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "scheduled":
      return "bg-primary/10 text-primary";
    default:
      return "bg-warning/10 text-warning";
  }
};

export default function AdminDashboard() {
  const { data: dashboardData, isLoading, error } = useQuery<AdminDashboardData>({
    queryKey: ["adminDashboard"],
    queryFn: () => apiRequest<AdminDashboardData>("/dashboard/admin"),
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

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard 🛠️</h1>
        <p className="text-muted-foreground mt-1">Manage exams, students, and monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Students", value: dashboardData.stats.totalStudents, icon: Users, color: "gradient-primary" },
          { label: "Active Exams", value: dashboardData.stats.activeExams, icon: FileText, color: "gradient-success" },
          { label: "Ongoing Sessions", value: dashboardData.stats.ongoingSessions, icon: Activity, color: "gradient-accent" },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/admin/create-exam">
          <Button className="gradient-primary text-primary-foreground"><PlusCircle className="w-4 h-4 mr-2" /> Create Exam</Button>
        </Link>
        <Link to="/admin/exam-scores">
          <Button variant="outline"><FileText className="w-4 h-4 mr-2" /> Submitted Exam Scores</Button>
        </Link>
        <Link to="/admin/create-practice">
          <Button variant="outline"><PlusCircle className="w-4 h-4 mr-2" /> Create Practice Questions</Button>
        </Link>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Upload Questions</Button>
        <Link to="/admin/post-notice">
          <Button variant="outline"><Bell className="w-4 h-4 mr-2" /> Post Notice</Button>
        </Link>
      </div>

      {/* Exam Table */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-lg mb-4">Recent Exams</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentExams.slice(0, 10).map((e) => (
                <tr key={e._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 font-medium">{e.title}</td>
                  <td className="py-3 text-muted-foreground">{e.examType || "Standard"}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`}>
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3">{e.durationMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
