import { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    AuthProvider
} from 'firebase/auth';
import { auth, googleProvider, appleProvider, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import './AuthScreen.css';

interface Props {
    onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: Props) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInitialUserSetup = async (user: any) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // New user, initialize data
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'لاعب بصرة',
                coins: 1500,
                purchasedSkins: ['card_back_darnes.png'],
                activeSkin: 'card_back_darnes.png',
                stats: { wins: 0, losses: 0, totalGames: 0 },
                createdAt: new Date().toISOString()
            };
            await setDoc(userRef, userData);
            return userData;
        }
        return userSnap.data();
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            let userCredential;
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            }
            const userData = await handleInitialUserSetup(userCredential.user);
            onAuthSuccess(userData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialAuth = async (provider: AuthProvider) => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            const userData = await handleInitialUserSetup(result.user);
            onAuthSuccess(userData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-root">
            <div className="auth-container">
                <div className="auth-logo">
                    <span className="logo-ar">الكيش</span>
                    <span className="auth-title">{isLogin ? 'تسجيل الدخول' : 'حساب جديد'}</span>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleEmailAuth}>
                    <div className="auth-input-group">
                        <label>البريد الإلكتروني</label>
                        <input
                            className="auth-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@mail.com"
                            required
                        />
                    </div>
                    <div className="auth-input-group">
                        <label>كلمة المرور</label>
                        <input
                            className="auth-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button className="auth-submit-btn" type="submit" disabled={loading}>
                        {loading ? 'جاري التحميل...' : (isLogin ? 'دخول' : 'إنشاء حساب')}
                    </button>
                </form>

                <div className="auth-divider">أو عبر</div>

                <div className="social-auth">
                    <button className="social-btn" onClick={() => handleSocialAuth(googleProvider)}>
                        <svg viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        الدخول عبر قوقل
                    </button>
                    <button className="social-btn" onClick={() => handleSocialAuth(appleProvider)}>
                        <svg viewBox="0 0 24 24">
                            <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05 1.78-3.19 1.76-1.07-.02-1.42-.68-2.66-.68-1.24 0-1.63.66-2.65.69-1.12.03-2.31-.92-3.29-1.87-1.98-1.93-3.41-5.41-1.37-8.91 1.02-1.74 2.8-2.81 4.74-2.84 1.48-.02 2.87 1.03 3.77 1.03s2.61-1.27 4.38-1.09c.75.03 2.85.31 4.2 2.29-2.25 1.33-1.89 4.39.46 5.56-.81 2.03-1.84 4.09-3.4 5.07zM12.03 7.25c-.02-2.23 1.83-4.14 3.95-4.25.26 2.45-2.09 4.36-3.95 4.25z" />
                        </svg>
                        الدخول عبر أبل
                    </button>
                </div>

                <div className="auth-footer">
                    {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                    <span className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? 'إنشاء حساب جديد' : 'تسجيل دخول'}
                    </span>
                </div>
            </div>
        </div>
    );
}
