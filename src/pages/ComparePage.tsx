import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSession, type SavedSession } from '../utils/sessionStorage';
import './ComparePage.css';

export default function ComparePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sessions, setSessions] = useState<[SavedSession | null, SavedSession | null]>([null, null]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sessionIds = searchParams.get('sessions')?.split(',') || [];
        if (sessionIds.length !== 2) {
            navigate('/history');
            return;
        }

        Promise.all([
            getSession(sessionIds[0]),
            getSession(sessionIds[1])
        ]).then(([s1, s2]) => {
            if (!s1 || !s2) {
                alert('セッションが見つかりません');
                navigate('/history');
                return;
            }
            setSessions([s1, s2]);
            setLoading(false);
        });
    }, [searchParams, navigate]);

    const comparison = useMemo(() => {
        if (!sessions[0] || !sessions[1]) return null;

        const [s1, s2] = sessions;

        return {
            rightKneeDiff: s2.analysis.lateralThrust.rightKnee.amplitude - s1.analysis.lateralThrust.rightKnee.amplitude,
            leftKneeDiff: s2.analysis.lateralThrust.leftKnee.amplitude - s1.analysis.lateralThrust.leftKnee.amplitude,
            asymmetryDiff: s2.analysis.lateralThrust.asymmetryPercent - s1.analysis.lateralThrust.asymmetryPercent,
            rightKneeChangePercent: ((s2.analysis.lateralThrust.rightKnee.amplitude - s1.analysis.lateralThrust.rightKnee.amplitude) / (s1.analysis.lateralThrust.rightKnee.amplitude || 1)) * 100,
            leftKneeChangePercent: ((s2.analysis.lateralThrust.leftKnee.amplitude - s1.analysis.lateralThrust.leftKnee.amplitude) / (s1.analysis.lateralThrust.leftKnee.amplitude || 1)) * 100
        };
    }, [sessions]);

    const getDiffLabel = (diff: number) => {
        if (Math.abs(diff) < 0.5) return '変化なし';
        if (diff > 0) return '増加';
        return '減少';
    };

    const getSeverityLabel = (severity: 'low' | 'moderate' | 'high') => {
        const labels = { low: '軽度', moderate: '中程度', high: '強' };
        return labels[severity];
    };

    if (loading || !sessions[0] || !sessions[1]) {
        return (
            <div className="compare-page">
                <div className="loading-container">
                    <div className="spinner" />
                    <p>読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="compare-page">
            <header className="compare-header">
                <button className="back-btn" onClick={() => navigate('/history')}>
                    ← 戻る
                </button>
                <h1>セッション比較</h1>
            </header>

            <main className="compare-main">
                {/* Session Headers */}
                <div className="session-headers">
                    <div className="session-header-card">
                        <h2>{sessions[0].name}</h2>
                        <p className="session-date">
                            {new Date(sessions[0].timestamp).toLocaleString('ja-JP')}
                        </p>
                        {sessions[0].notes && <p className="session-notes">{sessions[0].notes}</p>}
                    </div>
                    <div className="session-header-card">
                        <h2>{sessions[1].name}</h2>
                        <p className="session-date">
                            {new Date(sessions[1].timestamp).toLocaleString('ja-JP')}
                        </p>
                        {sessions[1].notes && <p className="session-notes">{sessions[1].notes}</p>}
                    </div>
                </div>

                {/* Comparison Summary */}
                <section className="comparison-summary">
                    <h3>変化サマリー</h3>
                    <div className="summary-grid">
                        <div className="summary-item">
                            <span className="summary-label">右膝 Lateral Thrust</span>
                            <div className="summary-values">
                                <span>{sessions[0].analysis.lateralThrust.rightKnee.amplitude} cm</span>
                                <span className="arrow">→</span>
                                <span>{sessions[1].analysis.lateralThrust.rightKnee.amplitude} cm</span>
                            </div>
                            <div className={`change-indicator ${comparison!.rightKneeDiff > 0 ? 'negative' : comparison!.rightKneeDiff < 0 ? 'positive' : 'neutral'}`}>
                                {getDiffLabel(comparison!.rightKneeDiff)}
                                {Math.abs(comparison!.rightKneeDiff) >= 0.5 && (
                                    <span className="change-percent">
                                        ({comparison!.rightKneeChangePercent > 0 ? '+' : ''}{comparison!.rightKneeChangePercent.toFixed(1)}%)
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">左膝 Lateral Thrust</span>
                            <div className="summary-values">
                                <span>{sessions[0].analysis.lateralThrust.leftKnee.amplitude} cm</span>
                                <span className="arrow">→</span>
                                <span>{sessions[1].analysis.lateralThrust.leftKnee.amplitude} cm</span>
                            </div>
                            <div className={`change-indicator ${comparison!.leftKneeDiff > 0 ? 'negative' : comparison!.leftKneeDiff < 0 ? 'positive' : 'neutral'}`}>
                                {getDiffLabel(comparison!.leftKneeDiff)}
                                {Math.abs(comparison!.leftKneeDiff) >= 0.5 && (
                                    <span className="change-percent">
                                        ({comparison!.leftKneeChangePercent > 0 ? '+' : ''}{comparison!.leftKneeChangePercent.toFixed(1)}%)
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="summary-item">
                            <span className="summary-label">左右差</span>
                            <div className="summary-values">
                                <span>{sessions[0].analysis.lateralThrust.asymmetryPercent}%</span>
                                <span className="arrow">→</span>
                                <span>{sessions[1].analysis.lateralThrust.asymmetryPercent}%</span>
                            </div>
                            <div className={`change-indicator ${comparison!.asymmetryDiff > 0 ? 'negative' : comparison!.asymmetryDiff < 0 ? 'positive' : 'neutral'}`}>
                                {getDiffLabel(comparison!.asymmetryDiff)}
                                {Math.abs(comparison!.asymmetryDiff) >= 1 && (
                                    <span className="change-percent">({comparison!.asymmetryDiff > 0 ? '+' : ''}{comparison!.asymmetryDiff}%)</span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Detailed Comparison */}
                <section className="detailed-comparison">
                    <h3>詳細比較</h3>
                    <div className="comparison-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>項目</th>
                                    <th>{sessions[0].name}</th>
                                    <th>{sessions[1].name}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>右膝 振幅</td>
                                    <td>{sessions[0].analysis.lateralThrust.rightKnee.amplitude} cm</td>
                                    <td>{sessions[1].analysis.lateralThrust.rightKnee.amplitude} cm</td>
                                </tr>
                                <tr>
                                    <td>右膝 重症度</td>
                                    <td>
                                        <span className={`badge badge-${sessions[0].analysis.lateralThrust.rightKnee.severity}`}>
                                            {getSeverityLabel(sessions[0].analysis.lateralThrust.rightKnee.severity)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${sessions[1].analysis.lateralThrust.rightKnee.severity}`}>
                                            {getSeverityLabel(sessions[1].analysis.lateralThrust.rightKnee.severity)}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>左膝 振幅</td>
                                    <td>{sessions[0].analysis.lateralThrust.leftKnee.amplitude} cm</td>
                                    <td>{sessions[1].analysis.lateralThrust.leftKnee.amplitude} cm</td>
                                </tr>
                                <tr>
                                    <td>左膝 重症度</td>
                                    <td>
                                        <span className={`badge badge-${sessions[0].analysis.lateralThrust.leftKnee.severity}`}>
                                            {getSeverityLabel(sessions[0].analysis.lateralThrust.leftKnee.severity)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${sessions[1].analysis.lateralThrust.leftKnee.severity}`}>
                                            {getSeverityLabel(sessions[1].analysis.lateralThrust.leftKnee.severity)}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>測定時間</td>
                                    <td>{sessions[0].analysis.duration.toFixed(1)}秒</td>
                                    <td>{sessions[1].analysis.duration.toFixed(1)}秒</td>
                                </tr>
                                <tr>
                                    <td>総フレーム数</td>
                                    <td>{sessions[0].analysis.totalFrames}</td>
                                    <td>{sessions[1].analysis.totalFrames}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Clinical Interpretation */}
                <section className="clinical-interpretation">
                    <h3>解釈</h3>
                    <div className="interpretation-content">
                        {generateInterpretation(sessions[0], sessions[1], comparison!)}
                    </div>
                </section>
            </main>
        </div>
    );
}

function generateInterpretation(
    s1: SavedSession,
    s2: SavedSession,
    comparison: { rightKneeDiff: number; leftKneeDiff: number; asymmetryDiff: number }
): string {
    const comments: string[] = [];

    // Time difference
    const daysDiff = Math.floor((s2.timestamp - s1.timestamp) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0) {
        comments.push(`${daysDiff}日間の変化を比較しています。`);
    }

    // Right knee
    if (Math.abs(comparison.rightKneeDiff) < 0.5) {
        comments.push('右膝のlateral thrustに大きな変化は見られません。');
    } else if (comparison.rightKneeDiff > 0) {
        comments.push(`右膝のlateral thrustが増加しています（+${comparison.rightKneeDiff.toFixed(1)}）。注意が必要です。`);
    } else {
        comments.push(`右膝のlateral thrustが減少しています（${comparison.rightKneeDiff.toFixed(1)}）。改善の兆候が見られます。`);
    }

    // Left knee
    if (Math.abs(comparison.leftKneeDiff) < 0.5) {
        comments.push('左膝のlateral thrustに大きな変化は見られません。');
    } else if (comparison.leftKneeDiff > 0) {
        comments.push(`左膝のlateral thrustが増加しています（+${comparison.leftKneeDiff.toFixed(1)}）。注意が必要です。`);
    } else {
        comments.push(`左膝のlateral thrustが減少しています（${comparison.leftKneeDiff.toFixed(1)}）。改善の兆候が見られます。`);
    }

    // Asymmetry
    if (Math.abs(comparison.asymmetryDiff) > 5) {
        comments.push(`左右差が${comparison.asymmetryDiff > 0 ? '拡大' : '縮小'}しています。`);
    }

    return comments.join(' ');
}
