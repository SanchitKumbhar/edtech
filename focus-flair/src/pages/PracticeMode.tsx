import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Target } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Difficulty = "easy" | "medium" | "hard";

type Topic = {
  _id: string;
  classLevel?: string;
  subject?: string;
  topicName: string;
};

type TopicStat = {
  _id: string;
  topicId?: { _id: string; topicName: string };
  masteryPct: number;
  accuracyPct: number;
  solvedCount: number;
  totalAttempted: number;
};

type PracticeQuestion = {
  _id: string;
  topicId: string;
  difficulty: Difficulty;
  questionText: string;
  pointsReward?: number;
  options: Array<{ _id: string; label: "A" | "B" | "C" | "D"; text: string }>;
};

type PracticeAnalysis = {
  currentCorrectStreak: number;
  bestCorrectStreak: number;
  avgCorrectStreak: number;
  totalAttempts: number;
  totalCorrect: number;
  practicePointsTotal: number;
  leaderboardPointsTotal: number;
};

type PracticeStatsResponse = {
  topicStats: TopicStat[];
  analysis: PracticeAnalysis;
};

type AttemptResponse = {
  attempt: { isCorrect: boolean; pointsEarned: number };
  streak: { current: number; best: number; average: number };
  points: {
    basePoints: number;
    streakBonusPoints: number;
    totalAwarded: number;
    leaderboardTotal: number;
  };
  difficultyProgress?: DifficultyProgress;
  newlyUnlocked?: Difficulty[];
  newlyCleared?: Difficulty[];
  shouldAdvanceToDifficulty?: Difficulty | null;
};

type DifficultyProgressItem = {
  unlocked: boolean;
  completed: boolean;
  totalQuestions: number;
  correctQuestions: number;
  requiredCorrectToUnlockNext?: number;
  unlockRule?: string;
  selectedQuestionCount?: number;
  configuredQuestionCount?: number;
};

type DifficultyProgress = Record<Difficulty, DifficultyProgressItem>;

type UnlockStatusResponse = {
  topicId: string;
  topicName: string;
  difficultyProgress: DifficultyProgress;
};

