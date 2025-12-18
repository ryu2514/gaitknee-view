import { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGaitAnalysis } from '../hooks/useGaitAnalysis';
import { saveSession } from '../utils/sessionStorage';
import type { FrameData } from '../types/pose';
import type { GaitCycle } from '../types/gait';
import './ResultsPage.css';

export default function ResultsPage() {
    const navigate = useNavigate();
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [sessionNotes, setSessionNotes] = useState('');

    // Get recorded frames from session storage
    const frames = useMemo<FrameData[]>(() => {
        const stored = sessionStorage.getItem('recordedFrames');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return [];
            }
        }
        return [];
    }, []);

    // Type for individual trial result
    interface TrialResult {
        lateralThrust: {
            rightKnee: { amplitude: number; severity: string };
            leftKnee: { amplitude: number; severity: string };
            asymmetryPercent: number;
        };
        stancePhases: unknown[];
        totalFrames: number;
        duration: number;
    }

    // Get trial results with averages
    const trialData = useMemo<{
        trials: TrialResult[];
        bestTrialIndex: number;
        averages: { rightAmplitude: number; leftAmplitude: number; asymmetry: number } | null;
    } | null>(() => {
        const stored = sessionStorage.getItem('allTrialResults');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return null;
            }
        }
        return null;
    }, []);

    const { analysis } = useGaitAnalysis(frames);

    useEffect(() => {
        if (frames.length === 0) {
            navigate('/');
        }
    }, [frames, navigate]);

    const handleSaveImage = useCallback(async () => {
        // Save as PNG - capture the results container
        const container = document.querySelector('.results-content');
        if (!container) return;

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(container as HTMLElement);
            const link = document.createElement('a');
            link.download = `gaitknee-result-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Failed to save image:', error);
            alert('画像の保存に失敗しました');
        }
    }, []);

    const handleSaveJSON = useCallback(() => {
        // Export detailed JSON data for research
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                version: '1.0',
                totalFrames: analysis?.totalFrames ?? 0,
                duration: analysis?.duration ?? 0
            },
            analysis: {
                lateralThrust: {
                    leftKnee: {
                        amplitude: analysis?.lateralThrust.leftKnee.amplitude ?? 0,
                        maxDisplacement: analysis?.lateralThrust.leftKnee.maxDisplacement ?? 0,
                        severity: analysis?.lateralThrust.leftKnee.severity ?? 'low',
                        waveform: analysis?.lateralThrust.leftKnee.waveform ?? [],
                        timePoints: analysis?.lateralThrust.leftKnee.timePoints ?? []
                    },
                    rightKnee: {
                        amplitude: analysis?.lateralThrust.rightKnee.amplitude ?? 0,
                        maxDisplacement: analysis?.lateralThrust.rightKnee.maxDisplacement ?? 0,
                        severity: analysis?.lateralThrust.rightKnee.severity ?? 'low',
                        waveform: analysis?.lateralThrust.rightKnee.waveform ?? [],
                        timePoints: analysis?.lateralThrust.rightKnee.timePoints ?? []
                    },
                    asymmetryPercent: analysis?.lateralThrust.asymmetryPercent ?? 0
                },
                stancePhases: analysis?.stancePhases ?? [],
                gaitCycles: analysis?.gaitCycles ?? []
            },
            frames: frames.map(f => ({
                timestamp: f.timestamp,
                landmarks: f.landmarks,
                worldLandmarks: f.worldLandmarks
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const link = document.createElement('a');
        link.download = `gaitknee-data-${Date.now()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }, [frames, analysis]);

    const handleRetry = useCallback(() => {
        sessionStorage.removeItem('recordedFrames');
        navigate('/record');
    }, [navigate]);

    const handleSaveSession = useCallback(async () => {
        if (!analysis) return;

        try {
            const sessionId = await saveSession(
                frames,
                analysis,
                sessionName || undefined,
                sessionNotes || undefined
            );
            console.log('Session saved:', sessionId);
            alert('セッションを保存しました');
            setShowSaveDialog(false);
            setSessionName('');
            setSessionNotes('');
        } catch (error) {
            console.error('Failed to save session:', error);
            alert('セッションの保存に失敗しました');
        }
    }, [frames, analysis, sessionName, sessionNotes]);

    const getSeverityLabel = (severity: 'low' | 'moderate' | 'high') => {
        const labels = { low: '軽度', moderate: '中程度', high: '強' };
        return labels[severity];
    };

    if (!analysis) {
        return (
            <div className="results-page">
                <div className="loading-container">
                    <div className="spinner" />
                    <p>解析中...</p>
                </div>
            </div>
        );
    }

    // Helper function to determine severity from amplitude
    const getSeverityFromAmplitude = (amplitude: number): 'low' | 'moderate' | 'high' => {
        if (amplitude >= 1.5) return 'high';
        if (amplitude >= 0.8) return 'moderate';
        return 'low';
    };

    // Use averaged values if available, otherwise use single-trial analysis
    const hasAverages = trialData?.averages != null;
    const averages = trialData?.averages;
    const trialCount = trialData?.trials?.length ?? 1;

    const displayValues = hasAverages ? {
        rightAmplitude: Number(averages!.rightAmplitude.toFixed(1)),
        leftAmplitude: Number(averages!.leftAmplitude.toFixed(1)),
        asymmetryPercent: Math.round(averages!.asymmetry),
        rightSeverity: getSeverityFromAmplitude(averages!.rightAmplitude),
        leftSeverity: getSeverityFromAmplitude(averages!.leftAmplitude)
    } : {
        rightAmplitude: analysis.lateralThrust.rightKnee.amplitude,
        leftAmplitude: analysis.lateralThrust.leftKnee.amplitude,
        asymmetryPercent: analysis.lateralThrust.asymmetryPercent,
        rightSeverity: analysis.lateralThrust.rightKnee.severity,
        leftSeverity: analysis.lateralThrust.leftKnee.severity
    };

    const { lateralThrust } = analysis;

    return (
        <div className="results-page">
            <header className="results-header">
                <h1>解析結果</h1>
                <div className="header-badges">
                    {hasAverages && (
                        <span className="average-badge">
                            {trialCount}回平均
                        </span>
                    )}
                    <span className="duration-badge">
                        {analysis.duration.toFixed(1)}秒 / {analysis.totalFrames}フレーム
                    </span>
                </div>
            </header>

            <div className="results-content">
                {/* Score Overview - Big Display */}
                <section className="score-overview">
                    <div className="score-cards">
                        <div className="score-card score-card-right">
                            <div className="score-header">
                                <span className="knee-label">右膝</span>
                            </div>
                            <div className="score-main">
                                <div className={`score-badge score-badge-${displayValues.rightSeverity}`}>
                                    <div className="severity-icon">
                                        {displayValues.rightSeverity === 'high' && '⚠️'}
                                        {displayValues.rightSeverity === 'moderate' && '⚡'}
                                        {displayValues.rightSeverity === 'low' && '✓'}
                                    </div>
                                    <div className="severity-label">{getSeverityLabel(displayValues.rightSeverity)}</div>
                                </div>
                                <div className="amplitude-display">
                                    <span className="amplitude-value">{displayValues.rightAmplitude} cm</span>
                                    <span className="amplitude-unit">振幅</span>
                                </div>
                            </div>
                        </div>

                        <div className="score-card score-card-asymmetry">
                            <div className="asymmetry-label">左右差</div>
                            <div className="asymmetry-value">{displayValues.asymmetryPercent}<span className="asymmetry-unit">%</span></div>
                            {displayValues.asymmetryPercent > 20 && (
                                <div className="asymmetry-warning">左右差が大きい</div>
                            )}
                        </div>

                        <div className="score-card score-card-left">
                            <div className="score-header">
                                <span className="knee-label">左膝</span>
                            </div>
                            <div className="score-main">
                                <div className={`score-badge score-badge-${displayValues.leftSeverity}`}>
                                    <div className="severity-icon">
                                        {displayValues.leftSeverity === 'high' && '⚠️'}
                                        {displayValues.leftSeverity === 'moderate' && '⚡'}
                                        {displayValues.leftSeverity === 'low' && '✓'}
                                    </div>
                                    <div className="severity-label">{getSeverityLabel(displayValues.leftSeverity)}</div>
                                </div>
                                <div className="amplitude-display">
                                    <span className="amplitude-value">{displayValues.leftAmplitude} cm</span>
                                    <span className="amplitude-unit">振幅</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Waveform Charts */}
                <section className="chart-section">
                    <h2>Lateral Thrust 波形</h2>
                    <div className="waveform-container">
                        {/* Right Knee */}
                        <div className="waveform-card">
                            <div className="waveform-header">
                                <span className="leg-label">右膝</span>
                                <span className={`badge badge-${lateralThrust.rightKnee.severity}`}>
                                    {getSeverityLabel(lateralThrust.rightKnee.severity)}
                                </span>
                            </div>
                            <WaveformChart
                                data={lateralThrust.rightKnee.waveform}
                                severity={lateralThrust.rightKnee.severity}
                                gaitCycles={analysis.gaitCycles.filter(c => c.leg === 'right')}
                                _leg="right"
                            />
                            <div className="waveform-stats">
                                <span>振幅: <strong>{lateralThrust.rightKnee.amplitude} cm</strong></span>
                            </div>
                        </div>

                        {/* Left Knee */}
                        <div className="waveform-card">
                            <div className="waveform-header">
                                <span className="leg-label">左膝</span>
                                <span className={`badge badge-${lateralThrust.leftKnee.severity}`}>
                                    {getSeverityLabel(lateralThrust.leftKnee.severity)}
                                </span>
                            </div>
                            <WaveformChart
                                data={lateralThrust.leftKnee.waveform}
                                severity={lateralThrust.leftKnee.severity}
                                gaitCycles={analysis.gaitCycles.filter(c => c.leg === 'left')}
                                _leg="left"
                            />
                            <div className="waveform-stats">
                                <span>振幅: <strong>{lateralThrust.leftKnee.amplitude} cm</strong></span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Summary */}
                <section className="summary-section">
                    <h2>サマリー</h2>
                    <div className="summary-cards">
                        <div className="summary-card">
                            <span className="summary-label">左右差</span>
                            <span className="summary-value">{displayValues.asymmetryPercent}%</span>
                        </div>
                        <div className="summary-card">
                            <span className="summary-label">右膝</span>
                            <div className="summary-detail">
                                <span className={`badge badge-${displayValues.rightSeverity}`}>
                                    {getSeverityLabel(displayValues.rightSeverity)}
                                </span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <span className="summary-label">左膝</span>
                            <div className="summary-detail">
                                <span className={`badge badge-${displayValues.leftSeverity}`}>
                                    {getSeverityLabel(displayValues.leftSeverity)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Auto-generated comment */}
                    <div className="auto-comment">
                        <h3>所見</h3>
                        <p>
                            {generateComment({
                                leftKnee: { amplitude: displayValues.leftAmplitude, severity: displayValues.leftSeverity },
                                rightKnee: { amplitude: displayValues.rightAmplitude, severity: displayValues.rightSeverity },
                                asymmetryPercent: displayValues.asymmetryPercent
                            })}
                        </p>
                    </div>
                </section>

                {/* Trial Data Table */}
                {trialData && trialData.trials && trialData.trials.length > 0 && (
                    <section className="trial-table-section">
                        <h2>解析詳細（各試行）</h2>
                        <div className="trial-table-wrapper">
                            <table className="trial-table">
                                <thead>
                                    <tr>
                                        <th>試行</th>
                                        <th>右膝 (cm)</th>
                                        <th>左膝 (cm)</th>
                                        <th>左右差 (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trialData.trials.map((trial, index) => (
                                        <tr key={index} className={index === trialData.bestTrialIndex ? 'best-trial' : ''}>
                                            <td>
                                                {index + 1}回目
                                                {index === trialData.bestTrialIndex && <span className="best-badge">ベスト</span>}
                                            </td>
                                            <td>{trial.lateralThrust.rightKnee.amplitude}</td>
                                            <td>{trial.lateralThrust.leftKnee.amplitude}</td>
                                            <td>{trial.lateralThrust.asymmetryPercent}</td>
                                        </tr>
                                    ))}
                                    <tr className="average-row">
                                        <td><strong>平均</strong></td>
                                        <td><strong>{displayValues.rightAmplitude}</strong></td>
                                        <td><strong>{displayValues.leftAmplitude}</strong></td>
                                        <td><strong>{displayValues.asymmetryPercent}</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>

            {/* Actions */}
            <div className="results-actions">
                <button className="btn btn-secondary" onClick={handleRetry}>
                    やり直し
                </button>
                <button className="btn btn-outline" onClick={() => setShowSaveDialog(true)}>
                    セッション保存
                </button>
                <button className="btn btn-outline" onClick={handleSaveJSON}>
                    データ保存 (JSON)
                </button>
                <button className="btn btn-primary" onClick={handleSaveImage}>
                    画像保存 (PNG)
                </button>
            </div>

            {/* Save Session Dialog */}
            {showSaveDialog && (
                <div className="dialog-overlay" onClick={() => setShowSaveDialog(false)}>
                    <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
                        <h2>セッションを保存</h2>
                        <div className="dialog-body">
                            <div className="form-group">
                                <label htmlFor="session-name">セッション名</label>
                                <input
                                    id="session-name"
                                    type="text"
                                    className="form-input"
                                    placeholder={`セッション ${new Date().toLocaleDateString('ja-JP')}`}
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="session-notes">メモ（任意）</label>
                                <textarea
                                    id="session-notes"
                                    className="form-textarea"
                                    placeholder="患者情報、測定条件など"
                                    rows={3}
                                    value={sessionNotes}
                                    onChange={(e) => setSessionNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="dialog-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowSaveDialog(false)}
                            >
                                キャンセル
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveSession}
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Waveform Chart Component
function WaveformChart({
    data,
    severity,
    gaitCycles = [],
    _leg
}: {
    data: number[];
    severity: string;
    gaitCycles?: GaitCycle[];
    _leg: 'left' | 'right'
}) {
    if (data.length === 0) return <div className="waveform-empty">データなし</div>;

    // Downsample if needed
    const maxPoints = 100;
    const step = Math.max(1, Math.floor(data.length / maxPoints));
    const sampledData = data.filter((_, i) => i % step === 0);

    // Calculate dimensions
    const width = 100;
    const height = 40;
    const padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Create path
    const points = sampledData.map((value, index) => {
        const x = padding + (index / (sampledData.length - 1)) * (width - 2 * padding);
        const y = padding + ((max - value) / range) * (height - 2 * padding);
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const strokeColor = severity === 'high' ? 'var(--color-danger)' :
        severity === 'moderate' ? 'var(--color-warning)' :
            'var(--color-success)';

    // Phase colors (Rancho Los Amigos)
    const phaseColors: Record<string, string> = {
        'IC': '#4ade80',    // Green - Initial Contact
        'LR': '#facc15',    // Yellow - Loading Response
        'MSt': '#60a5fa',   // Blue - Mid Stance
        'TSt': '#a78bfa',   // Purple - Terminal Stance
        'PSw': '#fb923c',   // Orange - Pre-Swing
        'ISw': '#f472b6',   // Pink - Initial Swing
        'MSw': '#8b5cf6',   // Violet - Mid Swing
        'TSw': '#06b6d4'    // Cyan - Terminal Swing
    };

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="waveform-svg" preserveAspectRatio="none">
            {/* Zero line */}
            <line
                x1={padding}
                y1={height / 2}
                x2={width - padding}
                y2={height / 2}
                stroke="var(--color-border)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
            />

            {/* Gait cycle phases */}
            {gaitCycles.map((cycle, cycleIdx) => (
                <g key={cycleIdx}>
                    {cycle.phases.map((phase, phaseIdx) => {
                        const startX = padding + (phase.startFrame / (data.length - 1)) * (width - 2 * padding);
                        const endX = padding + (phase.endFrame / (data.length - 1)) * (width - 2 * padding);
                        const phaseWidth = endX - startX;
                        const color = phaseColors[phase.type] || '#666';

                        return (
                            <g key={`${cycleIdx}-${phaseIdx}`}>
                                {/* Phase background */}
                                <rect
                                    x={startX}
                                    y={padding}
                                    width={phaseWidth}
                                    height={height - 2 * padding}
                                    fill={color}
                                    opacity="0.15"
                                />

                                {/* Phase separator line */}
                                {phaseIdx === 0 && (
                                    <line
                                        x1={startX}
                                        y1={padding}
                                        x2={startX}
                                        y2={height - padding}
                                        stroke={color}
                                        strokeWidth="0.5"
                                        strokeDasharray="1,1"
                                        opacity="0.8"
                                    />
                                )}

                                {/* Phase label (only for major phases) */}
                                {phaseWidth > 3 && ['IC', 'LR', 'MSt', 'TSt', 'PSw', 'ISw'].includes(phase.type) && (
                                    <text
                                        x={startX + phaseWidth / 2}
                                        y={padding + 3}
                                        fontSize="2.5"
                                        fill={color}
                                        textAnchor="middle"
                                        fontWeight="600"
                                    >
                                        {phase.type}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            ))}

            {/* Waveform */}
            <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// Generate auto comment
function generateComment(data: { leftKnee: { amplitude: number; severity: string }; rightKnee: { amplitude: number; severity: string }; asymmetryPercent: number }): string {
    const comments: string[] = [];

    // Compare left and right
    if (data.rightKnee.amplitude > data.leftKnee.amplitude) {
        comments.push(`右膝のlateral thrustが左膝より大きく観察されます（振幅: 右${data.rightKnee.amplitude} cm vs 左${data.leftKnee.amplitude} cm）。`);
    } else if (data.leftKnee.amplitude > data.rightKnee.amplitude) {
        comments.push(`左膝のlateral thrustが右膝より大きく観察されます（振幅: 左${data.leftKnee.amplitude} cm vs 右${data.rightKnee.amplitude} cm）。`);
    } else {
        comments.push('左右の膝でlateral thrustに大きな差は見られません。');
    }

    // Asymmetry
    if (data.asymmetryPercent > 30) {
        comments.push(`左右差が${data.asymmetryPercent}%と顕著です。`);
    }

    // Severity
    if (data.rightKnee.severity === 'high' || data.leftKnee.severity === 'high') {
        comments.push('顕著なlateral thrustが認められます。専門家への相談を推奨します。');
    }

    return comments.join(' ');
}
