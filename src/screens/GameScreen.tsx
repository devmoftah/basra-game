import { useState, useEffect, useRef } from 'react';
import {
    GameState, Card, CaptureOption,
    SUIT_SYMBOL, SUIT_COLOR, cardDisplay, Suit, GameRoom,
} from '../game/basraTypes';
import {
    dealNewRound, applyMove, processScore, findCaptures,
} from '../game/basraEngine';
import { STORE_ITEMS } from '../data/storeItems';
import { db, auth } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { findOrCreateRoom, startGameInRoom, replacePlayerWithBot } from '../game/multiplayerService';
import './GameScreen.css';

interface Props {
    onExitGame: () => void;
    activeCardSkinId?: string;
    activeTableSkinId?: string;
}

interface PendingMove {
    card: Card;
    playerIndex: number;
    capture: CaptureOption | null;
}

export default function GameScreen({ onExitGame, activeCardSkinId, activeTableSkinId }: Props) {
    const defaultSkin = STORE_ITEMS.find(s => s.id === 'k1');
    const [gs, setGs] = useState<GameState | null>(null);
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [turnTimer, setTurnTimer] = useState(7);
    const tableSkin = STORE_ITEMS.find(s => s.id === activeTableSkinId);
    const myCardSkin = STORE_ITEMS.find(s => s.id === activeCardSkinId) || defaultSkin;

    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [validCapture, setValidCapture] = useState<CaptureOption | null>(null);
    const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
    const [countdown, setCountdown] = useState<number>(0);
    const [previewMove, setPreviewMove] = useState<PendingMove | null>(null);

    const isHost = room?.adminId === auth.currentUser?.uid;
    const isProcessingMove = useRef(false);
    const isScoringInProgress = useRef(false);

    // Handle immediate bot replacement on exit
    useEffect(() => {
        return () => {
            // When component unmounts (player exits), replace with bot immediately
            if (room && auth.currentUser) {
                replacePlayerWithBot(room.id, auth.currentUser.uid);
            }
        };
    }, [room]);

    // Join Room logic
    useEffect(() => {
        let unsub: any;
        const join = async () => {
            try {
                const rid = await findOrCreateRoom(auth.currentUser?.displayName || 'لاعب', activeCardSkinId || 'k1');
                unsub = onSnapshot(doc(db, 'rooms', rid), (s) => {
                    const data = s.data() as GameRoom;
                    if (data) {
                        // ✅ FIX: s.data() doesn't include the document ID, 
                        // so we add it manually for join/leave logic
                        const roomWithId = { ...data, id: s.id };
                        setRoom(roomWithId);
                        setGs(roomWithId.gameState);
                        setLoadingRoom(false);
                        
                        console.log('✅ Room joined successfully:', roomWithId.id);
                    } else {
                        // Room deleted
                        console.error('❌ Room deleted');
                        onExitGame();
                    }
                });
            } catch (err) {
                console.error('❌ Failed to join room:', err);
                onExitGame();
            }
        };
        join();
        return () => unsub && unsub();
    }, []);

    // ── Always-fresh refs to avoid stale closures in async callbacks ──
    const gsRef = useRef<GameState | null>(null);
    const roomRef = useRef<typeof room>(null);
    useEffect(() => { gsRef.current = gs; }, [gs]);
    useEffect(() => { roomRef.current = room; }, [room]);

    // ── Apply a move to Firestore ──────────────────────────────────────
    const performMoveLocal = (card: Card, capture: CaptureOption | null, forcedGs?: GameState, forcedRoom?: typeof room) => {
        const curGs = forcedGs || gsRef.current;
        const curRoom = forcedRoom || roomRef.current;
        if (!curGs || !curRoom || isProcessingMove.current) return;
        isProcessingMove.current = true;

        setPreviewMove({ card, playerIndex: curGs.currentPlayer, capture });

        setTimeout(async () => {
            try {
                const nextGs = applyMove(curGs, curGs.currentPlayer, card, capture);
                
                // Set different deadlines based on player type
                const currentPlayerObj = nextGs.players[nextGs.currentPlayer];
                const deadline = currentPlayerObj?.isHuman ? 15000 : 3000; // 15s for human, 3s for bot
                nextGs.turnDeadline = Date.now() + deadline;
                
                await updateDoc(doc(db, 'rooms', curRoom.id), { gameState: nextGs });
            } catch (e) {
                console.error('Move failed:', e);
            } finally {
                setPreviewMove(null);
                setSelectedCard(null);
                setValidCapture(null);
                setHighlightIds(new Set());
                isProcessingMove.current = false;
            }
        }, 600);
    };

    // ── Bot auto-play: fires 1.5s after it becomes a bot's turn ───────
    useEffect(() => {
        if (!gs || !room || !isHost || gs.phase !== 'playing') return;
        const currentP = gs.players[gs.currentPlayer];
        if (!currentP || currentP.isHuman) return; // Only for bots

        const t = setTimeout(() => {
            const latestGs = gsRef.current;
            const latestRoom = roomRef.current;
            if (!latestGs || !latestRoom || isProcessingMove.current) return;
            if (latestGs.phase !== 'playing') return;
            if (latestGs.currentPlayer !== gs.currentPlayer) return; // Turn already moved on

            const p = latestGs.players[latestGs.currentPlayer];
            if (!p || p.isHuman || p.hand.length === 0) return;

            const randomCard = p.hand[Math.floor(Math.random() * p.hand.length)];
            const captures = findCaptures(randomCard, latestGs.tableCards);
            const bestCap = captures.length > 0 ? captures[0] : null;
            performMoveLocal(randomCard, bestCap, latestGs, latestRoom);
        }, 3000); // Bot plays after 3 seconds

        return () => clearTimeout(t);
    }, [gs?.currentPlayer, gs?.phase, room?.status, isHost]);

    // ── Timer: countdown display + human turn timeout ──────────────────
    useEffect(() => {
        if (!gs || room?.status !== 'playing' || gs.phase !== 'playing') return;

        const timer = setInterval(() => {
            const latestGs = gsRef.current;
            if (!latestGs?.turnDeadline) return;
            const diff = Math.max(0, Math.ceil((latestGs.turnDeadline - Date.now()) / 1000));
            setTurnTimer(diff);

            if (diff === 0 && !isProcessingMove.current) {
                const myIdx = latestGs.players.findIndex(p => p.uid === auth.currentUser?.uid);
                const effectiveMyIdx = myIdx >= 0 ? myIdx : 0;
                // Only auto-play for human timeout (bots are handled by bot effect above)
                if (latestGs.currentPlayer === effectiveMyIdx) {
                    const p = latestGs.players[effectiveMyIdx];
                    if (!p || p.hand.length === 0) return;
                    const randomCard = p.hand[Math.floor(Math.random() * p.hand.length)];
                    const captures = findCaptures(randomCard, latestGs.tableCards);
                    const bestCap = captures.length > 0 ? captures[0] : null;
                    performMoveLocal(randomCard, bestCap, latestGs, roomRef.current);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [gs?.currentPlayer, gs?.turnDeadline, room?.status]);

    // ── Flash message clear ────────────────────────────────────────────
    useEffect(() => {
        if (!gs?.flashMessage) return;
        const t = setTimeout(() => {
            if (room && isHost) {
                updateDoc(doc(db, 'rooms', room.id), { 'gameState.flashMessage': null });
            }
        }, 2300);
        return () => clearTimeout(t);
    }, [gs?.flashMessage]);

    // Handle Score and Rounds (Only Host processes state changes)
    useEffect(() => {
        if (!isHost || !room || !gs) return;

        if (gs.phase === 'roundEnd' && !isScoringInProgress.current) {
            isScoringInProgress.current = true;
            const nextGs = processScore(gs);
            updateDoc(doc(db, 'rooms', room.id), { gameState: nextGs });
        }

        if (gs.phase === 'roundEndScored') {
            setCountdown(6);
            const timer = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) {
                        clearInterval(timer);
                        isScoringInProgress.current = false;
                        const dealtGs = dealNewRound(gs);
                        
                        // Set deadline based on first player of new round
                        const firstPlayer = dealtGs.players[dealtGs.currentPlayer];
                        const deadline = firstPlayer?.isHuman ? 15000 : 3000;
                        dealtGs.turnDeadline = Date.now() + deadline;
                        
                        updateDoc(doc(db, 'rooms', room.id), { gameState: dealtGs });
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [gs?.phase, isHost]);


    const handleSelect = (e: React.MouseEvent, card: Card) => {
        e.stopPropagation();
        const latestGs = gsRef.current;
        if (!latestGs || latestGs.phase !== 'playing' || previewMove) return;

        const myIdx = latestGs.players.findIndex(p => p.uid === auth.currentUser?.uid);
        const effectiveMyIdx = myIdx >= 0 ? myIdx : 0;
        if (latestGs.currentPlayer !== effectiveMyIdx) return;

        if (selectedCard?.id === card.id) {
            performMoveLocal(selectedCard, validCapture, latestGs, roomRef.current);
            return;
        }
        setSelectedCard(card);
        const caps = findCaptures(card, latestGs.tableCards);
        if (caps.length > 0) {
            setValidCapture(caps[0]);
            setHighlightIds(new Set(caps[0].cards.map(c => c.id)));
        } else {
            setValidCapture(null); setHighlightIds(new Set());
        }
    };

    if (loadingRoom || !gs || !room) {
        return <div className="app-loading"><div className="loader" /><span>جاري التحميل...</span></div>;
    }

    if (room.status === 'waiting') {
        const slots = [0, 1, 2, 3];
        return (
            <div className="waiting-room">
                <div className="wr-box">
                    <h2 className="wr-title">طاولة رقم {room.id.slice(0, 4)}</h2>
                    <p className="wr-subtitle">في انتظار اللاعبين...</p>
                    <div className="wr-players">
                        {slots.map((i) => {
                            const p = room.players[i];
                            return (
                                <div key={i} className="wr-p-slot">
                                    {p?.isHuman ? (
                                        <>
                                            <div className="wr-avatar"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} alt="" /></div>
                                            <span className="wr-name">{p.name} {p.id === 0 && '👑'}</span>
                                        </>
                                    ) : (
                                        <div className="wr-placeholder">فارغ</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="wr-actions">
                        {isHost ? (
                            <button className="wr-btn" onClick={() => startGameInRoom(room.id)}>ابدأ اللعبة بالبوتات</button>
                        ) : (
                            <div className="wr-msg">في انتظار الآدمن لبدء اللعبة...</div>
                        )}
                        <button className="gtb-btn exit-btn" onClick={onExitGame}>خروج</button>
                    </div>
                </div>
            </div>
        );
    }

    const myIndexRaw = gs.players.findIndex(p => p.uid === auth.currentUser?.uid);
    const myIndex = myIndexRaw >= 0 ? myIndexRaw : 0; // ✅ fallback to seat 0 if UID not matched
    const human = gs.players[myIndex] || { hand: [], basraPoints: 0 };
    const turnsSafe = (idx: number) => gs.players[idx] || { name: '...', hand: [], basraPoints: 0, activeSkinId: 'k1' };
    const isActuallyMyTurn = gs.currentPlayer === myIndex && gs.phase === 'playing' && !previewMove;

    return (
        <div className="game-root" onClick={() => {
            setSelectedCard(null);
            setValidCapture(null);
            setHighlightIds(new Set());
        }}>
            {gs.flashMessage && <div className="flash-msg">{gs.flashMessage}</div>}

            {(gs.phase === 'roundEndScored' || gs.phase === 'gameEnd') && (
                <ResultOverlay gs={gs} countdown={countdown} onExit={onExitGame} />
            )}

            <header className="game-top-bar">
                <div className="gtb-left">
                    <button className="gtb-btn" onClick={onExitGame}>خروج</button>
                    <div className="round-badge">جولة {gs.roundNumber}</div>
                </div>
                <div className="gtb-scoreboard">
                    <div className="gsb-vals">
                        <span>{gs.totalScores[1]}</span>
                        <div className="gsb-div" />
                        <span>{gs.totalScores[0]}</span>
                    </div>
                    <div className="gsb-sub">هم | نحن (الهدف 250)</div>
                </div>
                <div className="gtb-right">
                    <div className={`turn-ind ${isActuallyMyTurn ? 'my-turn' : ''}`}>
                        {previewMove ? `● يلعب: ${gs.players[previewMove.playerIndex]?.name || '...'}` :
                            (isActuallyMyTurn ? `● دورك (${turnTimer}ث)` : `● ${gs.players[gs.currentPlayer]?.name || '...'} (${turnTimer}ث)`)}
                    </div>
                </div>
            </header>

            <main className="game-table-area">
                <Opponent player={turnsSafe((myIndex + 2) % 4)} pos="top" active={gs.currentPlayer === (myIndex + 2) % 4} />
                <Opponent player={turnsSafe((myIndex + 1) % 4)} pos="left" active={gs.currentPlayer === (myIndex + 1) % 4} />
                <Opponent player={turnsSafe((myIndex + 3) % 4)} pos="right" active={gs.currentPlayer === (myIndex + 3) % 4} />

                <div className="sadu-table" style={{
                    background: tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[1]} 0%, ${tableSkin.colors[0]} 100%)` : undefined
                }}>
                    <div className="sadu-border">
                        <div className="felt-center" style={{
                            background: tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[0]} 0%, ${tableSkin.colors[1]} 100%)` : undefined
                        }}>
                            {gs.tableCards.length === 0 && !previewMove && <span className="empty-hint">الأرض فارغة</span>}
                            {gs.tableCards.map((c, i) => (
                                <CardComp key={c.id} card={c} style={{ transform: `rotate(${(i % 4 - 2) * 6}deg)`, marginRight: i > 0 ? '-24px' : '0', zIndex: i }} hl={highlightIds.has(c.id)} />
                            ))}

                            {previewMove && gs.players[previewMove.playerIndex] && (
                                <div className="preview-layer">
                                    <CardComp
                                        card={previewMove.card}
                                        size="large"
                                        hl={true}
                                        cardSkin={STORE_ITEMS.find(s => s.id === gs.players[previewMove.playerIndex].activeSkinId)}
                                        style={{
                                            boxShadow: '0 0 30px rgba(255,215,0,0.8)',
                                            animation: 'cardEntry 0.3s ease-out'
                                        }}
                                    />
                                    <div className="player-indicator-tag">
                                        {gs.players[previewMove.playerIndex].name}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="deck-info">
                    {gs.deck.length > 0 && (
                        <CardComp
                            card={{ id: 'deck', suit: 'spades', value: 0 }}
                            style={{ isBack: true, transform: 'scale(0.8)' }}
                            cardSkin={myCardSkin}
                            size="small"
                        />
                    )}
                    <span>{gs.deck.length}</span>
                </div>
            </main>

            <div className="player-hand-area">
                <div className="hand-label">{human.basraPoints > 0 && <span>⭐ بصرة: {human.basraPoints}</span>}</div>
                <div className="hand-cards">
                    {human.hand.map((c: any, i: number) => {
                        const rot = (i - (human.hand.length - 1) / 2) * 7;
                        const isSel = selectedCard?.id === c.id;
                        return <CardComp key={c.id} card={c} size="large" onClick={(e: any) => handleSelect(e, c)} hl={isSel} cardSkin={myCardSkin} style={{ transform: `rotate(${rot}deg) translateY(${isSel ? -25 : 0}px)`, zIndex: isSel ? 50 : i, opacity: previewMove ? 0.5 : 1 }} />;
                    })}
                </div>
            </div>

        </div>
    );
}

function CardComp({ card, style, hl, onClick, size, cardSkin }: any) {
    const s = SUIT_SYMBOL[card.suit as Suit];
    const v = cardDisplay(card.value);
    const isBack = style?.isBack;

    const skin = cardSkin || STORE_ITEMS.find(s => s.id === 'k1');
    const isImageSkin = skin?.image?.endsWith('.png');
    const isSmall = size === 'small';

    return (
        <div
            className={`playing-card ${size === 'large' ? 'card-lg' : ''} ${hl ? 'card-hl' : ''} ${onClick ? 'card-btn' : ''}`}
            style={{
                color: SUIT_COLOR[card.suit as Suit],
                ...style,
                backgroundColor: isBack ? (skin?.colors?.[0] || '#222') : '#fff',
                borderColor: isBack ? (skin?.colors?.[1] || '#444') : '#ddd',
                backgroundImage: isBack && isImageSkin ? `url(${skin.image})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
            onClick={onClick}
        >
            {!isBack && (
                <>
                    <div className="pc-tl"><span className="pc-v">{v}</span><span className="pc-s">{s}</span></div>
                    <div className="pc-mid">{s}</div>
                    <div className="pc-br"><span className="pc-v">{v}</span><span className="pc-s">{s}</span></div>
                </>
            )}
            {isBack && !isImageSkin && (
                <div className="card-back-pattern" style={{
                    border: `${isSmall ? '4px' : '10px'} solid ${skin?.colors?.[1] || '#444'}`,
                    height: '100%', width: '100%', boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card-back-logo" style={{
                        fontSize: isSmall ? '0.8rem' : '2rem',
                        opacity: 0.3
                    }}>{skin?.name?.charAt(0) || 'B'}</div>
                </div>
            )}
        </div>
    );
}

function Opponent({ player, pos, active }: any) {
    const skin = STORE_ITEMS.find(s => s.id === player.activeSkinId);
    return (
        <div className={`player-slot ps-${pos} ${active ? 'ps-active' : ''}`}>
            <div className="ps-avatar"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.name}`} alt="" />{active && <div className="ps-ring" />}</div>
            <div className="ps-name">{player.name}{player.basraPoints > 0 && <span className="ps-pts">{player.basraPoints}⭐</span>}</div>
            <div className="ps-cards">
                {Array.from({ length: player.hand.length }).map((_, i) => (
                    <CardComp
                        key={i}
                        card={{ id: `back-${i}`, suit: 'spades', value: 0 }}
                        style={{ isBack: true, marginLeft: i > 0 ? '-45px' : '0' }}
                        cardSkin={skin}
                        size="small"
                    />
                ))}
            </div>
        </div>
    );
}

function ResultOverlay({ gs, countdown, onExit }: any) {
    const r = (gs as any).lastRoundScores || [0, 0];
    const c0 = gs.players.filter((p: any) => p.team === 0).reduce((s: any, p: any) => s + p.captured.length, 0);
    const c1 = gs.players.filter((p: any) => p.team === 1).reduce((s: any, p: any) => s + p.captured.length, 0);
    return (
        <div className="overlay">
            <div className="overlay-box">
                <h2 className="ov-title">{gs.phase === 'gameEnd' ? '🏆 انتهت اللعبة' : '📊 نقاط الجولة'}</h2>
                {gs.winner !== null && <div className={`ov-winner ${gs.winner === 0 ? 'win' : 'lose'}`}>{gs.winner === 0 ? '🎉 مبروك الفوز!' : '😢 هاردلك، فاز الخصم'}</div>}
                <div className="score-tbl">
                    <div className="sr header"><span>البند</span><span>نحن</span><span>هم</span></div>
                    <div className="sr"><span>البصرات</span><span>{r[0]}</span><span>{r[1]}</span></div>
                    <div className="sr"><span>أكثر ورق (+20)</span><span>{c0 > c1 ? 20 : '-'}</span><span>{c1 > c0 ? 20 : '-'}</span></div>
                    <div className="sr total"><span>المجموع الكلي</span><span>{gs.totalScores[0]}</span><span>{gs.totalScores[1]}</span></div>
                </div>
                {gs.phase === 'gameEnd' ? <button className="ov-btn" onClick={onExit}>خروج</button> : <div className="ov-countdown">الجولة التالية خلال <strong>{countdown}</strong> ثوانٍ</div>}
            </div>
        </div>
    );
}
