# D2 Flow Diagram - Student Exam Preparation Portal

```d2
direction: down
theme: {
  N1: {
    primary_color: "#0369a1"
    secondary_color: "#e8f4f8"
  }
}

# ============ COLOR SCHEME WITH ICONS ============
classes: {
  public: {
    fill: "#0F766E"
    stroke: "#0D9488"
    color: "#ffffff"
    font-size: 13
  }
  student: {
    fill: "#059669"
    stroke: "#10B981"
    color: "#ffffff"
    font-size: 13
  }
  admin: {
    fill: "#CA8A04"
    stroke: "#FBBF24"
    color: "#ffffff"
    font-size: 13
  }
  database: {
    fill: "#7C3AED"
    stroke: "#A78BFA"
    color: "#ffffff"
    font-size: 12
  }
}

# ============ PUBLIC LAYER ============
node_home: "Home" {
  class: public
}

node_login: "Login / Register" {
  class: public
}

node_role: "Select Role" {
  class: public
}

# ============ STUDENT LAYER ============
node_student_dash: "Student Dashboard" {
  class: student
  tooltip: "Stats, Exams, Practice Topics, Announcements"
}

node_exam_flow: "Exam Flow" {
  class: student
  tooltip: "Instructions > Live > Results"
}

node_exam_instr: "Instructions & Rules" {
  class: student
}

node_exam_live: "Live Exam - Full Screen" {
  class: student
}

node_exam_result: "Results & Analytics" {
  class: student
}

node_practice: "Practice Questions" {
  class: student
  tooltip: "Topic-wise, Easy/Medium/Hard"
}

node_analytics: "Performance Analytics" {
  class: student
}

node_pyq: "Previous Year Questions" {
  class: student
}

node_leaderboard: "Leaderboard" {
  class: student
}

node_student_profile: "Student Profile" {
  class: student
}

# ============ ADMIN LAYER ============
node_admin_dash: "Admin Dashboard" {
  class: admin
  tooltip: "Overview, Stats, Quick Actions"
}

node_create_exam: "Create Exam" {
  class: admin
  tooltip: "MCQ Builder, Media Upload"
}

node_create_practice: "Create Practice Questions" {
  class: admin
  tooltip: "Topic Selection, Difficulty Levels"
}

node_monitoring: "Live Monitoring" {
  class: admin
  tooltip: "Test-wise, Per-Exam Student Status"
}

node_student_mgmt: "Student Management" {
  class: admin
}

node_admin_profile: "Admin Profile" {
  class: admin
}

# ============ DATABASE LAYER ============
db_users: "users" {
  class: database
}

db_student_profiles: "student_profiles" {
  class: database
}

db_admin_profiles: "admin_profiles" {
  class: database
}

db_exams: "exams" {
  class: database
}

db_questions: "exam_questions" {
  class: database
}

db_sessions: "exam_sessions" {
  class: database
}

db_attempts: "question_attempts" {
  class: database
}

db_anticheat: "anti_cheat_events" {
  class: database
}

db_practice_topics: "practice_topics" {
  class: database
}

db_practice_questions: "practice_questions" {
  class: database
}

db_practice_attempts: "practice_attempts" {
  class: database
}

db_topic_stats: "student_topic_stats" {
  class: database
}

db_badges: "badges & student_badges" {
  class: database
}

db_leaderboard: "leaderboard_snapshots" {
  class: database
}

# ============ FLOW CONNECTIONS ============

# Entry Point
node_home -> node_login
node_login -> node_role

# Student Path
node_role -> node_student_dash: "Student Route"

# Dashboard to Features
node_student_dash -> node_exam_flow
node_student_dash -> node_practice
node_student_dash -> node_analytics
node_student_dash -> node_leaderboard
node_student_dash -> node_student_profile

# Exam Taking Flow
node_exam_flow -> node_exam_instr
node_exam_instr -> node_exam_live
node_exam_live -> node_exam_result
node_exam_result -> node_analytics

# Practice Flow
node_practice -> node_pyq

# Admin Path
node_role -> node_admin_dash: "Admin Route"

# Admin Dashboard Features
node_admin_dash -> node_create_exam
node_admin_dash -> node_create_practice
node_admin_dash -> node_monitoring
node_admin_dash -> node_student_mgmt
node_admin_dash -> node_admin_profile

# Database Connections - Student Operations
node_student_dash -> db_student_profiles: "Read"
node_student_dash -> db_exams: "Read"
node_student_dash -> db_topic_stats: "Read"
node_student_dash -> db_leaderboard: "Read"

node_practice -> db_practice_topics: "Query"
node_practice -> db_practice_questions: "Load"
node_practice -> db_practice_attempts: "Save"
node_practice -> db_topic_stats: "Update"

node_exam_live -> db_sessions: "Create"
node_exam_live -> db_questions: "Load"
node_exam_live -> db_attempts: "Save"
node_exam_live -> db_anticheat: "Log"

node_analytics -> db_sessions: "Query"
node_analytics -> db_attempts: "Analyze"

node_leaderboard -> db_leaderboard: "Read"
node_leaderboard -> db_student_profiles: "Read"

node_pyq -> db_exams: "Load"

# Database Connections - Admin Operations
node_create_exam -> db_exams: "Create"
node_create_exam -> db_questions: "Add"

node_create_practice -> db_practice_topics: "Select"
node_create_practice -> db_practice_questions: "Create"

node_monitoring -> db_sessions: "Monitor"
node_monitoring -> db_anticheat: "Fetch"
node_monitoring -> db_student_profiles: "Read"

node_student_mgmt -> db_student_profiles: "View"

# Core Database Relationships
db_users -> db_student_profiles: "1:1"
db_users -> db_admin_profiles: "1:1"

db_exams -> db_questions: "1:Many"
db_exams -> db_sessions: "1:Many"
db_sessions -> db_attempts: "1:Many"
db_sessions -> db_anticheat: "1:Many"

db_practice_topics -> db_practice_questions: "1:Many"
db_practice_questions -> db_practice_attempts: "1:Many"

db_student_profiles -> db_topic_stats: "1:Many"
db_student_profiles -> db_badges: "1:Many"

# Gamification Loop
db_practice_attempts -> db_badges: "Unlock"
db_topic_stats -> db_leaderboard: "Rank"
db_sessions -> db_leaderboard: "Snapshot"
```