export default function PracticeMode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [classLevel, setClassLevel] = useState<string>("Class 11");
  const [subject, setSubject] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [attemptRound, setAttemptRound] = useState(1);
  const [liveStreak, setLiveStreak] = useState<{ current: number; best: number; average: number } | null>(null);

  const { data: classLevels = [] } = useQuery<string[]>({
    queryKey: ["syllabusClasses"],
    queryFn: () => apiRequest<string[]>("/syllabus/classes"),
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery<Topic[]>({
    queryKey: ["practiceTopics", classLevel],
    queryFn: () => apiRequest<Topic[]>(`/practice/topics?classLevel=${encodeURIComponent(classLevel)}`),
    enabled: Boolean(classLevel),
  });

  const { data: statsResponse, isLoading: statsLoading } = useQuery<PracticeStatsResponse>({
    queryKey: ["practiceStats"],
    queryFn: () => apiRequest<PracticeStatsResponse>("/practice/stats/me"),
  });

  const topicStats = statsResponse?.topicStats || [];
  const analysis = statsResponse?.analysis;

  const subjects = useMemo(
    () => Array.from(new Set(topics.map((t) => t.subject).filter(Boolean) as string[])).sort(),
    [topics]
  );

  const filteredTopics = useMemo(
    () => topics.filter((t) => !subject || t.subject === subject),
    [topics, subject]
  );

  const activeTopicId = selectedTopicId || filteredTopics[0]?._id || "";

  const { data: unlockStatus } = useQuery<UnlockStatusResponse>({
    queryKey: ["practiceUnlockStatus", activeTopicId],
    queryFn: () => apiRequest<UnlockStatusResponse>(`/practice/topics/${activeTopicId}/unlock-status`),
    enabled: Boolean(activeTopicId),
  });

  const difficultyProgress = unlockStatus?.difficultyProgress;
  const isDifficultyUnlocked = (d: Difficulty) => {
    if (!difficultyProgress) return d === "easy";
    return Boolean(difficultyProgress[d]?.unlocked);
  };
  const visibleDifficulties = (difficultyProgress
    ? (["easy", "medium", "hard"] as const).filter((d) => isDifficultyUnlocked(d))
    : (["easy"] as const));

  useEffect(() => {
    if (!classLevels.length) return;
    if (classLevels.includes(classLevel)) return;
    setClassLevel(classLevels[0]);
  }, [classLevels, classLevel]);

  useEffect(() => {
    if (!selectedTopicId) return;
    const exists = filteredTopics.some((t) => t._id === selectedTopicId);
    if (!exists) {
      setSelectedTopicId("");
    }
  }, [filteredTopics, selectedTopicId]);

  useEffect(() => {
    if (!activeTopicId) return;
    if (isDifficultyUnlocked(difficulty)) return;
    setDifficulty("easy");
  }, [activeTopicId, difficulty, difficultyProgress]);

  const { data: questions = [], isLoading: questionsLoading } = useQuery<PracticeQuestion[]>({
    queryKey: ["practiceQuestions", activeTopicId, difficulty, attemptRound],
    queryFn: () => apiRequest<PracticeQuestion[]>(`/practice/topics/${activeTopicId}/questions?difficulty=${difficulty}`),
    enabled: Boolean(activeTopicId && isDifficultyUnlocked(difficulty)),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  });

  const currentQuestion = questions[questionIndex];

  useEffect(() => {
    if (!questions.length) {
      if (questionIndex !== 0) {
        setQuestionIndex(0);
      }
      return;
    }

    if (questionIndex > questions.length - 1) {
      setQuestionIndex(questions.length - 1);
    }
  }, [questions, questionIndex]);

  useEffect(() => {
    setQuestionIndex(0);
    setAttemptRound(1);
    setSelectedOptionId("");
    setFeedback("");
  }, [activeTopicId, difficulty]);

  const submitAttemptMutation = useMutation({
    mutationFn: () =>
      apiRequest<AttemptResponse>("/practice/attempts", {
        method: "POST",
        body: {
          topicId: activeTopicId,
          practiceQuestionId: currentQuestion?._id,
          selectedOptionId,
        },
      }),
    onSuccess: (res) => {
      setLiveStreak(res.streak);

      const currentProgress = res.difficultyProgress?.[difficulty];
      const clearedCount = currentProgress?.correctQuestions ?? 0;
      const targetCount = currentProgress?.requiredCorrectToUnlockNext ?? currentProgress?.totalQuestions ?? 0;

      setFeedback(
        res.attempt.isCorrect
          ? `Correct! +${res.points.totalAwarded} pts (Base ${res.points.basePoints} + Streak bonus ${res.points.streakBonusPoints}). Cleared: ${clearedCount}/${targetCount} ${difficulty.toUpperCase()} questions.`
          : `Incorrect. Keep practicing! Cleared: ${clearedCount}/${targetCount} ${difficulty.toUpperCase()} questions.`
      );
      setSelectedOptionId("");
      const nextIndex = questionIndex + 1;
      if (questions.length > 0 && nextIndex >= questions.length) {
        setAttemptRound((r) => r + 1);
        setQuestionIndex(0);
      } else {
        setQuestionIndex((idx) => {
          if (!questions.length) return idx;
          return Math.min(idx + 1, questions.length - 1);
        });
      }
      queryClient.invalidateQueries({ queryKey: ["practiceStats"] });
      queryClient.invalidateQueries({ queryKey: ["practiceUnlockStatus", activeTopicId] });

      if (res.newlyCleared?.length) {
        res.newlyCleared.forEach((level) => {
          const next = level === "easy" ? "MEDIUM" : level === "medium" ? "HARD" : null;
          toast({
            title: `${level.toUpperCase()} cleared!`,
            description: next
              ? `You've cleared the required ${level.toUpperCase()} questions. Advancing to ${next}!`
              : "Excellent! You cleared all configured questions for this topic.",
          });
        });
      }

      if (res.newlyUnlocked?.length) {
        res.newlyUnlocked.forEach((level) => {
          toast({
            title: `${level.toUpperCase()} unlocked`,
            description: `You can now practice ${level.toUpperCase()} questions for this topic.`,
          });
        });
      }

      // Check condition to move to next difficulty level based ONLY on cleared questions count:
      const nextLevel =
        difficulty === "easy" &&
        (res.shouldAdvanceToDifficulty === "medium" ||
          res.difficultyProgress?.easy?.completed ||
          res.newlyCleared?.includes("easy") ||
          res.newlyUnlocked?.includes("medium"))
          ? "medium"
          : difficulty === "medium" &&
            (res.shouldAdvanceToDifficulty === "hard" ||
              res.difficultyProgress?.medium?.completed ||
              res.newlyCleared?.includes("medium") ||
              res.newlyUnlocked?.includes("hard"))
          ? "hard"
          : null;

      if (nextLevel) {
        setDifficulty(nextLevel);
        setAttemptRound(1);
        setQuestionIndex(0);
        setSelectedOptionId("");
        toast({
          title: `Moving to ${nextLevel.toUpperCase()}`,
          description: `Target cleared questions reached! Now practicing ${nextLevel.toUpperCase()} questions.`,
        });
        return;
      }
    },
    onError: (error: Error) => {
      setFeedback(error.message);
      toast({
        title: "Cannot submit attempt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectDifficulty = (next: Difficulty) => {
    if (!isDifficultyUnlocked(next)) {
      const rule = difficultyProgress?.[next]?.unlockRule || "Clear the required number of questions from previous level.";
      toast({
        title: `${next.toUpperCase()} is locked`,
        description: rule,
        variant: "destructive",
      });
      return;
    }

    setDifficulty(next);
    setSelectedOptionId("");
    setFeedback("");
  };

  const totalSolved = topicStats.reduce((sum, s) => sum + (s.solvedCount || 0), 0);
  const avgAccuracy = topicStats.length
    ? Math.round(topicStats.reduce((sum, s) => sum + (s.accuracyPct || 0), 0) / topicStats.length)
    : 0;

  const currentStreak = liveStreak?.current ?? analysis?.currentCorrectStreak ?? 0;
  const bestStreak = liveStreak?.best ?? analysis?.bestCorrectStreak ?? 0;
  const avgStreak = liveStreak?.average ?? analysis?.avgCorrectStreak ?? 0;

  const statByTopicId = useMemo(() => {
    const map = new Map<string, TopicStat>();
    topicStats.forEach((s) => {
      if (s.topicId?._id) {
        map.set(s.topicId._id, s);
      }
    });
    return map;
  }, [topicStats]);

  if (topicsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Practice Mode</h1>
        <p className="text-muted-foreground mt-1">Live topic-wise practice from your question bank</p>
      </div>

      <div className="glass-card rounded-xl p-5 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Solved Questions</p>
          <p className="text-2xl font-bold">{totalSolved}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Average Accuracy</p>
          <p className="text-2xl font-bold">{avgAccuracy}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Easy Cleared</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {difficultyProgress?.easy.correctQuestions || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Medium Cleared</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {difficultyProgress?.medium.correctQuestions || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Hard Cleared</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {difficultyProgress?.hard.correctQuestions || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Streak Bonus</p>
          <p className="text-2xl font-bold">{currentStreak}x</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={classLevel}
          onChange={(e) => {
            setClassLevel(e.target.value);
            setSubject("");
            setSelectedTopicId("");
            setSelectedOptionId("");
            setFeedback("");
          }}
        >
          {classLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setSelectedTopicId("");
            setSelectedOptionId("");
            setFeedback("");
          }}
        >
          <option value="">Select Subject</option>
          {subjects.map((subjectName) => (
            <option key={subjectName} value={subjectName}>
              {subjectName}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedTopicId}
          onChange={(e) => {
            setSelectedTopicId(e.target.value);
            setSelectedOptionId("");
            setFeedback("");
          }}
        >
          <option value="">Select Topic</option>
          {filteredTopics.map((topic) => (
            <option key={topic._id} value={topic._id}>
              {topic.topicName}
            </option>
          ))}
        </select>

        {visibleDifficulties.map((d) => (
          <Button
            key={d}
            variant={difficulty === d ? "default" : "outline"}
            onClick={() => selectDifficulty(d)}
            className={difficulty === d ? "gradient-primary text-primary-foreground" : ""}
          >
            {d.toUpperCase()}
          </Button>
        ))}
      </div>

      {activeTopicId && difficultyProgress ? (
        <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Level Progression (Based on Cleared Questions)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Streaks grant bonus points; difficulty progression only requires clearing the target number of questions.
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border/60 bg-card/60 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> EASY Progress
                </span>
                <span className="font-semibold">
                  {difficultyProgress.easy.correctQuestions} / {difficultyProgress.easy.requiredCorrectToUnlockNext || difficultyProgress.easy.totalQuestions || 0} Cleared
                </span>
              </div>
              <Progress
                value={
                  difficultyProgress.easy.requiredCorrectToUnlockNext
                    ? Math.min(100, (difficultyProgress.easy.correctQuestions / difficultyProgress.easy.requiredCorrectToUnlockNext) * 100)
                    : 100
                }
                className="h-2"
              />
              <p className="text-[11px] text-muted-foreground">
                {difficultyProgress.easy.completed
                  ? "✓ Target reached! MEDIUM difficulty unlocked."
                  : `Clear ${Math.max(0, (difficultyProgress.easy.requiredCorrectToUnlockNext || 0) - difficultyProgress.easy.correctQuestions)} more Easy question(s) to advance to Medium.`}
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-card/60 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> MEDIUM Progress
                </span>
                <span className="font-semibold">
                  {difficultyProgress.medium.correctQuestions} / {difficultyProgress.medium.requiredCorrectToUnlockNext || difficultyProgress.medium.totalQuestions || 0} Cleared
                </span>
              </div>
              <Progress
                value={
                  difficultyProgress.medium.requiredCorrectToUnlockNext
                    ? Math.min(100, (difficultyProgress.medium.correctQuestions / difficultyProgress.medium.requiredCorrectToUnlockNext) * 100)
                    : 100
                }
                className="h-2"
              />
              <p className="text-[11px] text-muted-foreground">
                {!difficultyProgress.medium.unlocked
                  ? "Locked. Clear required Easy questions first."
                  : difficultyProgress.medium.completed
                  ? "✓ Target reached! HARD difficulty unlocked."
                  : `Clear ${Math.max(0, (difficultyProgress.medium.requiredCorrectToUnlockNext || 0) - difficultyProgress.medium.correctQuestions)} more Medium question(s) to advance to Hard.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTopics.map((topic) => {
          const stat = statByTopicId.get(topic._id);
          return (
            <button
              key={topic._id}
              onClick={() => setSelectedTopicId(topic._id)}
              className={`stat-card space-y-4 text-left ${activeTopicId === topic._id ? "border border-primary/40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{topic.topicName}</p>
                  <p className="text-xs text-muted-foreground">{topic.subject || "General"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Mastery</span>
                    <span className="font-medium">{Math.round(stat?.masteryPct || 0)}%</span>
                  </div>
                  <Progress value={Math.round(stat?.masteryPct || 0)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium">{Math.round(stat?.accuracyPct || 0)}%</span>
                  </div>
                  <Progress value={Math.round(stat?.accuracyPct || 0)} className="h-2" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4 border-primary/15 bg-primary/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Live Practice Question</h2>
            <p className="text-sm text-muted-foreground">
              {filteredTopics.find((t) => t._id === activeTopicId)?.topicName || "Select topic"} - {difficulty.toUpperCase()}
            </p>
          </div>
          <Badge className="bg-success/10 text-success border-success/20">
            <Target className="w-3 h-3 mr-1" /> Real-time scoring
          </Badge>
        </div>

        {questionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading question...
          </div>
        ) : !isDifficultyUnlocked(difficulty) ? (
          <p className="text-sm text-warning">
            {difficulty.toUpperCase()} is locked. {difficultyProgress?.[difficulty]?.unlockRule || "Clear the required number of questions from the previous level to unlock."}
          </p>
        ) : !questions.length ? (
          <p className="text-sm text-muted-foreground">No question available for this topic and difficulty.</p>
        ) : (
          <>
            <div className="rounded-xl bg-background/80 border border-border/60 p-4">
              <p className="text-sm md:text-base font-medium leading-relaxed">{currentQuestion.questionText}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option._id}
                  onClick={() => setSelectedOptionId(option._id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedOptionId === option._id
                      ? "border-success bg-success/10 text-success"
                      : "border-border hover:border-primary/40 hover:bg-muted/60"
                  }`}
                >
                  <span className="text-sm font-medium">{option.label}. {option.text}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="gradient-success text-primary-foreground"
                disabled={!selectedOptionId || submitAttemptMutation.isPending}
                onClick={() => {
                  setFeedback("");
                  submitAttemptMutation.mutate();
                }}
              >
                {submitAttemptMutation.isPending ? "Checking..." : "Check Answer"}
              </Button>
            </div>

            {feedback ? <p className="text-sm text-primary">{feedback}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
