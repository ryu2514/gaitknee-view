import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleForgotPassword = async () => {
        if (!email) {
            setError('メールアドレスを入力してください');
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await resetPassword(email);
        if (error) {
            setError('パスワードリセットメールの送信に失敗しました');
        } else {
            setMessage('パスワードリセットメールを送信しました。メールをご確認ください。');
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (!email || !password) {
            setError('メールアドレスとパスワードを入力してください');
            return;
        }

        if (!isLogin && (!lastName || !firstName)) {
            setError('姓と名を入力してください');
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            setError('パスワードが一致しません');
            return;
        }

        if (password.length < 6) {
            setError('パスワードは6文字以上で入力してください');
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await signIn(email, password);
                if (error) {
                    if (error.message.includes('Invalid login')) {
                        setError('メールアドレスまたはパスワードが正しくありません');
                    } else {
                        setError(error.message);
                    }
                } else {
                    navigate('/');
                }
            } else {
                const { error } = await signUp(email, password, lastName, firstName);
                if (error) {
                    setError(error.message);
                } else {
                    setMessage('確認メールを送信しました。メールを確認してアカウントを有効化してください。');
                }
            }
        } catch (err) {
            setError('エラーが発生しました。もう一度お試しください。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>GaitKnee-View</h1>
                    <p className="login-subtitle">膝関節 Lateral Thrust 可視化ツール</p>
                </div>

                <div className="login-card">
                    <div className="login-tabs">
                        <button
                            className={`tab ${isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(true); setError(null); setMessage(null); }}
                        >
                            ログイン
                        </button>
                        <button
                            className={`tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(false); setError(null); setMessage(null); }}
                        >
                            新規登録
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">メールアドレス</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@email.com"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">パスワード</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="6文字以上"
                                disabled={loading}
                            />
                            {isLogin && (
                                <button
                                    type="button"
                                    className="forgot-password-link"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                >
                                    パスワードを忘れた場合
                                </button>
                            )}
                        </div>

                        {!isLogin && (
                            <>
                                <div className="form-row">
                                    <div className="form-group half">
                                        <label htmlFor="lastName">姓 <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input
                                            type="text"
                                            id="lastName"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="山田"
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                    <div className="form-group half">
                                        <label htmlFor="firstName">名 <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input
                                            type="text"
                                            id="firstName"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="太郎"
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="confirmPassword">パスワード確認</label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="パスワードを再入力"
                                        disabled={loading}
                                    />
                                </div>
                            </>
                        )}

                        {error && <div className="error-message">{error}</div>}
                        {message && <div className="success-message">{message}</div>}

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? '処理中...' : isLogin ? 'ログイン' : '登録する'}
                        </button>
                    </form>

                    <div className="divider">
                        <span>または</span>
                    </div>

                    <button
                        className="google-btn"
                        onClick={async () => {
                            setLoading(true);
                            await signInWithGoogle();
                        }}
                        disabled={loading}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {isLogin ? 'Googleでログイン' : 'Googleで新規登録'}
                    </button>

                    <div className="login-info">
                        <p>📊 月5回まで無料で解析できます</p>
                        <p>⭐ クレジットパックで追加利用可能</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
