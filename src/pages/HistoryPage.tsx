import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessions, deleteSession, type SavedSession } from '../utils/sessionStorage';
import './HistoryPage.css';

export default function HistoryPage() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SavedSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAllSessions();
            setSessions(data);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('このセッションを削除しますか？')) return;

        try {
            await deleteSession(id);
            setSessions((prev) => prev.filter((s) => s.id !== id));
            setSelectedSessions((prev) => prev.filter((sid) => sid !== id));
        } catch (error) {
            console.error('Failed to delete session:', error);
            alert('削除に失敗しました');
        }
    }, []);

    const handleViewSession = useCallback((session: SavedSession) => {
        // Store session data for viewing
        sessionStorage.setItem('recordedFrames', JSON.stringify(session.frames));
        navigate('/results');
    }, [navigate]);

    const handleToggleSelect = useCallback((id: string) => {
        setSelectedSessions((prev) => {
            if (prev.includes(id)) {
                return prev.filter((sid) => sid !== id);
            } else if (prev.length < 2) {
                return [...prev, id];
            }
            return prev;
        });
    }, []);

    const handleCompare = useCallback(() => {
        if (selectedSessions.length !== 2) return;
        navigate(`/compare?sessions=${selectedSessions.join(',')}`);
    }, [selectedSessions, navigate]);

    const getSeverityLabel = (severity: 'low' | 'moderate' | 'high') => {
        const labels = { low: '軽度', moderate: '中程度', high: '強' };
        return labels[severity];
    };

    if (loading) {
        return (
            <div className="history-page">
                <div className="loading-container">
                    <div className="spinner" />
                    <p>読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="history-page">
            <header className="history-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    ← 戻る
                </button>
                <h1>過去データ</h1>
                {selectedSessions.length === 2 && (
                    <button className="compare-btn" onClick={handleCompare}>
                        比較する
                    </button>
                )}
            </header>

            <main className="history-main">
                {sessions.length === 0 ? (
                    <div className="empty-state">
                        <p>保存されたセッションがありません</p>
                        <button className="btn btn-primary" onClick={() => navigate('/record')}>
                            新規撮影
                        </button>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className={`session-card ${selectedSessions.includes(session.id) ? 'selected' : ''}`}
                            >
                                <div className="session-header">
                                    <input
                                        type="checkbox"
                                        checked={selectedSessions.includes(session.id)}
                                        onChange={() => handleToggleSelect(session.id)}
                                        disabled={
                                            selectedSessions.length >= 2 &&
                                            !selectedSessions.includes(session.id)
                                        }
                                    />
                                    <div className="session-info">
                                        <h3>{session.name}</h3>
                                        <span className="session-date">
                                            {new Date(session.timestamp).toLocaleString('ja-JP')}
                                        </span>
                                    </div>
                                </div>

                                {session.notes && (
                                    <p className="session-notes">{session.notes}</p>
                                )}

                                <div className="session-metrics">
                                    <div className="metric">
                                        <span className="metric-label">右膝</span>
                                        <div className="metric-value">
                                            <span className={`badge badge-${session.analysis.lateralThrust.rightKnee.severity}`}>
                                                {getSeverityLabel(session.analysis.lateralThrust.rightKnee.severity)}
                                            </span>
                                            <span>{session.analysis.lateralThrust.rightKnee.amplitude}</span>
                                        </div>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">左膝</span>
                                        <div className="metric-value">
                                            <span className={`badge badge-${session.analysis.lateralThrust.leftKnee.severity}`}>
                                                {getSeverityLabel(session.analysis.lateralThrust.leftKnee.severity)}
                                            </span>
                                            <span>{session.analysis.lateralThrust.leftKnee.amplitude}</span>
                                        </div>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">左右差</span>
                                        <span className="metric-value">
                                            {session.analysis.lateralThrust.asymmetryPercent}%
                                        </span>
                                    </div>
                                </div>

                                <div className="session-actions">
                                    <button
                                        className="btn btn-outline btn-small"
                                        onClick={() => handleViewSession(session)}
                                    >
                                        詳細
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-small"
                                        onClick={() => handleDelete(session.id)}
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedSessions.length > 0 && selectedSessions.length < 2 && (
                    <div className="selection-hint">
                        もう1つセッションを選択して比較できます
                    </div>
                )}
            </main>
        </div>
    );
}
