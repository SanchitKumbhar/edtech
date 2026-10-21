import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Flag, ChevronLeft, ChevronRight, ShieldCheck, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { getSocket, joinExamRoom, leaveExamRoom } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";

type QuestionStatus = "not-visited" | "answered" | "not-answered" | "review";

type SessionData = {
  session: {
    _id: string;
    examId: string;
    startedAt?: string;
    status: string;
  };
  attempts: Array<{
    questionId: string;
    selectedOptionId?: string;
    visitStatus?: "not_visited" | "answered" | "not_answered" | "review";
    isMarkedForReview?: boolean;
  }>;
};

type AntiCheatResponse = {
  autoSubmitted?: boolean;
  tabSwitchThreshold?: number;
  session?: {
    status?: string;
  };
};

type Exam = {
  _id: string;
  title: string;
  durationMinutes: number;
};

type Question = {
  _id: string;
  questionText: string;
  options: Array<{ _id: string; label: string; text: string }>;
};

const mapVisitStatus = (status?: string, review?: boolean): QuestionStatus => {
  if (review) return "review";
  if (status === "answered") return "answered";
  if (status === "not_answered") return "not-answered";
  return "not-visited";
};

export default function ExamLive() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<QuestionStatus[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [tabWarning, setTabWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [autoSubmittedDialogOpen, setAutoSubmittedDialogOpen] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  const {
    data: sessionPayload,
    isLoading: sessionLoading,
    isError: isSessionError,
    error: sessionError,
  } = useQuery<SessionData>({
    queryKey: ["examSession", sessionId],
    queryFn: () => apiRequest<SessionData>(`/exams/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const examId = sessionPayload?.session.examId;

  const {
    data: exam,
    isLoading: examLoading,
    isError: isExamError,
    error: examError,
  } = useQuery<Exam>({
    queryKey: ["exam", examId],
    queryFn: () => apiRequest<Exam>(`/exams/${examId}`),
    enabled: Boolean(examId),
  });

  const {
    data: questions = [],
    isLoading: questionsLoading,
    isError: isQuestionsError,
    error: questionsError,
  } = useQuery<Question[]>({
    queryKey: ["examQuestions", examId, sessionId],
    queryFn: () => apiRequest<Question[]>(`/exams/${examId}/questions?sessionId=${encodeURIComponent(sessionId)}`),
    enabled: Boolean(examId),
  });

  useEffect(() => {
    if (!sessionPayload || !questions.length) return;

    const nextStatuses = questions.map(() => "not-visited") as QuestionStatus[];
    const nextAnswers: Record<string, string> = {};

    sessionPayload.attempts.forEach((attempt) => {
      const idx = questions.findIndex((q) => q._id === attempt.questionId);
      if (idx >= 0) {
        nextStatuses[idx] = mapVisitStatus(attempt.visitStatus, attempt.isMarkedForReview);
        if (attempt.selectedOptionId) {
          nextAnswers[attempt.questionId] = attempt.selectedOptionId;
        }
      }
    });

    setStatuses(nextStatuses);
    setAnswers(nextAnswers);

    const durationSeconds = (exam?.durationMinutes || 0) * 60;
    if (sessionPayload.session.startedAt && durationSeconds > 0) {
      const elapsed = Math.floor((Date.now() - new Date(sessionPayload.session.startedAt).getTime()) / 1000);
      setTimeLeft(Math.max(0, durationSeconds - elapsed));
    }
  }, [sessionPayload, questions, exam]);

  useEffect(() => {
    if (!timeLeft) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const antiCheatMutation = useMutation<AntiCheatResponse>({
    mutationFn: () =>
      apiRequest<AntiCheatResponse>("/monitoring/events", {
        method: "POST",
        body: {
          sessionId,
          eventType: "tab_switch",
          severity: "medium",
          payload: { occurredAt: new Date().toISOString() },
        },
      }),
    onSuccess: (payload) => {
      if (payload?.autoSubmitted || payload?.session?.status === "auto_submitted") {
        setTabWarning(false);
        setAutoSubmittedDialogOpen(true);
        toast({
          title: "Test auto-submitted",
          description: "You switched tabs 2 times. Wait for admin revert to continue.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Anti-cheat event failed",
        description: error.message || "Could not record tab switch event.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!autoSubmittedDialogOpen) return;
    if (redirectCountdown <= 0) {
      queryClient.invalidateQueries({ queryKey: ["assignedExams"] });
      queryClient.invalidateQueries({ queryKey: ["examSession", sessionId] });
      navigate("/student/dashboard");
      return;
    }

    const timer = setTimeout(() => setRedirectCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoSubmittedDialogOpen, redirectCountdown, queryClient, sessionId, navigate]);

  useEffect(() => {
    if (!examId) return;
    joinExamRoom(examId, sessionId);
    return () => {
      leaveExamRoom(examId);
    };
  }, [examId, sessionId]);

  useEffect(() => {
    const socket = getSocket();
    const handleVisibility = () => {
      if (document.hidden && sessionId && !autoSubmittedDialogOpen) {
        setTabSwitchCount((c) => c + 1);
        setTabWarning(true);
        antiCheatMutation.mutate();
        // Emit tab switch event via websocket with examId and sessionId
        socket.emit("tab_switch", {
          sessionId,
          examId,
          occurredAt: new Date().toISOString(),
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [sessionId, examId, antiCheatMutation, autoSubmittedDialogOpen]);

  useEffect(() => {
    setStatuses((prev) => {
      if (!questions.length || currentQ >= questions.length) return prev;
      const next = prev.length ? [...prev] : (questions.map(() => "not-visited") as QuestionStatus[]);
      if (next[currentQ] === "not-visited") {
        next[currentQ] = "not-answered";
      }
      return next;
    });
  }, [currentQ, questions]);

  const saveAttemptMutation = useMutation({
    mutationFn: (params: { questionId: string; selectedOptionId?: string; visitStatus: string; isMarkedForReview: boolean }) =>
      apiRequest("/exams/sessions/attempt", {
        method: "POST",
        body: {
          sessionId,
          questionId: params.questionId,
          selectedOptionId: params.selectedOptionId,
          visitStatus: params.visitStatus,
          isMarkedForReview: params.isMarkedForReview,
        },
      }),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("/exams/sessions/submit", {
        method: "POST",
        body: { sessionId },
      }),
    onSuccess: () => {
      toast({
        title: "Exam submitted",
        description: "Your responses were submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["assignedExams"] });
      navigate("/student/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Submit failed",
        description: error.message || "Unable to submit exam right now.",
        variant: "destructive",
      });
    },
  });

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusClass = (status: QuestionStatus, idx: number) => {
    const base = "question-btn";
    const current = idx === currentQ ? " question-btn-current" : "";
    switch (status) {
      case "answered":
        return `${base} question-btn-answered${current}`;
      case "not-answered":
        return `${base} question-btn-not-answered${current}`;
      case "review":
        return `${base} question-btn-review${current}`;
      default:
        return `${base} question-btn-not-visited${current}`;
    }
  };

  const currentQuestion = questions[currentQ];
  const isUrgent = timeLeft < 600;

  const answeredCount = useMemo(
    () => statuses.filter((s) => s === "answered").length,
    [statuses]
  );

  if (!sessionId) {
    return (
      <div className="p-8">
        <p className="text-destructive">Missing session id. Start exam from instructions page.</p>
      </div>
    );
  }

  if (sessionLoading || examLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSessionError || isExamError || isQuestionsError) {
    const message =
      (sessionError as Error | undefined)?.message ||
      (examError as Error | undefined)?.message ||
      (questionsError as Error | undefined)?.message ||
      "Failed to load exam data.";

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-destructive font-medium">{message}</p>
          <Button variant="outline" onClick={() => navigate("/student/exam/instructions")}>Back to Exam Entry</Button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-destructive">Exam details not found.</p>
      </div>
    );
  }

  if (sessionPayload?.session?.status && sessionPayload.session.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="font-semibold">This session is already {sessionPayload.session.status.replace("_", " ")}.</p>
          <p className="text-sm text-muted-foreground">You can no longer continue this exam.</p>
          <Button variant="outline" onClick={() => navigate("/student/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!questions.length || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="font-semibold">No questions are available for this exam yet.</p>
          <p className="text-sm text-muted-foreground">Please contact admin or try again later.</p>
          <Button variant="outline" onClick={() => navigate("/student/exam/instructions")}>Back to Exam Entry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <h2 className="font-semibold text-sm md:text-base truncate">{exam.title}</h2>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex text-xs bg-primary/10 text-primary px-2 py-1 rounded-full items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Monitoring Active
          </span>
          {tabSwitchCount > 0 ? (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {tabSwitchCount} tab switches
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">Answered: {answeredCount}/{questions.length}</span>
          <div className={`font-mono font-bold text-lg px-4 py-1.5 rounded-lg ${isUrgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary"}`}>
            {formatTime(timeLeft)}
          </div>
          <Button size="sm" variant="destructive" className="font-semibold" onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">Q{currentQ + 1}</span>
              <span>of {questions.length}</span>
            </div>

            <div className="glass-card rounded-xl p-6 animate-fade-in">
              <p className="text-base md:text-lg leading-relaxed font-medium">{currentQuestion.questionText}</p>
            </div>

            <div className="space-y-3">
              {currentQuestion.options.map((opt) => {
                const selected = answers[currentQuestion._id] === opt._id;
                return (
                  <button
                    key={opt._id}
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [currentQuestion._id]: opt._id }));
                      setStatuses((prev) => {
                        const next = [...prev];
                        next[currentQ] = "answered";
                        return next;
                      });
                      saveAttemptMutation.mutate({
                        questionId: currentQuestion._id,
                        selectedOptionId: opt._id,
                        visitStatus: "answered",
                        isMarkedForReview: false,
                      });
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      selected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                        selected ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-sm md:text-base">{opt.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStatuses((prev) => {
                    const next = [...prev];
                    next[currentQ] = "review";
                    return next;
                  });
                  saveAttemptMutation.mutate({
                    questionId: currentQuestion._id,
                    selectedOptionId: answers[currentQuestion._id],
                    visitStatus: "not_answered",
                    isMarkedForReview: true,
                  });
                }}
                className="text-primary border-primary/30"
              >
                <Flag className="w-4 h-4 mr-1" /> Mark for Review
              </Button>
              <Button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))} disabled={currentQ === questions.length - 1}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <div className="w-64 border-l bg-card p-4 overflow-y-auto hidden md:block shrink-0 md:sticky md:top-0 md:h-[calc(100vh-3.5rem)]">
          <h3 className="font-semibold text-sm mb-3">Question Navigator</h3>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {statuses.map((status, i) => (
              <button key={i} onClick={() => setCurrentQ(i)} className={statusClass(status, i)}>
                {i + 1}
              </button>
            ))}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2"><span className="question-btn question-btn-not-visited w-5 h-5 text-[10px]" /> Not Visited</div>
            <div className="flex items-center gap-2"><span className="question-btn question-btn-answered w-5 h-5 text-[10px]" /> Answered</div>
            <div className="flex items-center gap-2"><span className="question-btn question-btn-not-answered w-5 h-5 text-[10px]" /> Not Answered</div>
            <div className="flex items-center gap-2"><span className="question-btn question-btn-review w-5 h-5 text-[10px]" /> Marked for Review</div>
          </div>
        </div>
      </div>

      <Dialog open={tabWarning} onOpenChange={setTabWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Tab Switch Detected
            </DialogTitle>
            <DialogDescription>
              Your anti-cheat event was logged. After 2 tab switches, your test is auto-submitted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setTabWarning(false)}>Continue Exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={autoSubmittedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Test Auto-Submitted
            </DialogTitle>
            <DialogDescription>
              You switched tabs 2 times, so your test has been auto-submitted. You cannot continue unless admin reverts your submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["assignedExams"] });
                queryClient.invalidateQueries({ queryKey: ["examSession", sessionId] });
                navigate("/student/dashboard");
              }}
            >
              Go to Dashboard ({redirectCountdown})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
