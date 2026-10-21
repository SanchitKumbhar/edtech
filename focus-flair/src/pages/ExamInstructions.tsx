import { useState } from "react";
import { Clock, AlertTriangle, CheckCircle, Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ValidatedExamPayload = {
  assignment: {
    _id: string;
    status: string;
  };
  exam: {
    _id: string;
    title: string;
    totalQuestions?: number;
    durationMinutes?: number;
    markingScheme?: { positiveMark?: number; negativeMark?: number };
    rules?: { instructions?: string; antiCheatWarning?: string };
    schedule?: { startAt?: string; endAt?: string };
    examCode: string;
  };
};

export default function ExamInstructions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [examCode, setExamCode] = useState("");
  const [startError, setStartError] = useState("");
  const [validated, setValidated] = useState<ValidatedExamPayload | null>(null);
  const [blockedPopupOpen, setBlockedPopupOpen] = useState(false);

  const validateCodeMutation = useMutation({
    mutationFn: () =>
      apiRequest<ValidatedExamPayload>("/exams/entry/validate", {
        method: "POST",
        body: { examCode },
      }),
    onSuccess: (payload) => {
      setValidated(payload);
      setStartError("");
      setExamCode(payload.exam.examCode);
      toast({
        title: "Code verified",
        description: "Read instructions and start when ready.",
      });
    },
    onError: (error: Error) => {
      setValidated(null);
      setStartError(error.message || "Invalid exam code");
      toast({
        title: "Invalid exam code",
        description: error.message || "Please check the code and try again.",
        variant: "destructive",
      });
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ _id: string }>("/exams/sessions/start", {
        method: "POST",
        body: {
          examId: validated?.exam?._id,
          examCode,
          entryMeta: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        },
      }),
    onSuccess: (session) => {
      toast({
        title: "Exam started",
        description: "All the best for your test.",
      });
      navigate(`/exam/live?sessionId=${session._id}`);
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to start exam";
      setStartError(message);

      if (message.toLowerCase().includes("auto-submitted") || message.toLowerCase().includes("auto submitted")) {
        setBlockedPopupOpen(true);
      }

      toast({
        title: "Cannot start test",
        description: message,
        variant: "destructive",
      });
    },
  });

  if (!validated) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Enter Exam Code</h1>
          <p className="text-muted-foreground mt-1">Enter your unique exam code to load exam instructions.</p>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="examCode">Exam Code</Label>
            <Input
              id="examCode"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value.toUpperCase())}
              placeholder="e.g., EXA1B2C"
            />
          </div>

          {startError ? <p className="text-sm text-destructive">{startError}</p> : null}

          <Button
            className="gradient-primary text-primary-foreground"
            disabled={validateCodeMutation.isPending || !examCode.trim()}
            onClick={() => {
              setStartError("");
              validateCodeMutation.mutate();
            }}
          >
            {validateCodeMutation.isPending ? "Validating..." : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  const exam = validated.exam;
  const positive = exam.markingScheme?.positiveMark ?? 4;
  const negative = exam.markingScheme?.negativeMark ?? 1;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
        <p className="text-muted-foreground">Code accepted. Read instructions and start the exam.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <Clock className="w-8 h-8 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{exam.durationMinutes || 0} min</p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
        <div className="stat-card text-center">
          <CheckCircle className="w-8 h-8 mx-auto text-success mb-2" />
          <p className="text-2xl font-bold">+{positive} / -{negative}</p>
          <p className="text-xs text-muted-foreground">Marking Scheme</p>
        </div>
        <div className="stat-card text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-warning mb-2" />
          <p className="text-2xl font-bold">{exam.totalQuestions || 0}</p>
          <p className="text-xs text-muted-foreground">Total Questions</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Exam Rules</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><span className="text-primary font-bold">1.</span> Submit each response through the system before moving away.</li>
          <li className="flex gap-3"><span className="text-primary font-bold">2.</span> Marked-for-review questions remain editable until final submission.</li>
          <li className="flex gap-3"><span className="text-primary font-bold">3.</span> Timer starts immediately after clicking Start Test.</li>
          <li className="flex gap-3"><span className="text-primary font-bold">4.</span> Tab changes are recorded and visible to admins in real time.</li>
          {exam.rules?.instructions ? (
            <li className="flex gap-3"><span className="text-primary font-bold">5.</span> {exam.rules.instructions}</li>
          ) : null}
        </ul>
      </div>

      <div className="glass-card rounded-xl p-6 border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive">Anti-Cheating Alert</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {exam.rules?.antiCheatWarning ||
                "Anti-cheat events are logged automatically. Repeated violations may trigger forced submission."}
            </p>
          </div>
        </div>
      </div>

      {startError ? <p className="text-sm text-destructive">{startError}</p> : null}

      <div className="flex justify-center pt-4 gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setValidated(null);
            setStartError("");
          }}
        >
          Change Code
        </Button>

        <Button
          size="lg"
          className="gradient-primary text-primary-foreground px-12 py-6 text-lg font-semibold rounded-xl"
          disabled={startSessionMutation.isPending}
          onClick={() => {
            setStartError("");
            startSessionMutation.mutate();
          }}
        >
          {startSessionMutation.isPending ? "Starting..." : "Start Test"}
        </Button>
      </div>

      <Dialog open={blockedPopupOpen} onOpenChange={setBlockedPopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Test Blocked</DialogTitle>
            <DialogDescription>
              Your previous attempt was auto-submitted due to anti-cheat violations. You can continue only after admin reverts your submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockedPopupOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
