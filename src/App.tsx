import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import HomePage from './pages/HomePage'
import RecordPage from './pages/RecordPage'
import ResultsPage from './pages/ResultsPage'
import UploadPage from './pages/UploadPage'
import HistoryPage from './pages/HistoryPage'
import ComparePage from './pages/ComparePage'
import LoginPage from './pages/LoginPage'
import PurchasePage from './pages/PurchasePage'
import CompleteProfilePage from './pages/CompleteProfilePage'

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading, profileLoading, isProfileComplete } = useAuth();
    const location = useLocation();

    if (loading || profileLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>読み込み中...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to profile completion if profile is incomplete
    // Skip redirect if already on the complete-profile page
    if (!isProfileComplete && location.pathname !== '/complete-profile') {
        return <Navigate to="/complete-profile" replace />;
    }

    return <>{children}</>;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/complete-profile" element={<CompleteProfilePage />} />
            <Route path="/" element={
                <ProtectedRoute>
                    <HomePage />
                </ProtectedRoute>
            } />
            <Route path="/record" element={
                <ProtectedRoute>
                    <RecordPage />
                </ProtectedRoute>
            } />
            <Route path="/upload" element={
                <ProtectedRoute>
                    <UploadPage />
                </ProtectedRoute>
            } />
            <Route path="/results" element={
                <ProtectedRoute>
                    <ResultsPage />
                </ProtectedRoute>
            } />
            <Route path="/history" element={
                <ProtectedRoute>
                    <HistoryPage />
                </ProtectedRoute>
            } />
            <Route path="/compare" element={
                <ProtectedRoute>
                    <ComparePage />
                </ProtectedRoute>
            } />
            <Route path="/purchase" element={
                <ProtectedRoute>
                    <PurchasePage />
                </ProtectedRoute>
            } />
        </Routes>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}

export default App

