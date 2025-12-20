import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

export default function CompleteProfilePage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!lastName.trim() || !firstName.trim()) {
            setError('姓と名を入力してください');
            return;
        }

        if (!user) {
            setError('ログインしてください');
            return;
        }

        setLoading(true);

        try {
            // Check if profile exists
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (existingProfile) {
                // Update existing profile
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        last_name: lastName.trim(),
                        first_name: firstName.trim()
                    })
                    .eq('id', user.id);

                if (updateError) throw updateError;
            } else {
                // Create new profile
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        last_name: lastName.trim(),
                        first_name: firstName.trim()
                    });

                if (insertError) throw insertError;
            }

            navigate('/');
        } catch (err: any) {
            console.error('Profile update error:', err);
            setError('プロフィールの保存に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>GaitKnee-View</h1>
                    <p className="login-subtitle">プロフィール登録</p>
                </div>

                <div className="login-card">
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                            サービスをご利用いただくために、<br />
                            お名前の登録をお願いします。
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
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

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? '保存中...' : '登録を完了する'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
