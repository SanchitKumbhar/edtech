import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import ExamInstructions from "./pages/ExamInstructions";
import ExamLive from "./pages/ExamLive";
import PracticeMode from "./pages/PracticeMode";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import PYQSection from "./pages/PYQSection";
import Leaderboard from "./pages/Leaderboard";
import StudentProfile from "./pages/StudentProfile";
import AdminDashboard from "./pages/AdminDashboard";
import CreateExam from "./pages/CreateExam";
import AdminExams from "./pages/AdminExams";
import LiveMonitoring from "./pages/LiveMonitoring";
import StudentManagement from "./pages/StudentManagement";
import AdminProfile from "./pages/AdminProfile";
import PracticeQuestionBuilder from "./pages/PracticeQuestionBuilder";
import SyllabusManager from "./pages/SyllabusManager";
import PostNotice from "./pages/PostNotice";

import AdminExamScores from "./pages/AdminExamScores";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Exam Live is full-screen, outside layout */}
          <Route path="/exam/live" element={<ExamLive />} />
          
          <Route element={<ProtectedRoute allowedRoles={["student", "admin"]} />}>
            <Route element={<AppLayout />}>
              <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/exam/instructions" element={<ExamInstructions />} />
                <Route path="/student/practice" element={<PracticeMode />} />
                <Route path="/student/analytics" element={<PerformanceAnalytics />} />
                <Route path="/student/pyq" element={<PYQSection />} />
                <Route path="/student/leaderboard" element={<Leaderboard />} />
                <Route path="/student/profile" element={<StudentProfile />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/exams" element={<AdminExams />} />
                <Route path="/admin/create-exam" element={<CreateExam />} />
                <Route path="/admin/create-practice" element={<PracticeQuestionBuilder />} />
                <Route path="/admin/syllabus" element={<SyllabusManager />} />
                <Route path="/admin/notices" element={<PostNotice />} />
                <Route path="/admin/post-notice" element={<PostNotice />} />
                <Route path="/admin/monitoring" element={<LiveMonitoring />} />
                <Route path="/admin/students" element={<StudentManagement />} />
                <Route path="/admin/profile" element={<AdminProfile />} />
                <Route path="/admin/exam-scores" element={<AdminExamScores />} />
              </Route>
            </Route>
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
