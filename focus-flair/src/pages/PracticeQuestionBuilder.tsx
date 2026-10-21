import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Difficulty = "easy" | "medium" | "hard";

type Topic = {
  _id: string;
  classLevel?: string;
  subject?: string;
  topicName: string;
  easyToMediumUnlockCount?: number;
  mediumToHardUnlockCount?: number;
  practiceCountEasy?: number;
  practiceCountMedium?: number;
  practiceCountHard?: number;
};

type SyllabusTopic = {
  _id: string;
  classLevel: string;
  subject: string;
  topicName: string;
};

type PracticeQuestionForm = {
  topicId: string;
  difficulty: Difficulty;
  questionText: string;
  options: string[];
  correctOption: "A" | "B" | "C" | "D";
  pointsReward: number;
};

const emptyForm: PracticeQuestionForm = {
  topicId: "",
  difficulty: "easy",
  questionText: "",
  options: ["", "", "", ""],
  correctOption: "A",
  pointsReward: 20,
};

type CsvParsedQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
};

const canonicalHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell.trim());
      const hasContent = row.some((c) => c !== "");
      if (hasContent) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  const hasContent = row.some((c) => c !== "");
  if (hasContent) {
    rows.push(row);
  }

  return rows;
};

export default function PracticeQuestionBuilder() {
  const queryClient = useQueryClient();
  const [classLevel, setClassLevel] = useState("Class 11");
  const [subject, setSubject] = useState("");
  const [selectedTopicName, setSelectedTopicName] = useState("");
  const [form, setForm] = useState<PracticeQuestionForm>(emptyForm);
  const [statusText, setStatusText] = useState("");
  const [entryMode, setEntryMode] = useState<"manual" | "csv">("manual");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [replaceExistingCsvQuestions, setReplaceExistingCsvQuestions] = useState(true);
  const [easyToMediumUnlockCount, setEasyToMediumUnlockCount] = useState<string>("");
  const [mediumToHardUnlockCount, setMediumToHardUnlockCount] = useState<string>("");
  const [practiceCountEasy, setPracticeCountEasy] = useState<string>("");
  const [practiceCountMedium, setPracticeCountMedium] = useState<string>("");
  const [practiceCountHard, setPracticeCountHard] = useState<string>("");

  const { data: classLevels = [] } = useQuery<string[]>({
    queryKey: ["syllabusClasses"],
    queryFn: () => apiRequest<string[]>("/syllabus/classes"),
  });

  const { data: syllabusTopics = [], isLoading: syllabusLoading } = useQuery<SyllabusTopic[]>({
    queryKey: ["syllabusTopics", classLevel],
    queryFn: () => apiRequest<SyllabusTopic[]>(`/syllabus/topics?classLevel=${encodeURIComponent(classLevel)}`),
    enabled: Boolean(classLevel),
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery<Topic[]>({
    queryKey: ["practiceTopics", classLevel, subject],
    queryFn: () =>
      apiRequest<Topic[]>(
        `/practice/topics?classLevel=${encodeURIComponent(classLevel)}${
          subject ? `&subject=${encodeURIComponent(subject)}` : ""
        }`
      ),
    enabled: Boolean(classLevel),
  });

  const subjects = useMemo(
    () => Array.from(new Set(syllabusTopics.map((topic) => topic.subject))).sort(),
    [syllabusTopics]
  );

  const syllabusTopicNames = useMemo(
    () =>
      syllabusTopics
        .filter((topic) => !subject || topic.subject === subject)
        .map((topic) => topic.topicName),
    [syllabusTopics, subject]
  );

  const selectedTopicId =
    topics.find(
      (topic) =>
        (!topic.classLevel || topic.classLevel === classLevel) &&
        (topic.subject || "") === subject &&
        topic.topicName === selectedTopicName
    )?._id || "";

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic._id === selectedTopicId),
    [topics, selectedTopicId]
  );

  useEffect(() => {
    if (!selectedTopic) {
      setEasyToMediumUnlockCount("");
      setMediumToHardUnlockCount("");
      setPracticeCountEasy("");
      setPracticeCountMedium("");
      setPracticeCountHard("");
      return;
    }

    setEasyToMediumUnlockCount(selectedTopic.easyToMediumUnlockCount ? String(selectedTopic.easyToMediumUnlockCount) : "");
    setMediumToHardUnlockCount(selectedTopic.mediumToHardUnlockCount ? String(selectedTopic.mediumToHardUnlockCount) : "");
    setPracticeCountEasy(selectedTopic.practiceCountEasy ? String(selectedTopic.practiceCountEasy) : "");
    setPracticeCountMedium(selectedTopic.practiceCountMedium ? String(selectedTopic.practiceCountMedium) : "");
    setPracticeCountHard(selectedTopic.practiceCountHard ? String(selectedTopic.practiceCountHard) : "");
  }, [selectedTopic]);

  const buildTopicSettingsPayload = (difficulty: Difficulty) => {
    if (difficulty === "easy") {
      return {
        easyToMediumUnlockCount: easyToMediumUnlockCount.trim() ? Number(easyToMediumUnlockCount) : undefined,
        practiceCountEasy: practiceCountEasy.trim() ? Number(practiceCountEasy) : undefined,
      };
    }

    if (difficulty === "medium") {
      return {
        mediumToHardUnlockCount: mediumToHardUnlockCount.trim() ? Number(mediumToHardUnlockCount) : undefined,
        practiceCountMedium: practiceCountMedium.trim() ? Number(practiceCountMedium) : undefined,
      };
    }

    return {
      practiceCountHard: practiceCountHard.trim() ? Number(practiceCountHard) : undefined,
    };
  };

  const getTargetCount = () => {
    const raw =
      form.difficulty === "easy"
        ? practiceCountEasy
        : form.difficulty === "medium"
        ? practiceCountMedium
        : practiceCountHard;
    const num = Number(raw?.trim());
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
  };

  const { data: existingQuestions = [], isLoading: questionListLoading } = useQuery<any[]>({
    queryKey: ["adminPracticeQuestions", selectedTopicId],
    queryFn: () => apiRequest<any[]>(`/practice/topics/${selectedTopicId}/questions`),
    enabled: Boolean(selectedTopicId),
  });

  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [previewDifficultyFilter, setPreviewDifficultyFilter] = useState<"all" | Difficulty>("all");

  useEffect(() => {
    setPreviewPage(1);
  }, [selectedTopicId, previewDifficultyFilter]);

  const filteredLiveQuestions = useMemo(() => {
    if (previewDifficultyFilter === "all") return existingQuestions;
    return existingQuestions.filter((q) => q.difficulty === previewDifficultyFilter);
  }, [existingQuestions, previewDifficultyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLiveQuestions.length / previewPageSize));

  useEffect(() => {
    if (previewPage > totalPages) {
      setPreviewPage(totalPages);
    }
  }, [totalPages, previewPage]);

  const paginatedQuestions = useMemo(() => {
    const startIndex = (previewPage - 1) * previewPageSize;
    return filteredLiveQuestions.slice(startIndex, startIndex + previewPageSize);
  }, [filteredLiveQuestions, previewPage, previewPageSize]);

  const createMutation = useMutation({
    mutationFn: async () => {
      let topicId = selectedTopicId;

      if (!topicId) {
        const createdTopic = await apiRequest<Topic>("/practice/topics", {
          method: "POST",
          body: {
            classLevel,
            subject,
            topicName: selectedTopicName,
            isActive: true,
            ...buildTopicSettingsPayload(form.difficulty),
          },
        });
        topicId = createdTopic._id;
        await queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
      } else {
        await apiRequest<Topic>(`/practice/topics/${topicId}`, {
          method: "PUT",
          body: {
            ...buildTopicSettingsPayload(form.difficulty),
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
      }

      return apiRequest("/practice/questions", {
        method: "POST",
        body: {
          topicId,
          difficulty: form.difficulty,
          questionText: form.questionText,
          pointsReward: form.pointsReward,
          options: form.options.map((text, idx) => ({
            label: String.fromCharCode(65 + idx),
            text,
            isCorrect: String.fromCharCode(65 + idx) === form.correctOption,
          })),
        },
      });
    },
    onSuccess: () => {
      setStatusText("Practice question created successfully.");
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["adminPracticeQuestions", selectedTopicId] });
    },
    onError: (error: Error) => {
      setStatusText(error.message);
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async () => {
      if (!classLevel || !subject || !selectedTopicName) {
        throw new Error("Please select class, subject and topic.");
      }

      if (!csvFile) {
        throw new Error("Please choose a CSV file.");
      }

      const text = await csvFile.text();
      const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));

      if (rows.length < 2) {
        throw new Error("CSV must contain header row and at least one data row.");
      }

      const header = rows[0].map((h) => h.trim());
      const headerMap = new Map<string, number>();
      header.forEach((h, idx) => {
        headerMap.set(canonicalHeader(h), idx);
      });

      const questionIdx = headerMap.get("questiontext") ?? headerMap.get("question");
      const optionAIdx = headerMap.get("optiona");
      const optionBIdx = headerMap.get("optionb");
      const optionCIdx = headerMap.get("optionc");
      const optionDIdx = headerMap.get("optiond");
      const correctOptionIdx = headerMap.get("correctoption");
      const answerIdx = headerMap.get("answer");

      if (
        questionIdx === undefined ||
        optionAIdx === undefined ||
        optionBIdx === undefined ||
        optionCIdx === undefined ||
        optionDIdx === undefined ||
        (correctOptionIdx === undefined && answerIdx === undefined)
      ) {
        throw new Error(
          "Invalid CSV header. Supported formats include: questionText,optionA,optionB,optionC,optionD,correctOption OR Question,Answer,option_a,option_b,option_c,option_d"
        );
      }

      const targetCount = getTargetCount();
      const parsed: CsvParsedQuestion[] = [];
      for (let i = 1; i < rows.length; i += 1) {
        if (targetCount && parsed.length >= targetCount) {
          break;
        }

        const rowNo = i + 1;
        const cells = rows[i];

        const questionText = String(cells[questionIdx] || "").trim();
        const optionA = String(cells[optionAIdx] || "").trim();
        const optionB = String(cells[optionBIdx] || "").trim();
        const optionC = String(cells[optionCIdx] || "").trim();
        const optionD = String(cells[optionDIdx] || "").trim();
        const correctOptionRaw = String(correctOptionIdx !== undefined ? cells[correctOptionIdx] || "" : "").trim();
        const answerRaw = String(answerIdx !== undefined ? cells[answerIdx] || "" : "").trim();

        let correctOption = correctOptionRaw.toUpperCase();
        if (!correctOption && answerRaw) {
          const answerNorm = answerRaw.replace(/\s+/g, "").toLowerCase();
          const choices = [
            ["A", optionA],
            ["B", optionB],
            ["C", optionC],
            ["D", optionD],
          ] as const;
          const matched = choices.find(([, text]) => text.replace(/\s+/g, "").toLowerCase() === answerNorm);
          if (matched) {
            correctOption = matched[0];
          }
        }

        if (!questionText || !optionA || !optionB || !optionC || !optionD) {
          throw new Error(`Row ${rowNo}: questionText and options A-D are required.`);
        }

        if (!["A", "B", "C", "D"].includes(correctOption)) {
          throw new Error(`Row ${rowNo}: correctOption must be A, B, C, or D.`);
        }

        parsed.push({
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption: correctOption as "A" | "B" | "C" | "D",
        });
      }

      if (!parsed.length) {
        throw new Error("No valid questions found in CSV to import.");
      }

      let topicId = selectedTopicId;
      if (!topicId) {
        const createdTopic = await apiRequest<Topic>("/practice/topics", {
          method: "POST",
          body: {
            classLevel,
            subject,
            topicName: selectedTopicName,
            isActive: true,
            ...buildTopicSettingsPayload(form.difficulty),
          },
        });
        topicId = createdTopic._id;
        await queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
      } else {
        await apiRequest<Topic>(`/practice/topics/${topicId}`, {
          method: "PUT",
          body: {
            ...buildTopicSettingsPayload(form.difficulty),
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
      }

      const result = await apiRequest<{ createdCount: number }>("/practice/questions/bulk", {
        method: "POST",
        body: {
          topicId,
          difficulty: form.difficulty,
          pointsReward: form.pointsReward,
          replaceExisting: replaceExistingCsvQuestions,
          count: targetCount,
          questions: parsed,
        },
      });

      return { ...result, topicId, targetCount };
    },
    onSuccess: (result) => {
      setStatusText(
        `CSV import complete. ${result.createdCount} ${form.difficulty.toUpperCase()} question${
          result.createdCount === 1 ? "" : "s"
        } imported${result.targetCount ? ` (count limit: ${result.targetCount})` : ""}.`
      );
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["adminPracticeQuestions", result.topicId] });
      queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
    },
    onError: (error: Error) => {
      setStatusText(error.message || "CSV import failed.");
    },
  });

  const saveTopicSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTopicId) {
        throw new Error("Select an existing topic to save unlock settings.");
      }

      return apiRequest<Topic>(`/practice/topics/${selectedTopicId}`, {
        method: "PUT",
        body: {
          ...buildTopicSettingsPayload(form.difficulty),
        },
      });
    },
    onSuccess: () => {
      setStatusText("Topic unlock settings saved.");
      queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
    },
    onError: (error: Error) => {
      setStatusText(error.message || "Failed to save topic settings.");
    },
  });

  const updateOption = (index: number, value: string) => {
    const next = [...form.options];
    next[index] = value;
    setForm({ ...form, options: next });
  };

  const selectedTopicLabel = useMemo(
    () => topics.find((topic) => topic._id === selectedTopicId)?.topicName || selectedTopicName || "Select topic",
    [topics, selectedTopicId, selectedTopicName]
  );

  if (topicsLoading || syllabusLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Create Practice Questions</h1>
        <p className="text-muted-foreground mt-1">Add questions directly to the live practice bank</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex gap-2">
          <Button
            variant={entryMode === "manual" ? "default" : "outline"}
            className={entryMode === "manual" ? "gradient-primary text-primary-foreground" : ""}
            onClick={() => setEntryMode("manual")}
          >
            Manual Entry
          </Button>
          <Button
            variant={entryMode === "csv" ? "default" : "outline"}
            className={entryMode === "csv" ? "gradient-primary text-primary-foreground" : ""}
            onClick={() => setEntryMode("csv")}
          >
            CSV Upload
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Class</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={classLevel}
              onChange={(e) => {
                setClassLevel(e.target.value);
                setSubject("");
                setSelectedTopicName("");
                setStatusText("");
              }}
            >
              {classLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSelectedTopicName("");
                setStatusText("");
              }}
            >
              <option value="">Select subject</option>
              {subjects.map((subjectName) => (
                <option key={subjectName} value={subjectName}>
                  {subjectName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Topic</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedTopicName}
              onChange={(e) => {
                setSelectedTopicName(e.target.value);
                setStatusText("");
              }}
            >
              <option value="">Select topic</option>
              {syllabusTopicNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {form.difficulty === "easy" ? (
            <div className="space-y-2">
              <Label>Easy -&gt; Medium Unlock (correct count)</Label>
              <Input
                type="number"
                min={1}
                value={easyToMediumUnlockCount}
                onChange={(e) => setEasyToMediumUnlockCount(e.target.value)}
                placeholder="Leave empty = all Easy questions"
              />
            </div>
          ) : null}

          {form.difficulty === "easy" ? (
            <div className="space-y-2">
              <Label>Easy Practice Question Count</Label>
              <Input
                type="number"
                min={1}
                value={practiceCountEasy}
                onChange={(e) => setPracticeCountEasy(e.target.value)}
                placeholder="Leave empty = use all Easy questions"
              />
            </div>
          ) : null}

          {form.difficulty === "medium" ? (
            <div className="space-y-2">
              <Label>Medium -&gt; Hard Unlock (correct count)</Label>
              <Input
                type="number"
                min={1}
                value={mediumToHardUnlockCount}
                onChange={(e) => setMediumToHardUnlockCount(e.target.value)}
                placeholder="Leave empty = all Medium questions"
              />
            </div>
          ) : null}

          {form.difficulty === "medium" ? (
            <div className="space-y-2">
              <Label>Medium Practice Question Count</Label>
              <Input
                type="number"
                min={1}
                value={practiceCountMedium}
                onChange={(e) => setPracticeCountMedium(e.target.value)}
                placeholder="Leave empty = use all Medium questions"
              />
            </div>
          ) : null}

          {form.difficulty === "hard" ? (
            <div className="space-y-2">
              <Label>Hard Practice Question Count</Label>
              <Input
                type="number"
                min={1}
                value={practiceCountHard}
                onChange={(e) => setPracticeCountHard(e.target.value)}
                placeholder="Leave empty = use all Hard questions"
              />
            </div>
          ) : null}

          {form.difficulty === "hard" ? (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm text-muted-foreground">No unlock-setting field is required while creating HARD questions.</p>
            </div>
          ) : null}
        </div>

        {entryMode === "manual" ? (
          <>
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                rows={3}
                value={form.questionText}
                onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                placeholder="Type practice question"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {form.options.map((option, index) => (
                <Input
                  key={index}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                />
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Correct Option</Label>
                <Input
                  value={form.correctOption}
                  onChange={(e) => setForm({ ...form, correctOption: e.target.value as "A" | "B" | "C" | "D" })}
                />
              </div>
              <div className="space-y-2">
                <Label>Points Reward</Label>
                <Input
                  type="number"
                  value={form.pointsReward}
                  onChange={(e) => setForm({ ...form, pointsReward: Number(e.target.value || 0) })}
                />
              </div>
            </div>

            <Button
              onClick={() => {
                setStatusText("");
                if (!classLevel || !subject || !selectedTopicName) {
                  setStatusText("Please select class, subject and topic.");
                  return;
                }

                createMutation.mutate();
              }}
              disabled={createMutation.isPending}
              className="gradient-primary text-primary-foreground"
            >
              <PlusCircle className="w-4 h-4 mr-1" /> {createMutation.isPending ? "Saving..." : "Add Practice Question"}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-2 text-sm">
              <p className="font-semibold">CSV Format (one difficulty per file)</p>
              <p>Use separate CSV files for EASY, MEDIUM, and HARD. Select difficulty above, then upload matching CSV.</p>
              <p className="text-muted-foreground">Supported headers:</p>
              <code className="block text-xs bg-muted p-2 rounded">questionText,optionA,optionB,optionC,optionD,correctOption</code>
              <code className="block text-xs bg-muted p-2 rounded mt-2">Question,Answer,option_a,option_b,option_c,option_d</code>
              <p className="text-muted-foreground">Sample row:</p>
              <code className="block text-xs bg-muted p-2 rounded">What is 2+2?,1,2,3,4,D</code>
              <code className="block text-xs bg-muted p-2 rounded mt-2">What is 2+2?,4,1,2,3,4</code>
              <p className="text-muted-foreground">Only question/options/correct option should be in CSV. Topic, class, subject, difficulty and points come from the widgets on this page.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Points Reward (per question)</Label>
                <Input
                  type="number"
                  value={form.pointsReward}
                  onChange={(e) => setForm({ ...form, pointsReward: Number(e.target.value || 0) })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {form.difficulty === "easy"
                    ? "Easy Questions Count"
                    : form.difficulty === "medium"
                    ? "Medium Questions Count"
                    : "Hard Questions Count"}{" "}
                  (Count Input)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={
                    form.difficulty === "easy"
                      ? practiceCountEasy
                      : form.difficulty === "medium"
                      ? practiceCountMedium
                      : practiceCountHard
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (form.difficulty === "easy") setPracticeCountEasy(val);
                    else if (form.difficulty === "medium") setPracticeCountMedium(val);
                    else setPracticeCountHard(val);
                  }}
                  placeholder="e.g. 10 (leave empty = all)"
                />
              </div>
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            {getTargetCount() ? (
              <p className="text-xs text-primary font-medium">
                Import limit active: Only the first {getTargetCount()} question{getTargetCount() === 1 ? "" : "s"} will be imported from this CSV.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No count limit entered: All valid questions from this CSV will be imported.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={replaceExistingCsvQuestions}
                onChange={(e) => setReplaceExistingCsvQuestions(e.target.checked)}
              />
              Replace existing questions for selected topic + difficulty
            </label>

            <Button
              onClick={() => {
                setStatusText("");
                bulkUploadMutation.mutate();
              }}
              disabled={bulkUploadMutation.isPending}
              className="gradient-primary text-primary-foreground"
            >
              <PlusCircle className="w-4 h-4 mr-1" />{" "}
              {bulkUploadMutation.isPending
                ? "Importing..."
                : getTargetCount()
                ? `Import ${getTargetCount()} ${form.difficulty.toUpperCase()} Questions`
                : `Import ${form.difficulty.toUpperCase()} CSV`}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          disabled={saveTopicSettingsMutation.isPending || !selectedTopicId}
          onClick={() => {
            setStatusText("");
            saveTopicSettingsMutation.mutate();
          }}
        >
          {saveTopicSettingsMutation.isPending
            ? "Saving Settings..."
            : form.difficulty === "easy"
            ? "Save Easy Settings"
            : form.difficulty === "medium"
            ? "Save Medium Settings"
            : "Save Hard Settings"}
        </Button>

        {statusText ? <p className="text-sm text-primary">{statusText}</p> : null}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Live Questions: {classLevel} / {subject || "Subject"} / {selectedTopicLabel}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total {filteredLiveQuestions.length} question{filteredLiveQuestions.length === 1 ? "" : "s"}
              {previewDifficultyFilter !== "all" ? ` (${previewDifficultyFilter.toUpperCase()})` : ""}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-lg border border-border">
            {(["all", "easy", "medium", "hard"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPreviewDifficultyFilter(filter)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  previewDifficultyFilter === filter
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {filter === "all" ? "All" : filter.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {questionListLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading questions...
          </div>
        ) : !existingQuestions.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No questions added for this topic yet.
          </div>
        ) : !filteredLiveQuestions.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No {previewDifficultyFilter.toUpperCase()} questions found for this topic.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedQuestions.map((q, idx) => {
                const questionNumber = (previewPage - 1) * previewPageSize + idx + 1;
                const difficultyBadgeClass =
                  q.difficulty === "easy"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : q.difficulty === "medium"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

                return (
                  <div key={q._id || idx} className="rounded-xl border border-border p-4 bg-background/70 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                          #{questionNumber}
                        </span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {selectedTopicLabel}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full uppercase border font-medium ${difficultyBadgeClass}`}>
                          {q.difficulty}
                        </span>
                      </div>
                      {q.pointsReward !== undefined ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          +{q.pointsReward} pts
                        </span>
                      ) : null}
                    </div>

                    <p className="font-medium text-sm text-foreground">{q.questionText}</p>

                    {Array.isArray(q.options) && q.options.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt: any, optIdx: number) => {
                          const label = opt.label || String.fromCharCode(65 + optIdx);
                          const isCorrect = Boolean(opt.isCorrect);

                          return (
                            <div
                              key={opt._id || optIdx}
                              className={`text-xs p-2 rounded-lg border flex items-center gap-2 ${
                                isCorrect
                                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium"
                                  : "bg-muted/40 border-border/60 text-muted-foreground"
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                  isCorrect
                                    ? "bg-emerald-500 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {label}
                              </span>
                              <span className="flex-1 truncate">{opt.text}</span>
                              {isCorrect ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 font-semibold">
                                  Correct
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/80">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Showing {(previewPage - 1) * previewPageSize + 1} -{" "}
                  {Math.min(previewPage * previewPageSize, filteredLiveQuestions.length)} of{" "}
                  {filteredLiveQuestions.length} questions
                </span>
                <span className="text-border">|</span>
                <label className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    className="h-7 text-xs rounded border border-input bg-background px-1.5"
                    value={previewPageSize}
                    onChange={(e) => {
                      setPreviewPageSize(Number(e.target.value));
                      setPreviewPage(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewPage(1)}
                  disabled={previewPage <= 1}
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage <= 1}
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - previewPage) <= 1;
                    })
                    .map((page, index, array) => {
                      const prev = array[index - 1];
                      const showEllipsis = prev && page - prev > 1;

                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsis ? <span className="px-1 text-xs text-muted-foreground">...</span> : null}
                          <Button
                            variant={previewPage === page ? "default" : "outline"}
                            size="icon"
                            className={`h-8 w-8 text-xs ${
                              previewPage === page ? "gradient-primary text-primary-foreground font-semibold" : ""
                            }`}
                            onClick={() => setPreviewPage(page)}
                          >
                            {page}
                          </Button>
                        </div>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                  disabled={previewPage >= totalPages}
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewPage(totalPages)}
                  disabled={previewPage >= totalPages}
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
