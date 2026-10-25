import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

type QuestionDraft = {
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  marks: number;
  negativeMarks: number;
};

type SyllabusTopic = {
  _id: string;
  classLevel: string;
  subject: string;
  topicName: string;
  isActive?: boolean;
};

const emptyQuestion: QuestionDraft = {
  subject: "",
  topic: "",
  difficulty: "medium",
  questionText: "",
  options: ["", "", "", ""],
  correctOption: "A",
  marks: 4,
  negativeMarks: 1,
};

export default function CreateExam() {
  const [classLevel, setClassLevel] = useState("Class 11");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [examType, setExamType] = useState("mock");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [instructions, setInstructions] = useState("");

  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestion);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [statusText, setStatusText] = useState("");
  const [examCodeDialog, setExamCodeDialog] = useState<string | null>(null);

  const { data: classLevels = [] } = useQuery<string[]>({
    queryKey: ["syllabusClasses"],
    queryFn: () => apiRequest<string[]>("/syllabus/classes"),
  });

  const { data: syllabusTopics = [] } = useQuery<SyllabusTopic[]>({
    queryKey: ["syllabusTopics", classLevel],
    queryFn: () =>
      apiRequest<SyllabusTopic[]>(
        `/syllabus/topics?classLevel=${encodeURIComponent(classLevel)}`
      ),
    enabled: Boolean(classLevel),
  });

  const subjects = useMemo(
    () => Array.from(new Set(syllabusTopics.map((topic) => topic.subject))).sort(),
    [syllabusTopics]
  );

  const topicOptions = useMemo(
    () =>
      syllabusTopics
        .filter((topic) => !questionDraft.subject || topic.subject === questionDraft.subject)
        .map((topic) => topic.topicName),
    [syllabusTopics, questionDraft.subject]
  );

  const createExamMutation = useMutation({
    mutationFn: async (status: "draft" | "scheduled") => {
      const exam = await apiRequest<any>("/exams", {
        method: "POST",
        body: {
          title,
          description,
          examType,
          classLevel,
          durationMinutes,
          status,
          schedule: {
            startAt: startAt || undefined,
            endAt: endAt || undefined,
          },
          rules: {
            instructions,
          },
        },
      });

      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        await apiRequest(`/exams/${exam._id}/questions`, {
          method: "POST",
          body: {
            questionNo: i + 1,
            questionText: q.questionText,
            questionType: "mcq_single",
            marks: q.marks,
            negativeMarks: q.negativeMarks,
              subject: q.subject,
              topic: q.topic,
              difficulty: q.difficulty,
            options: q.options.map((opt, idx) => ({
              label: String.fromCharCode(65 + idx),
              text: opt,
              isCorrect: String.fromCharCode(65 + idx) === q.correctOption,
            })),
          },
        });
      }

      return exam;
    },
    onSuccess: (exam: any) => {
      setStatusText("");
      setExamCodeDialog(String(exam?.examCode || "N/A"));
      setTitle("");
      setDescription("");
      setDurationMinutes(180);
      setClassLevel("Class 11");
      setStartAt("");
      setEndAt("");
      setInstructions("");
      setQuestions([]);
    },
    onError: (error: Error) => {
      setStatusText(error.message);
    },
  });

  const updateOption = (index: number, value: string) => {
    const options = [...questionDraft.options];
    options[index] = value;
    setQuestionDraft({ ...questionDraft, options });
  };

  const addQuestion = () => {
    const hasBlank =
      !questionDraft.subject ||
      !questionDraft.topic ||
      !questionDraft.questionText.trim() ||
      questionDraft.options.some((option) => !option.trim());
    if (hasBlank) {
      setStatusText("Please fill class/subject/topic/difficulty and all question fields before adding.");
      return;
    }
    setQuestions((prev) => [questionDraft, ...prev]);
    setQuestionDraft(emptyQuestion);
    setStatusText("");
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Create Exam</h1>
        <p className="text-muted-foreground mt-1">Publish real exams directly to the live database</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Exam Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., JEE Mock Test #7" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <select
              value={classLevel}
              onChange={(e) => {
                setClassLevel(e.target.value);
                setQuestionDraft((prev) => ({ ...prev, subject: "", topic: "" }));
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {classLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label>Exam Type</Label>
            <Input value={examType} onChange={(e) => setExamType(e.target.value)} placeholder="mock / unit / practice" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instructions</Label>
          <Textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>

        <div className="space-y-3">
          <Label>Exam Questions</Label>
          <div className="rounded-xl border border-border p-4 space-y-4 bg-background/70">
            <div className="space-y-2">
              <Label>Subject</Label>
              <select
                value={questionDraft.subject}
                onChange={(e) => setQuestionDraft({ ...questionDraft, subject: e.target.value, topic: "" })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Topic</Label>
              <select
                value={questionDraft.topic}
                onChange={(e) => setQuestionDraft({ ...questionDraft, topic: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select topic</option>
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty Tag</Label>
              <select
                value={questionDraft.difficulty}
                onChange={(e) =>
                  setQuestionDraft({
                    ...questionDraft,
                    difficulty: e.target.value as "easy" | "medium" | "hard",
                  })
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                rows={3}
                value={questionDraft.questionText}
                onChange={(e) => setQuestionDraft({ ...questionDraft, questionText: e.target.value })}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {questionDraft.options.map((option, index) => (
                <Input
                  key={index}
                  value={option}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  onChange={(e) => updateOption(index, e.target.value)}
                />
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="correct-option">Correct Option *</Label>
                <Input
                  id="correct-option"
                  value={questionDraft.correctOption}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, correctOption: e.target.value as "A" | "B" | "C" | "D" })}
                  placeholder="e.g., A, B, C, or D"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="correct-marks">Correct Marks (+)</Label>
                <Input
                  id="correct-marks"
                  type="number"
                  value={questionDraft.marks}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, marks: Number(e.target.value || 0) })}
                  placeholder="e.g., 4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="negative-marks">Negative Marks (-)</Label>
                <Input
                  id="negative-marks"
                  type="number"
                  value={questionDraft.negativeMarks}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, negativeMarks: Number(e.target.value || 0) })}
                  placeholder="e.g., 1"
                />
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={addQuestion}>
              <PlusCircle className="w-4 h-4 mr-1" /> Add Question
            </Button>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Added Questions</h3>
              {!questions.length ? (
                <p className="text-xs text-muted-foreground">No questions added yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div key={idx} className="rounded-lg border border-border/70 p-3 bg-card/70">
                      <p className="text-sm font-medium">Q{questions.length - idx}. {q.questionText}</p>
                      <p className="text-xs text-primary mt-1">
                        {q.subject} | {q.topic} | {q.difficulty.toUpperCase()} | Correct: {q.correctOption} | +{q.marks} / -{q.negativeMarks}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            className="gradient-primary text-primary-foreground"
            disabled={createExamMutation.isPending}
            onClick={() => {
              setStatusText("");
              createExamMutation.mutate("scheduled");
            }}
          >
            {createExamMutation.isPending ? "Publishing..." : "Publish Exam"}
          </Button>

          <Button
            variant="outline"
            disabled={createExamMutation.isPending}
            onClick={() => {
              setStatusText("");
              createExamMutation.mutate("draft");
            }}
          >
            Save as Draft
          </Button>
        </div>

        {statusText ? <p className="text-sm text-primary">{statusText}</p> : null}
        <Dialog open={!!examCodeDialog} onOpenChange={() => setExamCodeDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exam Created</DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <p className="text-lg font-semibold">Exam Code:</p>
              <p className="text-2xl font-mono gradient-primary text-primary-foreground px-4 py-2 rounded-lg inline-block mt-2">{examCodeDialog}</p>
              <p className="text-muted-foreground mt-2">Share this code with students to join the exam.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setExamCodeDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
