import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import StoreScreen from './screens/StoreScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import './App.css';

export type Screen = 'lobby' | 'game' | 'store' | 'purchases' | 'auth' | 'profile';

function App() {
    const [user, setUser] = useState<any>(null);
    const [screen, setScreen] = useState<Screen>('auth');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubData: (() => void) | null = null;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (unsubData) { unsubData(); unsubData = null; }

            if (firebaseUser) {
                const userRef = doc(db, 'users', firebaseUser.uid);
                unsubData = onSnapshot(userRef,
                    (docSnap) => {
                        if (docSnap.exists()) {
                            setUser(docSnap.data());
                            setScreen('lobby');
                        } else {
                            setScreen('auth');
                        }
                        setLoading(false);
                    },
                    (error) => {
                        console.error("Firestore loading error:", error);
                        setScreen('auth');
                        setLoading(false);
                    }
                );
            } else {
                setUser(null);
                setScreen('auth');
                setLoading(false);
            }
        }, (error) => {
            console.error("Auth state change error:", error);
            setScreen('auth');
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (unsubData) unsubData();
        };
    }, []);

    if (loading) {
        return (
            <div className="app-loading">
                <div className="loader"></div>
                <span>جاري تحميل عالم البصرة...</span>
            </div>
        );
    }

    return (
        <div className="app-root">
            {screen === 'auth' && <AuthScreen onAuthSuccess={(data) => {
                setUser(data);
                setScreen('lobby');
            }} />}

            {screen === 'lobby' && user && (
                <LobbyScreen
                    onStartGame={() => setScreen('game')}
                    onOpenStore={() => setScreen('store')}
                    onOpenPurchases={() => setScreen('purchases')}
                    onOpenProfile={() => setScreen('profile')}
                    userCoins={user.coins}
                    userName={user.displayName}
                />
            )}

            {screen === 'game' && user && (
                <GameScreen
                    onExitGame={() => setScreen('lobby')}
                    activeCardSkinId={user.activeCardSkinId}
                    activeTableSkinId={user.activeTableSkinId}
                />
            )}

            {screen === 'purchases' && user && (
                <PurchasesScreen
                    userCoins={user.coins}
                    onBack={() => setScreen('lobby')}
                />
            )}

            {screen === 'store' && user && (
                <StoreScreen
                    userCoins={user.coins}
                    purchasedSkins={user.purchasedSkins}
                    activeCardSkin={user.activeCardSkinId}
                    activeTableSkin={user.activeTableSkinId}
                    onBack={() => setScreen('lobby')}
                />
            )}

            {screen === 'profile' && user && (
                <ProfileScreen
                    onBack={() => setScreen('lobby')}
                />
            )}
        </div>
    );
}

export default App;
