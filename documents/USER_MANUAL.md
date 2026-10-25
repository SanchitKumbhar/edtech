# Focus Flair Platform — User Manual

Welcome to **Focus Flair**, a comprehensive, competitive-examination preparation, live proctoring, adaptive practice, and analytics platform. This manual provides a complete, step-by-step guide for all user roles: **Students**, **Institute Admins**, and **System Admins**.

---

## Table of Contents
1. [Platform Overview & User Roles](#1-platform-overview--user-roles)
2. [Getting Started & Authentication](#2-getting-started--authentication)
3. [Student User Guide](#3-student-user-guide)
   - 3.1 [Student Dashboard](#31-student-dashboard)
   - 3.2 [Joining and Taking a Live Exam](#32-joining-and-taking-a-live-exam)
   - 3.3 [Exam Anti-Cheat Rules & Instructions](#33-exam-anti-cheat-rules--instructions)
   - 3.4 [Performance Analytics, Scorecards & Review](#34-performance-analytics-scorecards--review)
   - 3.5 [Adaptive Practice Mode](#35-adaptive-practice-mode)
   - 3.6 [Previous Year Questions (PYQs)](#36-previous-year-questions-pyqs)
   - 3.7 [Leaderboard & Periodic Rankings](#37-leaderboard--periodic-rankings)
   - 3.8 [Profile, Streaks & Achievement Badges](#38-profile-streaks--achievement-badges)
4. [Admin & Institute User Guide](#4-admin--institute-user-guide)
   - 4.1 [Admin Dashboard & Key Metrics](#41-admin-dashboard--key-metrics)
   - 4.2 [Creating & Scheduling Exams](#42-creating--scheduling-exams)
   - 4.3 [Managing Created Exams](#43-managing-created-exams)
   - 4.4 [Live Exam Monitoring & Anti-Cheat Command Center](#44-live-exam-monitoring--anti-cheat-command-center)
   - 4.5 [Exam Scores & Student Submissions](#45-exam-scores--student-submissions)
   - 4.6 [Practice Question Builder & Bulk CSV Upload](#46-practice-question-builder--bulk-csv-upload)
   - 4.7 [Syllabus & Curriculum Management](#47-syllabus--curriculum-management)
   - 4.8 [Managing PYQ Sets & Question Papers](#48-managing-pyq-sets--question-papers)
   - 4.9 [Notice Board & Announcements](#49-notice-board--announcements)
   - 4.10 [Student Directory & Profiles](#410-student-directory--profiles)
   - 4.11 [Admin Profile Settings](#411-admin-profile-settings)
5. [Troubleshooting & Frequently Asked Questions (FAQ)](#5-troubleshooting--frequently-asked-questions-faq)

---

## 1. Platform Overview & User Roles

Focus Flair supports multi-role operations:
* **Students**: Take scheduled and live proctored exams, engage in adaptive practice drills, review detailed question-by-question scorecards, solve previous year question (PYQ) sets, track performance trends, and earn achievement badges.
* **Institute Admins / Teachers**: Create exams, configure anti-cheat policies, monitor students in real time via live WebSockets, revert false-positive tab switches, upload practice questions in bulk via CSV, publish syllabus topics, and post announcements.
* **Multi-Institute Support**: Students can enter an Institute Code during registration to link directly to their school, coaching institute, or college.

---

## 2. Getting Started & Authentication

### 2.1 Account Registration
1. Navigate to the portal homepage and click **Create Account** or visit `/register`.
2. Select your account type:
   - **Student Account**: Enter your Full Name, Email, Password, Class Level (e.g., Class 11, Class 12, Dropper), Target Exam (e.g., JEE Main, NEET, GATE), and optional **Institute Code**.
   - **New Institute (Admin Account)**: Enter the Institute Name, preferred Institute Code (e.g., `FIITJEE01`), Admin Name, Email, and Password.
3. Click **Create Account** (or **Register Institute & Admin Account**). Upon successful creation, you are automatically logged in and redirected to your dedicated portal.

### 2.2 Logging In
1. Visit `/login`.
2. Enter your registered email address and password.
3. The platform verifies your credentials, generates a secure JWT token, and seamlessly routes you to `/student/dashboard` or `/admin` based on your assigned role.

---

## 3. Student User Guide

### 3.1 Student Dashboard
Upon logging in, you are greeted with your preparation summary:
* **Key Metric Cards**: Total Points earned, Average Accuracy %, Exams Attempted, and Current Streak in days.
* **Leaderboard Preview**: Top 5 ranking peers with point totals; click **Full rankings** to view the complete leaderboard.
* **Notice Board**: High-priority announcements pinned by institute administrators.
* **Quick Actions**: One-click navigation to Start Practice, View Analytics, or open the PYQ Section.
* **Practice by Topic**: Overview cards showing mastery and accuracy percentages for active syllabus topics.

### 3.2 Joining and Taking a Live Exam
1. Navigate to **Exams** in the sidebar (`/student/exam/instructions`).
2. **Enter Exam Code**: Type the unique alphanumeric Exam Code provided by your instructor (e.g., `JEE2024-T1`) and click **Verify Code**.
3. **Exam Summary**: The screen verifies the code and displays Title, Duration (e.g., 180 mins), Total Questions, Marking Scheme (+4 / -1), and specific guidelines.
4. Check the declaration box: *"I have read and understood all the instructions above and agree to follow the examination code of conduct."*
5. Click **Start Exam Now**. You will be redirected to the full-screen examination environment (`/exam/live?sessionId=...`).

### 3.3 Exam Anti-Cheat Rules & Instructions
The live exam runs inside a strict proctoring sandbox:
* **Tab-Switch Detection**: Leaving the exam tab, minimizing the browser window, or switching applications triggers an immediate anti-cheat alert.
* **Warning Limit**: You are allowed up to **3 warnings**. Each tab switch logs an event with the proctor.
* **Auto-Submission**: On the 4th tab switch, the test is **automatically locked and submitted** to prevent malpractice.
* **Navigation Palette**: 
  - Color-coded question numbers: **Green** (Answered), **Red** (Visited & Unanswered), **Purple** (Marked for Review), **Gray** (Not Visited).
  - Click **Clear Response** to reset an option.
  - Click **Mark for Review & Next** to flag questions you want to reconsider.
* **Submitting the Exam**: Once finished, click **Submit Exam**. An instant score is confirmed, and your detailed analytics are queued for processing.

### 3.4 Performance Analytics, Scorecards & Review
Navigate to **Analytics** (`/student/analytics`):
1. **Performance Trend Chart**: A chronological timeline graphing your scores and accuracy percentages across submitted exams.
2. **Topic Accuracy Bar Chart**: Visualizes topic-wise strengths and weaknesses across all syllabus areas.
3. **Focus Topics Alert**: Dynamically lists weak topics (accuracy < 60%) where additional practice is recommended.
4. **Exam Scorecard & Attempt History**:
   - Lists every submitted exam with Exam Code, Submission Date, Score Obtained / Max Marks, Accuracy %, and Percentile.
   - Click **Scorecard** on any row to open the **Detailed Question Review Modal**.
   - Filter questions by **All**, **Correct**, **Incorrect**, or **Skipped**.
   - Inspect the exact question text, your chosen option, the verified correct option, marks awarded/deducted, and the comprehensive step-by-step explanation.

### 3.5 Adaptive Practice Mode
Navigate to **Practice** (`/student/practice`):
1. Select your **Class Level** and **Subject**.
2. Click on any active **Topic** card (e.g., *Thermodynamics*, *Rotational Dynamics*).
3. **Adaptive Progression**:
   - Practice begins on **Easy** difficulty.
   - As you correctly solve the required threshold of questions, the system unlocks **Medium** and **Hard** levels automatically.
4. **Streak Bonus**: Consecutive correct answers multiply your point rewards.
5. Instant feedback is displayed after every question attempt.

### 3.6 Previous Year Questions (PYQs)
Navigate to **PYQ** (`/student/pyq`):
1. Filter papers by **Exam Year** and **Exam Name** (e.g., JEE Main, NEET, GATE).
2. Each paper card details the subject, duration, question count, and brief syllabus coverage.
3. Click **Open PDF**:
   - Directly opens the official PDF question paper in a new tab for reading and revision. That's it!

### 3.7 Leaderboard & Periodic Rankings
Navigate to **Leaderboard** (`/student/leaderboard`):
* Toggle between **Weekly**, **Monthly**, and **All Time** tabs.
* **Podium**: Top 3 students are showcased with podium highlights and gold/silver/bronze medals.
* **Rank List**: View ranks, student names, and total verified points scored.

### 3.8 Profile, Streaks & Achievement Badges
Navigate to **Profile** (`/student/profile`):
* View your Total Points, Badges Count, Streak Days, and Current Level.
* Click **Edit Profile** to update your Full Name or Avatar URL.
* **Badges & Achievements Showcase**:
  - Displays all achievable badges (e.g., *Exam Novice*, *Century Club*, *Sharp Shooter*, *Streak Warrior*, *Practice Champion*, *Topic Conqueror*).
  - Unlocked badges display the date earned, colorful achievement icons, and points awarded.
  - Locked badges display exact qualifying criteria.

---

## 4. Admin & Institute User Guide

### 4.1 Admin Dashboard & Key Metrics
Navigate to `/admin`:
* **Live KPI Counters**: Total Registered Students, Active Live Exams, and Ongoing Live Sessions.
* **Quick Action Toolbar**: Instant shortcuts to Create Exam, View Exam Scores, Create Practice Questions, Quick CSV Upload, and Post Notice.
* **Recent Exams Table**: Real-time overview of recently created exams, current status (Draft, Scheduled, Live, Completed), and durations.

### 4.2 Creating & Scheduling Exams
1. Click **Create Exam** (`/admin/create-exam`).
2. Fill in the exam metadata:
   - **Exam Title**: e.g., *"JEE Main Full Mock Test #04"*
   - **Class Level**: Select Class 11, Class 12, or Dropper.
   - **Exam Type**: Mock, Unit Test, or Practice.
   - **Duration**: Duration in minutes (e.g., 180).
   - **Schedule**: Optional Start Date/Time and End Date/Time.
   - **Instructions & Anti-Cheat Warnings**: Rules presented to students before starting.
3. **Add Questions**:
   - Select Subject and Syllabus Topic.
   - Enter Question Text.
   - Enter Options A, B, C, D and mark the Correct Option.
   - Set Marks (+4) and Negative Marks (1).
   - Click **Add Question to Exam**.
4. Click **Publish & Schedule Exam** or **Save as Draft**.
5. The system generates a unique **Exam Code** (e.g., `EXAM-ABC1234`). Share this code with your examinees.

### 4.3 Managing Created Exams
Navigate to **Exams** (`/admin/exams`):
* View count summaries: All, Draft, Scheduled, Live, Completed, and Archived.
* Search exams by title, exam code, class level, or exam type.
* Filter by status to track upcoming schedules or archive past examinations.

### 4.4 Live Exam Monitoring & Anti-Cheat Command Center
Navigate to **Monitoring** (`/admin/monitoring`):
1. Select the live exam from the dropdown.
2. The command center establishes a real-time WebSocket connection to the server.
3. **Active Examinees Grid**:
   - Shows all students currently taking the test.
   - Displays real-time **Tab-Switch Counters** and **Warning Badges**.
4. **Auto-Submitted Sessions**:
   - Lists students who exceeded the 3-warning limit and were auto-submitted by the proctoring engine.
   - **Revert Submission Button**: In case of a proven technical glitch or false positive, click **Revert Submission**. The student's session is instantly restored to *Active*, allowing them to resume taking the exam immediately.
5. **Real-time Incident Feed**:
   - Live stream of student focus events (e.g., *"Student A switched tab / minimized window at 10:14 AM - Severity High"*).

### 4.5 Exam Scores & Student Submissions
Navigate to **Exam Scores** (`/admin/exam-scores`):
* Filter submissions by specific Exam or view all exams.
* Displays Student Name, Email, Score Obtained, Accuracy %, and exact Submission Timestamp.

### 4.6 Practice Question Builder & Bulk CSV Upload
Navigate to **Create Practice** (`/admin/create-practice`) or click **Upload Questions** on the Dashboard:
* **Single Question Creation**: Specify Class, Subject, Topic, Difficulty (Easy, Medium, Hard), Question Text, Options, and Points Reward.
* **Bulk CSV Upload**:
  - Drag-and-drop or paste standard CSV rows formatted as:
    ```csv
    Question,Option A,Option B,Option C,Option D,Correct
    "What is the SI unit of electric current?","Volt","Ampere","Ohm","Watt",B
    ```
  - Click **Upload Questions** to parse and save dozens of questions instantly.

### 4.7 Syllabus & Curriculum Management
Navigate to **Syllabus** (`/admin/syllabus`):
* Create and manage the syllabus hierarchy: **Class Level** → **Subject** → **Topic Name**.
* Topics created here automatically populate the question builder dropdowns and practice engine.

### 4.8 Managing PYQ Sets & Question Papers
Navigate to **PYQ Papers** (`/admin/pyq`):
* Click **Add PYQ Set** to create past-year papers with title, exam name, year, duration, and external portal URLs.
* Toggle the **Publish/Unpublish** status to control visibility for students.
* Click **Delete** to retire outdated question sets.

### 4.9 Notice Board & Announcements
Navigate to **Notices** (`/admin/notices`):
1. Enter the Notice Title and Announcement Body.
2. Choose **Target Audience**: Students Only, Admins Only, or All Users.
3. Toggle **Pin Notice** to keep it at the top of the feed.
4. Optional: Set Publish Date and Expiry Date.
5. Click **Post Notice**. Announcements appear instantly on the student dashboard.

### 4.10 Student Directory & Profiles
Navigate to **Students** (`/admin/students`):
* Search and view all enrolled students by name or email.
* Click **View Profile** to inspect a student's total points, level, streak, accuracy, and practice attempt history.

### 4.11 Admin Profile Settings
Navigate to **Profile** (`/admin/profile`):
* Update your Full Name, Phone Number, Designation, and Institute Name.
* Changes persist across the multi-tenant database.

---

## 5. Troubleshooting & Frequently Asked Questions (FAQ)

### Q1: What happens if a student accidentally switches tabs during an exam?
> **Answer**: The anti-cheat proctor displays an in-exam warning banner. The student has up to 3 warnings. On the 4th violation, the exam auto-submits. If the teacher determines the incident was accidental, the teacher can go to `/admin/monitoring` and click **Revert Submission** to restore the student's session.

### Q2: What happens if internet connectivity drops during an exam?
> **Answer**: All individual question choices are autosaved to the database the moment an option is clicked. If the browser disconnects or reloads, the student can reopen the exam using the session link (`/exam/live?sessionId=...`), and all previous answers and remaining time will be restored from the server.

### Q3: How are points and leaderboard ranks calculated?
> **Answer**: 
> - Correct exam answers award positive marks configured by the exam creator.
> - Practice mode awards base points (Easy: 15, Medium: 25, Hard: 40) plus streak multipliers.
> - Achievement badges award bonus points upon unlocking.
> - The leaderboard ranks students based on cumulative verified points.

### Q4: Which browsers are supported?
> **Answer**: Focus Flair is optimized for modern Chromium-based browsers (Google Chrome, Microsoft Edge, Brave) as well as Mozilla Firefox and Apple Safari on desktop and laptop devices.
