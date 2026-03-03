import './LobbyScreen.css';

interface Props {
    onStartGame: () => void;
    onOpenStore: () => void;
    onOpenProfile: () => void;
    userCoins: number;
    userName: string;
}

export default function LobbyScreen({
    onStartGame,
    onOpenStore,
    onOpenProfile,
    userCoins,
    userName
}: Props) {
    return (
        <div className="lobby-root">

            {/* ── Header ───────────────────────────────── */}
            <header className="lobby-header">
                <div className="lobby-header-left">
                    <button className="hdr-icon-btn" aria-label="الإعدادات">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                    <button className="hdr-icon-btn" aria-label="المتجر" onClick={onOpenStore}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                    </button>
                </div>

                <div className="lobby-logo">
                    <span className="logo-ar">الكيش</span>
                    <span className="logo-en">Al Kesh</span>
                </div>

                <div className="lobby-header-right">
                    <div className="coins-badge" onClick={onOpenStore} style={{ cursor: 'pointer' }}>
                        <span className="coin-icon">🪙</span>
                        <span className="coin-amount">{(userCoins || 0).toLocaleString()}</span>
                    </div>
                    <div className="avatar-small" onClick={onOpenProfile} style={{ cursor: 'pointer' }} title="الملف الشخصي">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}&backgroundColor=b6e3f4`} alt={userName} />
                    </div>
                </div>
            </header>

            {/* ── Status Bar ───────────────────────── */}
            <div className="status-bar">
                <span className="status-dot"></span>
                <span>متصل • 6 لاعبين نشطين الآن</span>
            </div>

            {/* ── Body ─────────────────────────────── */}
            <main className="lobby-body">

                {/* ── BASRA CARD ───────────────────────── */}
                <section className="basra-card" onClick={onStartGame}>
                    {/* Sadu top strip */}
                    <div className="sadu-h sadu-h-top" />

                    {/* Felt + side sadu */}
                    <div className="basra-felt-inner">
                        <div className="sadu-v" />
                        <div className="basra-felt-center">

                            {/* Deco cards */}
                            <div className="bc bc-left">
                                <span className="bc-suit red">♥</span>
                                <span className="bc-val">J</span>
                            </div>
                            <div className="bc bc-right">
                                <span className="bc-suit red">♦</span>
                                <span className="bc-val">A</span>
                            </div>
                            <div className="bc bc-far-left">
                                <span className="bc-suit">♣</span>
                                <span className="bc-val">7</span>
                            </div>
                            <div className="bc bc-far-right">
                                <span className="bc-suit">♠</span>
                                <span className="bc-val">K</span>
                            </div>

                            {/* Center golden badge */}
                            <div className="basra-center-badge">
                                <span className="bcb-text">البصرة</span>
                            </div>

                        </div>
                        <div className="sadu-v" />
                    </div>

                    {/* Sadu bottom strip */}
                    <div className="sadu-h sadu-h-bot" />

                    {/* Play button bar below table */}
                    <button className="basra-play-btn" onClick={e => { e.stopPropagation(); onStartGame(); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                            <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                        لعبة جديدة
                    </button>
                </section>

                {/* ── Coming Soon Games ──────────── */}
                <div className="games-grid">
                    {COMING_SOON.map(g => (
                        <div key={g.name} className="game-tile coming-soon-tile">
                            <div className="tile-card-icon">{g.cardIcon}</div>
                            <span className="tile-name">{g.name}</span>
                            <span className="tile-tag">قريباً</span>
                        </div>
                    ))}
                </div>

            </main>

            {/* ── Bottom Nav (3 items) ────────── */}
            <nav className="bottom-nav">
                <button className="nav-item active">
                    <span className="nav-icon">🏠</span>
                    <span className="nav-label">الرئيسية</span>
                </button>
                <button className="nav-item" onClick={onOpenStore}>
                    <span className="nav-icon">🛍️</span>
                    <span className="nav-label">المتجر</span>
                </button>
                <button className="nav-item" onClick={onOpenProfile}>
                    <span className="nav-icon">👤</span>
                    <span className="nav-label">الملف الشخصي</span>
                </button>
            </nav>
        </div>
    );
}

/* ── Static data ─────────────────────────────── */
const COMING_SOON = [
    {
        name: 'البلوت',
        cardIcon: (
            <div className="card-icon-ace">
                <span className="ci-tl red">A<br />♦</span>
                <span className="ci-center red">♦</span>
                <span className="ci-br red">A<br />♦</span>
            </div>
        ),
    },
    {
        name: 'تركس كمبلكس',
        cardIcon: (
            <div className="card-icon-trix">
                <span className="ci-tl">T</span>
                <span className="ci-center trix-star">★</span>
                <span className="ci-br">T</span>
            </div>
        ),
    },
    {
        name: 'اللودو',
        cardIcon: <span style={{ fontSize: 44 }}>🎲</span>,
    },
    {
        name: 'الرومينو',
        cardIcon: (
            <div className="card-icon-joker">
                <span className="joker-top">🃏</span>
                <span className="joker-label">JOKER</span>
            </div>
        ),
    },
];
