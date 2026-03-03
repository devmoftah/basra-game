import { useState, useEffect } from 'react';
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
        // Immediate demo mode for now - skip Firebase entirely
        const timer = setTimeout(() => {
            setUser({
                uid: 'demo',
                displayName: 'لاعب تجريبي',
                coins: 1500,
                purchasedSkins: ['k1', 't2'],
                activeCardSkinId: 'k1',
                activeTableSkinId: 't2',
                stats: { wins: 0, losses: 0, totalGames: 0 }
            });
            setScreen('lobby');
            setLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
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
