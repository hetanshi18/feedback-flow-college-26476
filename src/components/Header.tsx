import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ModeToggle } from '@/components/mode-toggle';
import { LogOut, User } from 'lucide-react';

const Header = () => {
  const { user, signOut } = useAuth();

  const getUserName = () => {
    return user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  };

  const getUserRole = () => {
    if (user?.user_metadata?.role) {
      return user.user_metadata.role;
    }
    // Fallback logic based on email patterns
    if (user?.email?.includes('admin')) return 'admin';
    if (user?.email?.includes('controller')) return 'controller';
    if (user?.email?.includes('teacher') || user?.email?.includes('prof')) return 'teacher';
    return 'student';
  };

  const getUserDepartment = () => {
    return user?.user_metadata?.department || 'Department';
  };

  const handleLogout = () => {
    signOut();
  };

  return (
    <header className="bg-academic-navy border-b-2 border-academic-navy/30 shadow-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-academic-navy rounded-lg border border-academic-navy shadow-sm">
              <img 
                src="/lovable-uploads/0f31024b-b89b-49e8-b740-2ea425995c4e.png" 
                alt="SPIT Logo" 
                className="w-12 h-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-md">SPIT Answer Sheet Portal</h1>
              <p className="text-sm text-white/80">Sardar Patel Institute of Technology</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <ModeToggle />
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-academic-navy px-4 py-2 rounded-lg border-2 border-white shadow-md">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-white/30 shadow-lg">
                    <User className="w-5 h-5 text-academic-navy" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-white">{getUserName()}</p>
                    <p className="text-white/90 capitalize">{getUserRole()} • {getUserDepartment()}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="bg-academic-navy border-2 border-white text-white hover:bg-academic-navy hover:text-white shadow-md"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;