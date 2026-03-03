import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import StoreScreen from './screens/StoreScreen';
import AuthScreen from './screens/AuthScreen';
import './App.css';

export type Screen = 'lobby' | 'game' | 'store' | 'auth';

function App() {
    const [user, setUser] = useState<any>(null);
    const [screen, setScreen] = useState<Screen>('auth');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in, listen to their data in Firestore
                const userRef = doc(db, 'users', firebaseUser.uid);
                const unsubData = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUser(docSnap.data());
                        setScreen('lobby');
                    }
                    setLoading(false);
                });
                return () => unsubData();
            } else {
                setUser(null);
                setScreen('auth');
                setLoading(false);
            }
        });
        return () => unsubscribe();
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
                    userCoins={user.coins}
                    userName={user.displayName}
                    purchasedSkins={user.purchasedSkins}
                    activeCardSkinId={user.activeCardSkinId}
                    activeTableSkinId={user.activeTableSkinId}
                />
            )}

            {screen === 'game' && user && (
                <GameScreen
                    onExitGame={() => setScreen('lobby')}
                    activeCardSkinId={user.activeCardSkinId}
                    activeTableSkinId={user.activeTableSkinId}
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
        </div>
    );
}

export default App;
