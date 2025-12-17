import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CREDIT_PACKS, type CreditPack } from '../lib/stripe';
import './PurchasePage.css';

export default function PurchasePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, usage, refreshUsage } = useAuth();
    const [purchasing, setPurchasing] = useState<string | null>(null);

    // Check for success/canceled from Stripe redirect
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    // Refresh usage when returning from successful purchase
    if (success === 'true') {
        refreshUsage();
    }

    const handlePurchase = async (pack: CreditPack) => {
        if (!user) {
            navigate('/login');
            return;
        }

        setPurchasing(pack.id);

        try {
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    priceId: pack.priceId,
                    credits: pack.credits,
                    userId: user.id,
                    userEmail: user.email,
                },
            });

            if (error) {
                console.error('Checkout error:', error);
                alert('購入処理でエラーが発生しました。もう一度お試しください。');
                return;
            }

            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Purchase error:', err);
            alert('購入処理でエラーが発生しました。');
        } finally {
            setPurchasing(null);
        }
    };

    return (
        <div className="purchase-page">
            <header className="purchase-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    ← 戻る
                </button>
                <h1>クレジット購入</h1>
            </header>

            <main className="purchase-main">
                {success === 'true' && (
                    <div className="success-message">
                        ✅ 購入が完了しました！クレジットが追加されました。
                    </div>
                )}
                {canceled === 'true' && (
                    <div className="canceled-message">
                        購入がキャンセルされました。
                    </div>
                )}

                <div className="current-credits">
                    <span className="credits-label">現在のクレジット</span>
                    <span className="credits-value">{usage?.remaining || 0}</span>
                </div>

                <div className="packs-grid">
                    {CREDIT_PACKS.map((pack) => (
                        <div
                            key={pack.id}
                            className={`pack-card ${pack.popular ? 'popular' : ''}`}
                        >
                            {pack.popular && <div className="popular-badge">人気</div>}
                            <h2 className="pack-name">{pack.name}</h2>
                            <div className="pack-credits">{pack.credits}回</div>
                            <div className="pack-price">
                                <span className="price-yen">¥</span>
                                <span className="price-value">{pack.price.toLocaleString()}</span>
                            </div>
                            <div className="pack-unit">
                                ¥{Math.round(pack.price / pack.credits)}/回
                            </div>
                            <p className="pack-description">{pack.description}</p>
                            <button
                                className="purchase-btn"
                                onClick={() => handlePurchase(pack)}
                                disabled={purchasing === pack.id}
                            >
                                {purchasing === pack.id ? '処理中...' : '購入する'}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="purchase-notes">
                    <h3>ご利用について</h3>
                    <ul>
                        <li>購入したクレジットは翌月以降も引き継がれます</li>
                        <li>毎月5クレジットが無料で付与されます</li>
                        <li>無料クレジットから先に消費されます</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
