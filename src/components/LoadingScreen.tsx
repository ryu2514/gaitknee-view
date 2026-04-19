import './LoadingScreen.css';

interface LoadingScreenProps {
    message?: string;
    subMessage?: string;
    progress?: number;
    trial?: { current: number; total: number };
}

export default function LoadingScreen({
    message = '読み込み中',
    subMessage,
    progress,
    trial,
}: LoadingScreenProps) {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                {/* Knee motion animation */}
                <div className="knee-animation">
                    <svg viewBox="0 0 120 160" className="knee-svg">
                        {/* Thigh */}
                        <line
                            className="bone bone-thigh"
                            x1="60" y1="20" x2="60" y2="70"
                            stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"
                        />
                        {/* Knee joint */}
                        <circle
                            className="joint joint-knee"
                            cx="60" cy="70" r="6"
                            fill="#1e3a5f"
                        />
                        {/* Shank (animated) */}
                        <line
                            className="bone bone-shank"
                            x1="60" y1="70" x2="60" y2="130"
                            stroke="#1e3a5f" strokeWidth="4" strokeLinecap="round"
                        />
                        {/* Lateral thrust indicator */}
                        <line
                            className="thrust-line"
                            x1="66" y1="70" x2="90" y2="70"
                            stroke="#e53e3e" strokeWidth="2" strokeLinecap="round"
                            strokeDasharray="4 3"
                        />
                        <polygon
                            className="thrust-arrow-head"
                            points="88,66 96,70 88,74"
                            fill="#e53e3e"
                        />
                        {/* Hip joint */}
                        <circle cx="60" cy="20" r="4" fill="#94a3b8" />
                        {/* Ankle joint */}
                        <circle
                            className="joint joint-ankle"
                            cx="60" cy="130" r="4"
                            fill="#94a3b8"
                        />
                    </svg>
                </div>

                <div className="loading-text-area">
                    <p className="loading-message">{message}</p>
                    {trial && (
                        <p className="loading-trial">
                            試行 {trial.current} / {trial.total}
                        </p>
                    )}
                    {subMessage && (
                        <p className="loading-sub">{subMessage}</p>
                    )}
                </div>

                {progress != null && (
                    <div className="loading-progress">
                        <div className="loading-progress-track">
                            <div
                                className="loading-progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="loading-progress-label">{progress}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
