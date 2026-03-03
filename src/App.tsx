import { useState } from 'react';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import StoreScreen from './screens/StoreScreen';
import './App.css';

export type Screen = 'lobby' | 'game' | 'store';

function App() {
    const [screen, setScreen] = useState<Screen>('lobby');
    const [userCoins] = useState(1500);

    return (
        <div className="app-root">
            {screen === 'lobby' && (
                <LobbyScreen
                    onStartGame={() => setScreen('game')}
                    onOpenStore={() => setScreen('store')}
                    userCoins={userCoins}
                />
            )}
            {screen === 'game' && <GameScreen onExitGame={() => setScreen('lobby')} />}
            {screen === 'store' && (
                <StoreScreen
                    userCoins={userCoins}
                    onBack={() => setScreen('lobby')}
                />
            )}
        </div>
    );
}

export default App;
