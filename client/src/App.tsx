import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { FactoriesPage } from './pages/FactoriesPage';
import { FactoryDetailPage } from './pages/FactoryDetailPage';
import { EngagementDetailPage } from './pages/EngagementDetailPage';
import { UsersPage } from './pages/UsersPage';
import { RDOverviewPage } from './pages/RDOverviewPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { WorkspacePage } from './pages/WorkspacePage';

// Error boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold mb-2">Có lỗi xảy ra</h2>
            <p className="text-muted-foreground text-sm mb-4">{this.state.error.message}</p>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading spinner while checking auth
function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// Protected routes — redirect to login if not authenticated
function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/factories" element={<FactoriesPage />} />
        <Route path="/factories/:id" element={<FactoryDetailPage />} />
        <Route path="/engagements/:id" element={<EngagementDetailPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/rd-overview" element={<RDOverviewPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ProtectedRoutes />
          <Toaster
            position="bottom-right"
            richColors
            toastOptions={{ duration: 3000 }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
