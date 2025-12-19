import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // If already logged in, redirect to home
    if (user) {
        navigate('/home');
        return null;
    }

    return (
        <div className="landing-page">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1 className="hero-title">
                        膝の動きを<span className="highlight">AI</span>が解析
                    </h1>
                    <p className="hero-subtitle">
                        動画をアップロードするだけで、<br />
                        膝の側方動揺（ラテラルスラスト）を自動測定
                    </p>
                    <div className="hero-cta">
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/login')}
                        >
                            無料で始める
                        </button>
                        <span className="cta-note">毎月5回まで無料</span>
                    </div>
                </div>
                <div className="hero-image">
                    <img src="/demo-analysis.png" alt="歩行解析デモ" />
                </div>
            </section>

            {/* Features Section */}
            <section className="features">
                <h2 className="section-title">理学療法士のための歩行解析ツール</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">📱</div>
                        <h3>スマホで簡単撮影</h3>
                        <p>専門機器不要。スマートフォンで撮影した動画をそのままアップロード。</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🤖</div>
                        <h3>AIによる自動解析</h3>
                        <p>MediaPipe AIが骨格を検出し、膝の側方動揺を自動で計測します。</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📊</div>
                        <h3>詳細なレポート</h3>
                        <p>左右の振幅、波形チャート、ステータス評価をわかりやすく表示。</p>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="how-it-works">
                <h2 className="section-title">使い方は簡単3ステップ</h2>
                <div className="steps">
                    <div className="step">
                        <div className="step-number">1</div>
                        <h3>動画を撮影</h3>
                        <p>患者様の歩行を側面から撮影</p>
                    </div>
                    <div className="step-arrow">→</div>
                    <div className="step">
                        <div className="step-number">2</div>
                        <h3>アップロード</h3>
                        <p>動画ファイルをアップロード</p>
                    </div>
                    <div className="step-arrow">→</div>
                    <div className="step">
                        <div className="step-number">3</div>
                        <h3>結果を確認</h3>
                        <p>AIが自動で解析して結果表示</p>
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section className="use-cases">
                <h2 className="section-title">こんな場面で活用できます</h2>
                <div className="use-cases-grid">
                    <div className="use-case">
                        <span className="use-case-icon">🏥</span>
                        <h4>リハビリ評価</h4>
                        <p>膝OA患者の歩行状態を客観的に評価</p>
                    </div>
                    <div className="use-case">
                        <span className="use-case-icon">📈</span>
                        <h4>経過観察</h4>
                        <p>介入前後の変化を数値で比較</p>
                    </div>
                    <div className="use-case">
                        <span className="use-case-icon">📝</span>
                        <h4>患者説明</h4>
                        <p>視覚的な資料で患者様に説明</p>
                    </div>
                    <div className="use-case">
                        <span className="use-case-icon">🎓</span>
                        <h4>教育・研究</h4>
                        <p>学生教育や臨床研究に活用</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <h2>今すぐ無料で歩行解析を始めましょう</h2>
                <p>登録は1分で完了。クレジットカード不要。</p>
                <button
                    className="btn-primary btn-large"
                    onClick={() => navigate('/login')}
                >
                    無料アカウントを作成
                </button>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <p>© 2025 GaitKnee-View. All rights reserved.</p>
            </footer>
        </div>
    );
}
