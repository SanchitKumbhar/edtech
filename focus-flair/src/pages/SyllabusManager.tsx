import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

type SyllabusTopic = {
  _id: string;
  classLevel: string;
  subject: string;
  topicName: string;
  isActive?: boolean;
};

export default function SyllabusManager() {
  const queryClient = useQueryClient();
  const [classLevel, setClassLevel] = useState("Class 11");
  const [subject, setSubject] = useState("");
  const [topicName, setTopicName] = useState("");
  const [statusText, setStatusText] = useState("");

  const { data: classLevels = [], isLoading: classesLoading } = useQuery<string[]>({
    queryKey: ["syllabusClasses"],
    queryFn: () => apiRequest<string[]>("/syllabus/classes"),
  });

  const { data: syllabusTopics = [], isLoading: topicsLoading } = useQuery<SyllabusTopic[]>({
    queryKey: ["syllabusTopics", classLevel],
    queryFn: () => apiRequest<SyllabusTopic[]>(`/syllabus/topics?classLevel=${encodeURIComponent(classLevel)}`),
    enabled: Boolean(classLevel),
  });

  const subjects = useMemo(
    () => Array.from(new Set(syllabusTopics.map((topic) => topic.subject))).sort(),
    [syllabusTopics]
  );

  const filteredTopics = useMemo(
    () => syllabusTopics.filter((topic) => !subject || topic.subject === subject),
    [syllabusTopics, subject]
  );

  const createTopicMutation = useMutation({
    mutationFn: () =>
      apiRequest<SyllabusTopic>("/syllabus/topics", {
        method: "POST",
        body: {
          classLevel,
          subject,
          topicName,
        },
      }),
    onSuccess: () => {
      setStatusText("Syllabus item added successfully.");
      setTopicName("");
      queryClient.invalidateQueries({ queryKey: ["syllabusClasses"] });
      queryClient.invalidateQueries({ queryKey: ["syllabusTopics", classLevel] });
      queryClient.invalidateQueries({ queryKey: ["practiceTopics", classLevel, subject] });
    },
    onError: (error: Error) => {
      setStatusText(error.message || "Failed to add syllabus item");
    },
  });

  if (classesLoading || topicsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Syllabus Manager</h1>
        <p className="text-muted-foreground mt-1">
          Add class, subject and topic entries for exams and practice builders.
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <select
              value={classLevel}
              onChange={(e) => {
                setClassLevel(e.target.value);
                setSubject("");
                setStatusText("");
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
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setStatusText("");
              }}
              list="existing-subjects"
              placeholder="e.g., Physics"
            />
            <datalist id="existing-subjects">
              {subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Topic</Label>
          <Input
            value={topicName}
            onChange={(e) => {
              setTopicName(e.target.value);
              setStatusText("");
            }}
            placeholder="e.g., Kinematics"
          />
        </div>

        <Button
          className="gradient-primary text-primary-foreground"
          disabled={createTopicMutation.isPending}
          onClick={() => {
            if (!classLevel || !subject.trim() || !topicName.trim()) {
              setStatusText("Please enter class, subject and topic.");
              return;
            }

            setStatusText("");
            createTopicMutation.mutate();
          }}
        >
          <PlusCircle className="w-4 h-4 mr-1" />
          {createTopicMutation.isPending ? "Adding..." : "Add To Syllabus"}
        </Button>

        {statusText ? <p className="text-sm text-primary">{statusText}</p> : null}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-3">
          Existing Topics: {classLevel} {subject ? `/ ${subject}` : ""}
        </h2>

        {!filteredTopics.length ? (
          <p className="text-sm text-muted-foreground">No syllabus topics found for this filter.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTopics.map((topic) => (
              <div key={topic._id} className="rounded-lg border border-border/70 p-3 bg-card/70">
                <p className="text-sm font-medium">{topic.topicName}</p>
                <p className="text-xs text-primary mt-1">{topic.classLevel} | {topic.subject}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
