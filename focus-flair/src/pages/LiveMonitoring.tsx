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
    <div className="space-y-8 max-w-7xl animate-fade-in pb-12">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Live Proctoring & Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data.exam.title} &bull; <span className="text-foreground font-semibold">{data.activeSessions.length} active candidate{data.activeSessions.length === 1 ? "" : "s"}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE STREAM
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/50 dark:border-white/10 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">Active Exam Filter:</p>
          <select
            value={activeExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="h-10 rounded-xl border border-input/80 bg-background/70 backdrop-blur-md px-3.5 text-sm min-w-[280px] font-medium shadow-sm focus:ring-2 focus:ring-primary/30 outline-none"
          >
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>{exam.title} ({exam.status.toUpperCase()})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 md:p-8 border border-white/50 dark:border-white/10 shadow-xl space-y-5">
          <h2 className="font-bold text-xl tracking-tight">Active Candidate Sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/60">
                  <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Candidate Name</th>
                  <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Email</th>
                  <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Warnings</th>
                  <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Tab Switches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.activeSessions.map((session) => {
                  const warnings = session.warningCount || 0;
                  return (
                    <tr key={session._id} className={`hover:bg-muted/30 transition-colors ${warnings >= 3 ? "bg-destructive/10" : ""}`}>
                      <td className="py-3.5 font-semibold text-foreground">{session.studentId?.fullName || "Student"}</td>
                      <td className="py-3.5 text-muted-foreground">{session.studentId?.email || "N/A"}</td>
                      <td className={`py-3.5 ${warnings >= 3 ? "text-destructive font-bold" : "text-foreground font-medium"}`}>
                        <span className={warnings >= 3 ? "bg-destructive/20 px-2 py-0.5 rounded-full text-xs" : ""}>
                          {warnings}
                        </span>
                      </td>
                      <td className="py-3.5 text-muted-foreground font-medium">{session.tabSwitchCount || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-white/50 dark:border-white/10 shadow-xl space-y-4">
          <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Real-time Security Log
          </h2>
          <div className="space-y-3">
            {warningLogs.length ? (
              warningLogs.map((log) => (
                <div
                  key={log._id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    log.severity === "high"
                      ? "border-destructive/30 bg-destructive/10 shadow-sm"
                      : log.severity === "medium"
                      ? "border-warning/30 bg-warning/10 shadow-sm"
                      : "border-border/60 bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-bold text-foreground">{log.studentId?.fullName || "Student"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.eventType}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5">{new Date(log.occurredAt).toLocaleTimeString()}</p>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Proctoring normal. No alerts.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/50 dark:border-white/10 shadow-xl space-y-5">
        <h2 className="font-bold text-xl tracking-tight">Auto-Submitted Disqualified Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/60">
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Candidate Name</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Email</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Submission Time</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Tab Switches</th>
                <th className="pb-3 font-semibold text-xs uppercase tracking-wider">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(data.autoSubmittedSessions || []).map((session) => (
                <tr key={session._id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 font-semibold text-foreground">{session.studentId?.fullName || "Student"}</td>
                  <td className="py-3.5 text-muted-foreground">{session.studentId?.email || "N/A"}</td>
                  <td className="py-3.5 text-muted-foreground text-xs font-medium">
                    {session.submittedAt ? new Date(session.submittedAt).toLocaleString() : "-"}
                  </td>
                  <td className="py-3.5 text-muted-foreground font-semibold">{session.tabSwitchCount || 0}</td>
                  <td className="py-3.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="glass-card rounded-xl border-border/80 text-xs font-semibold hover:border-primary/50"
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
            <p className="text-sm text-muted-foreground py-6 text-center">No auto-submitted disqualified sessions for this exam.</p>
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
