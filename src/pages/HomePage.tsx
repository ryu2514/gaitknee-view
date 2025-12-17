import { useNavigate } from 'react-router-dom';
import { useAuth, FREE_MONTHLY_LIMIT } from '../contexts/AuthContext';
import './HomePage.css';

export default function HomePage() {
    const navigate = useNavigate();
    const { user, usage, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="home-page">
            <header className="home-header">
                <h1 className="home-logo">
                    GaitKnee-View
                </h1>
                <div className="home-tagline">
                    <span className="tagline-main">Lateral Thrust Analyzer</span>
                    <span className="tagline-sub">膝関節の動きを可視化・評価</span>
                </div>
            </header>

            <main className="home-main">
                {/* Credits Info Card */}
                <div className="usage-card">
                    <div className="usage-header">
                        <span className="usage-label">📊 歩行分析クレジット</span>
                        {usage?.isPremium && <span className="premium-badge">⭐ プレミアム</span>}
                    </div>
                    <div className="usage-display">
                        {usage?.isPremium ? (
                            <span className="usage-unlimited">無制限</span>
                        ) : (
                            <>
                                <span className="usage-remaining-count">{usage?.remaining || FREE_MONTHLY_LIMIT}</span>
                                <span className="usage-unit">クレジット</span>
                            </>
                        )}
                    </div>
                    {!usage?.isPremium && (
                        <>
                            <div className="usage-info-text">
                                毎月{FREE_MONTHLY_LIMIT}クレジット付与 ｜ 使用済み: {usage?.count || 0}回
                            </div>
                            <button
                                className="purchase-credits-btn"
                                onClick={() => navigate('/purchase')}
                            >
                                + クレジットを追加購入
                            </button>
                        </>
                    )}
                </div>

                <div className="action-cards">
                    <button
                        className="action-card action-card-primary"
                        onClick={() => navigate('/record')}
                    >
                        <div className="action-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 15.2C13.767 15.2 15.2 13.767 15.2 12C15.2 10.233 13.767 8.8 12 8.8C10.233 8.8 8.8 10.233 8.8 12C8.8 13.767 10.233 15.2 12 15.2Z" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M4 4.5C4 3.67157 4.67157 3 5.5 3H8.5C9.32843 3 10 3.67157 10 4.5V5H14V4.5C14 3.67157 14.6716 3 15.5 3H18.5C19.3284 3 20 3.67157 20 4.5V7H20.5C21.3284 7 22 7.67157 22 8.5V19.5C22 20.3284 21.3284 21 20.5 21H3.5C2.67157 21 2 20.3284 2 19.5V8.5C2 7.67157 2.67157 7 3.5 7H4V4.5ZM12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" />
                            </svg>
                        </div>
                        <div className="action-text">
                            <span className="action-title">カメラで撮影</span>
                            <span className="action-desc">リアルタイムで解析</span>
                        </div>
                        <div className="action-arrow">→</div>
                    </button>

                    <button
                        className="action-card"
                        onClick={() => navigate('/upload')}
                    >
                        <div className="action-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" />
                                <path d="M12 11L8 15H10.5V19H13.5V15H16L12 11Z" />
                            </svg>
                        </div>
                        <div className="action-text">
                            <span className="action-title">動画をアップロード</span>
                            <span className="action-desc">既存の動画を解析</span>
                        </div>
                        <div className="action-arrow">→</div>
                    </button>

                    <button
                        className="action-card"
                        onClick={() => navigate('/history')}
                    >
                        <div className="action-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4ZM5 6H19V8H5V6ZM5 10H19V20H5V10Z" />
                                <path d="M7 12H11V14H7V12ZM7 16H17V18H7V16Z" />
                            </svg>
                        </div>
                        <div className="action-text">
                            <span className="action-title">過去データ</span>
                            <span className="action-desc">履歴を確認・比較</span>
                        </div>
                        <div className="action-arrow">→</div>
                    </button>
                </div>

                {/* User Info */}
                <div className="user-info">
                    <span className="user-email">{user?.email}</span>
                    <button className="signout-btn" onClick={handleSignOut}>
                        ログアウト
                    </button>
                </div>
            </main>

            <footer className="home-footer">
                <p className="disclaimer">
                    ※ 本ツールは臨床説明用の簡易評価ツールです。精密な診断には専門的な検査が必要です。
                </p>
            </footer>
        </div>
    );
}
