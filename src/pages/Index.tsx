import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import Header from '@/components/Header';
import StudentDashboard from '@/components/StudentDashboard';
import TeacherDashboard from '@/components/TeacherDashboard';
import AdminDashboard from '@/components/AdminDashboard';

const Index = () => {
  const { user, isLoading, session } = useAuth();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/auth';
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Get role from user metadata or default based on email
  const getUserRole = () => {
    if (user.user_metadata?.role) {
      return user.user_metadata.role;
    }
    // Fallback logic based on email patterns
    if (user.email?.includes('admin')) return 'admin';
    if (user.email?.includes('controller')) return 'controller';
    if (user.email?.includes('teacher') || user.email?.includes('prof')) return 'teacher';
    return 'student';
  };

  const userRole = getUserRole();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {userRole === 'student' ? (
          <StudentDashboard />
        ) : userRole === 'teacher' ? (
          <TeacherDashboard />
        ) : (
          <AdminDashboard />
        )}
      </main>
    </div>
  );
};

export default Index;