---

## Alternative Compact Version (if the above is too large)

```d2
direction: down

classes: {
  public: { fill: "#0F766E"; stroke: "#0D9488"; color: "#fff" }
  student: { fill: "#059669"; stroke: "#10B981"; color: "#fff" }
  admin: { fill: "#CA8A04"; stroke: "#FBBF24"; color: "#fff" }
  db: { fill: "#7C3AED"; stroke: "#A78BFA"; color: "#fff" }
}

# Entry
home["Home"]
auth["Login/Register"]
home -> auth

# Auth Branch
auth -> student_role["Student"]
auth -> admin_role["Admin"]

# Student Portal
student_role -> sd["Student Dashboard"]
sd {
  class: student
}

sd -> exam["Exam Module"]
sd -> practice["Practice Questions"]
sd -> analytics["Performance Analytics"]
sd -> pyq["Previous Year Questions"]
sd -> board["Leaderboard"]
sd -> profile["Student Profile"]

exam { class: student }
practice { class: student }
analytics { class: student }
pyq { class: student }
board { class: student }
profile { class: student }

# Admin Portal
admin_role -> ad["Admin Dashboard"]
ad {
  class: admin
}

ad -> create_exam["Create Exam"]
ad -> create_practice["Create Practice"]
ad -> monitor["Live Monitoring"]
ad -> students["Student Management"]
ad -> admin_prof["Admin Profile"]

create_exam { class: admin }
create_practice { class: admin }
monitor { class: admin }
students { class: admin }
admin_prof { class: admin }

# Database Hub
db_layer["MongoDB Collections"]
db_layer {
  class: db
}

# Connections to DB
exam -> db_layer
practice -> db_layer
analytics -> db_layer
board -> db_layer
pyq -> db_layer
create_exam -> db_layer
create_practice -> db_layer
monitor -> db_layer
students -> db_layer
```

---

## How to Use in Eraser.io:

1. Go to [eraser.io](https://www.eraser.io)
2. Create a new D2 diagram
3. Paste either version above into the editor
4. The diagram will render automatically
5. You can customize colors, fonts, and layout in the D2 syntax

## Key Features Visualized:

✅ **Public Layer** - Home, Login/Register  
✅ **Student Role** - 7 main pages with feature highlights  
✅ **Admin Role** - 5 main pages with functionality  
✅ **User Flows** - Clear pathways from entry to feature usage  
✅ **Database Schema** - 14+ collections with relationships  
✅ **Anti-Cheat Integration** - Event tracking in live exams  
✅ **Gamification** - Badges, leaderboard, topic mastery  
✅ **Test-wise Monitoring** - Per-exam student tracking  

## D2 Syntax Tips:

- `class: admin` applies styling from the classes block
- `->` creates directed arrows
- `{...}` creates groups/containers
- `.note` adds annotations
- `|` in direction creates branches

You can further customize by adding:
- Icons/emojis in node names
- Legend sections
- Different arrow styles (`->`, `<->`, `--`)
- Grouped sections with braces
