import { useMemo, useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, Monitor, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getSocket, joinMonitoringRoom } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Exam = { _id: string; title: string; status: string };

type MonitoringResponse = {
  exam: { _id: string; title: string };
  activeSessions: Array<{
    _id: string;
    warningCount?: number;
    tabSwitchCount?: number;
    startedAt?: string;
    studentId?: { fullName?: string; email?: string };
  }>;
  autoSubmittedSessions: Array<{
    _id: string;
    warningCount?: number;
    tabSwitchCount?: number;
    startedAt?: string;
    submittedAt?: string;
    studentId?: { fullName?: string; email?: string };
  }>;
  recentEvents: Array<{
    _id: string;
    eventType: string;
    severity: "low" | "medium" | "high";
    occurredAt: string;
    studentId?: { fullName?: string; email?: string };
  }>;
};

export default function LiveMonitoring() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedExamId, setSelectedExamId] = useState("");
  const [revertingSessionId, setRevertingSessionId] = useState<string | null>(null);
  const [confirmRevertSessionId, setConfirmRevertSessionId] = useState<string | null>(null);

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ["allExams"],
    queryFn: () => apiRequest<Exam[]>("/exams"),
  });

  const activeExamId = selectedExamId || exams.find((e) => e.status === "live")?._id || exams[0]?._id || "";

  const { data, isLoading: monitoringLoading } = useQuery<MonitoringResponse>({
    queryKey: ["monitoring", activeExamId],
    queryFn: () => apiRequest<MonitoringResponse>(`/monitoring/exams/${activeExamId}`),
    enabled: Boolean(activeExamId),
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Join the exam-specific admin monitoring room and listen for real-time events
  useEffect(() => {
    if (!activeExamId) return;

    // Join room for this exam
    joinMonitoringRoom(activeExamId);

    const socket = getSocket();
    const debouncedHandler = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["monitoring", activeExamId] });
      }, 600); // 600ms debounce to batch high-frequency events
    };

    socket.on("admin_tab_switch", debouncedHandler);
    socket.on("examinee_presence_update", debouncedHandler);

    return () => {
      socket.off("admin_tab_switch", debouncedHandler);
      socket.off("examinee_presence_update", debouncedHandler);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [queryClient, activeExamId]);

  const warningLogs = useMemo(() => data?.recentEvents.slice(0, 20) || [], [data]);

  const revertMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/monitoring/sessions/${sessionId}/revert`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring", activeExamId] });
      toast({
        title: "Submission reverted",
        description: "Student can continue the test now.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Revert failed",
        description: error.message || "Unable to revert this submission.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRevertingSessionId(null);
      setConfirmRevertSessionId(null);
    },
  });

  if (examsLoading || monitoringLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeExamId || !data) {
    return (
      <div className="space-y-6 max-w-7xl animate-fade-in">
        <h1 className="text-2xl md:text-3xl font-bold">Live Monitoring</h1>
        <p className="text-muted-foreground">No exam data available for monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div className="flex items-center gap-3">
        <Monitor className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Live Monitoring</h1>
          <p className="text-muted-foreground">{data.exam.title} - {data.activeSessions.length} students active</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
        </span>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">Select Exam</p>
          <select
            value={activeExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[280px]"
          >
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>{exam.title} ({exam.status})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-5">
          <h2 className="font-semibold mb-4">Active Sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Warnings</th>
                  <th className="pb-3 font-medium">Tab Switches</th>
                </tr>
              </thead>
              <tbody>
                {data.activeSessions.map((session) => {
                  const warnings = session.warningCount || 0;
                  return (
                    <tr key={session._id} className={`border-b border-border/50 ${warnings >= 3 ? "bg-destructive/5" : ""}`}>
                      <td className="py-3 font-medium">{session.studentId?.fullName || "Student"}</td>
                      <td className="py-3 text-muted-foreground">{session.studentId?.email || "N/A"}</td>
                      <td className={`py-3 ${warnings >= 3 ? "text-destructive font-semibold" : ""}`}>{warnings}</td>
                      <td className="py-3">{session.tabSwitchCount || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Recent Events
          </h2>
          <div className="space-y-3">
            {warningLogs.length ? (
              warningLogs.map((log) => (
                <div
                  key={log._id}
                  className={`p-3 rounded-lg border ${
                    log.severity === "high"
                      ? "border-destructive/30 bg-destructive/5"
                      : log.severity === "medium"
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <p className="text-sm font-medium">{log.studentId?.fullName || "Student"}</p>
                  <p className="text-xs text-muted-foreground">{log.eventType}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(log.occurredAt).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" /> No warning events yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="font-semibold mb-4">Auto-Submitted Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Submitted At</th>
                <th className="pb-3 font-medium">Tab Switches</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data.autoSubmittedSessions || []).map((session) => (
                <tr key={session._id} className="border-b border-border/50">
                  <td className="py-3 font-medium">{session.studentId?.fullName || "Student"}</td>
                  <td className="py-3 text-muted-foreground">{session.studentId?.email || "N/A"}</td>
                  <td className="py-3 text-muted-foreground">
                    {session.submittedAt ? new Date(session.submittedAt).toLocaleString() : "-"}
                  </td>
                  <td className="py-3">{session.tabSwitchCount || 0}</td>
                  <td className="py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revertMutation.isPending}
                      onClick={() => {
                        setConfirmRevertSessionId(session._id);
                      }}
                    >
                      {revertMutation.isPending && revertingSessionId === session._id ? "Reverting..." : "Revert Submission"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!data.autoSubmittedSessions?.length ? (
            <p className="text-sm text-muted-foreground py-4">No auto-submitted sessions for this exam.</p>
          ) : null}
        </div>
      </div>

      <Dialog open={Boolean(confirmRevertSessionId)} onOpenChange={(open) => !open && setConfirmRevertSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert Auto-Submission?</DialogTitle>
            <DialogDescription>
              This will reactivate the student's exam session so they can continue the test.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevertSessionId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirmRevertSessionId) return;
                setRevertingSessionId(confirmRevertSessionId);
                revertMutation.mutate(confirmRevertSessionId);
              }}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? "Reverting..." : "Confirm Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
