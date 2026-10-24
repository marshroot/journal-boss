import { Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/LandingPage';
import JournalDashboard from './pages/JournalDashboard';
import JournalSchedule from './pages/JournalSchedule';
import JournalGrades from './pages/JournalGrades';
import JournalHomework from './pages/JournalHomework';
import JournalLayout from './components/journal/JournalLayout';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAcademicPage from './pages/AdminAcademicPage';
import TeacherLessonsPage from './pages/TeacherLessonsPage';
import LocalHomeworkPage from './pages/LocalHomeworkPage';
import MaterialsPage from './pages/MaterialsPage';
import LocalGradesPage from './pages/LocalGradesPage';
import StudentOnlineLessonPage from './pages/StudentOnlineLessonPage';
import ParentAttendancePage from './pages/ParentAttendancePage';
import ParentProgressPage from './pages/ParentProgressPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import LessonChatPage from './pages/LessonChatPage';
import CodeLabPage from './pages/CodeLabPage';
import LessonBoardPage from './pages/LessonBoardPage';
import MessagesPage from './pages/MessagesPage';
import ImageEditorPage from './pages/ImageEditorPage';
import PaymentsPage from './pages/PaymentsPage';
import AdminOperationsPage from './pages/AdminOperationsPage';
import TeacherCurrentLessonPage from './pages/TeacherCurrentLessonPage';
import { AnnouncementsPage, AwardsPage, ReviewsPage, ProfilePage, FaqPage, ContactsPage, AppealsPage, ComplaintsPage } from './pages/JournalSectionPages';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<JournalLayout />}>
        <Route path="/dashboard" element={<JournalDashboard />} />
        <Route path="/schedule" element={<JournalSchedule />} />
        <Route path="/grades" element={<JournalGrades />} />
        <Route path="/homework" element={<JournalHomework />} />
        <Route path="/local-grades" element={<LocalGradesPage />} />
        <Route path="/local-homework" element={<LocalHomeworkPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/academic" element={<AdminAcademicPage />} />
        <Route path="/admin/operations" element={<AdminOperationsPage />} />
        <Route path="/teacher/current-lesson" element={<TeacherCurrentLessonPage />} />
        <Route path="/teacher/lessons" element={<TeacherLessonsPage />} />
        <Route path="/online-lesson" element={<StudentOnlineLessonPage />} />
        <Route path="/parent" element={<ParentDashboardPage />} />
        <Route path="/parent/attendance" element={<ParentAttendancePage />} />
        <Route path="/parent/progress" element={<ParentProgressPage />} />
        <Route path="/lesson-chat" element={<LessonChatPage />} />
        <Route path="/code-lab" element={<CodeLabPage />} />
        <Route path="/lesson-board" element={<LessonBoardPage />} />
        <Route path="/messages" element={<MessagesPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/image-editor" element={<ImageEditorPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/awards" element={<AwardsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/appeals" element={<AppealsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
