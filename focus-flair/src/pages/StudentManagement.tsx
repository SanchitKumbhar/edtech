import { Search, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type StudentData = {
  _id: string;
  fullName: string;
  email: string;
  profile?: any;
};

export default function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const { data: students, isLoading, error } = useQuery<StudentData[]>({
    queryKey: ["students"],
    queryFn: () => apiRequest<StudentData[]>("/profile/students"),
  });

  const filteredStudents = (students || [])
    .filter((s) => s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.includes(searchTerm))
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !students) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">Failed to load students. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Student Management 📂</h1>
        <p className="text-muted-foreground mt-1">View and manage all students</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Rank</th>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Points</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.slice(0, 50).map((s) => (
                <tr key={s._id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                  <td className="py-3">#{s.rank}</td>
                  <td className="py-3 font-medium">{s.fullName}</td>
                  <td className="py-3 text-muted-foreground">{s.email}</td>
                  <td className="py-3 font-medium">{s.profile?.pointsTotal || 0}</td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => setSelectedStudent(s)}
                    >
                      View Profile <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStudent?.fullName || "Student Profile"}</DialogTitle>
            <DialogDescription>{selectedStudent?.email || "No email available"}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Points</p>
              <p className="font-semibold">{selectedStudent?.profile?.pointsTotal || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Level</p>
              <p className="font-semibold">{selectedStudent?.profile?.levelNo || 1}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Current Streak</p>
              <p className="font-semibold">{selectedStudent?.profile?.currentStreakDays || 0} days</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Accuracy</p>
              <p className="font-semibold">{selectedStudent?.profile?.avgAccuracyPct || 0}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Practice Points</p>
              <p className="font-semibold">{selectedStudent?.profile?.practicePointsTotal || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Practice Attempts</p>
              <p className="font-semibold">{selectedStudent?.profile?.practiceAttemptCount || 0}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
