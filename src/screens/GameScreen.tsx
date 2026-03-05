import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { findOrCreateRoom, startGameInRoom, replacePlayerWithBot, markVoluntaryExit } from '../game/multiplayerService';
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

// Helper: optimized scatter using a "slot" system based on card index to prevent clustering
function getTableCardPosition(cardId: string, index: number) {
    let hash = 0;
    for (let i = 0; i < cardId.length; i++) {
        hash = ((hash << 5) - hash) + cardId.charCodeAt(i);
        hash = hash & hash;
    }
    hash = Math.abs(hash);

    const slots = [
        { x: 38, y: 38 }, { x: 62, y: 62 }, { x: 62, y: 38 }, { x: 38, y: 62 },
        { x: 50, y: 50 }, { x: 50, y: 35 }, { x: 50, y: 65 }, { x: 35, y: 50 }, { x: 65, y: 50 },
    ];

    const slot = slots[index % slots.length];
    const jitterX = (hash % 10) - 5;
    const jitterY = ((hash >> 4) % 10) - 5;

    return {
        left: slot.x + jitterX,
        top: slot.y + jitterY,
        rotation: ((hash >> 14) % 26) - 13,
    };
}

// Helper: Get player position relative to the table for animation origins
function getPlayerPositionStyles(playerIdx: number, myIdx: number) {
    const relativePos = (playerIdx - myIdx + 4) % 4;
    switch (relativePos) {
        case 0: return { left: '50%', top: '150%', x: '-50%', y: '-50%' }; // Bottom (Me)
        case 1: return { left: '-50%', top: '50%', x: '-50%', y: '-50%' };  // Left
        case 2: return { left: '50%', top: '-50%', x: '-50%', y: '-50%' };  // Top
        case 3: return { left: '150%', top: '50%', x: '-50%', y: '-50%' }; // Right
        default: return { left: '50%', top: '50%', x: '-50%', y: '-50%' };
    }
}

export default function GameScreen({ onExitGame, activeCardSkinId, activeTableSkinId }: Props) {
    const defaultSkin = STORE_ITEMS.find(s => s.id === 'k1');
    const [gs, setGs] = useState<GameState | null>(null);
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [turnTimer, setTurnTimer] = useState(7);
    const tableSkin = STORE_ITEMS.find(s => s.id === activeTableSkinId) || STORE_ITEMS.find(s => s.id === 't5')!;
    const isImageTable = tableSkin.image?.endsWith('.png');
    const myCardSkin = STORE_ITEMS.find(s => s.id === activeCardSkinId) || defaultSkin;

    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [validCapture, setValidCapture] = useState<CaptureOption | null>(null);
    const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
    const [countdown, setCountdown] = useState<number>(0);
    const [previewMove, setPreviewMove] = useState<PendingMove | null>(null);

    const isHost = useMemo(() => room?.adminId === auth.currentUser?.uid, [room?.adminId, auth.currentUser?.uid]);
    const isProcessingMove = useRef(false);
    const isScoringInProgress = useRef(false);
    const roomIdRef = useRef<string | null>(null);

    // Handle exit with voluntary exit marking
    const handleExit = async () => {
        if (room && auth.currentUser?.uid) {
            try {
                await markVoluntaryExit(room.id, auth.currentUser.uid);
            } catch (error) {
                console.error('Error marking voluntary exit:', error);
            }
        }
        onExitGame();
    };

    // Force re-render when admin changes
    useEffect(() => {
        // This empty dependency array with isHost will trigger re-render
        // when room.adminId changes because isHost will be recalculated
    }, [room?.adminId, isHost]);

    // Update room ID ref when room changes
    useEffect(() => {
        if (room) {
            roomIdRef.current = room.id;
        }
    }, [room]);

    // Handle immediate bot replacement on exit
    useEffect(() => {
        return () => {
            // When component unmounts (player exits), replace with bot immediately
            if (roomIdRef.current && auth.currentUser) {
                console.log('🤖 Replacing player with bot on exit');
                replacePlayerWithBot(roomIdRef.current, auth.currentUser.uid);
            }
        };
    }, []); // Empty dependency array - only run on unmount

    // Force loadingRoom to false after 5 seconds
    useEffect(() => {
        const loadingTimeout = setTimeout(() => {
            console.warn("Force loadingRoom to false after 5 seconds");
            setLoadingRoom(false);
        }, 5000);

        return () => clearTimeout(loadingTimeout);
    }, []);

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
                        handleExit();
                    }
                });
            } catch (err) {
                console.error('❌ Failed to join room:', err);
                handleExit();
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
                const nextGs = applyMove(curGs, curGs.currentPlayer, card, capture, room?.id);

                // Set different deadlines based on player type
                const currentPlayerObj = nextGs.players[nextGs.currentPlayer];
                const deadline = currentPlayerObj?.isHuman ? 15000 : 1000; // 15s for human, 1s for bot
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
                        <button className="gtb-btn exit-btn" onClick={handleExit}>خروج</button>
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
        <div className="game-root"
            style={{
                backgroundImage: isImageTable ? `url(${tableSkin!.image})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: isImageTable ? 'transparent' : 'var(--sand)'
            }}
            onClick={() => {
                setSelectedCard(null);
                setValidCapture(null);
                setHighlightIds(new Set());
            }}>
            <AnimatePresence>
                {gs.flashMessage && (
                    <motion.div
                        className={`flash-msg ${gs.flashMessage.includes('بصرة') ? 'basra-flash' : ''}`}
                        initial={{ scale: 0, y: 50, opacity: 0 }}
                        animate={{
                            scale: gs.flashMessage.includes('بصرة') ? [1, 1.4, 1.1] : 1,
                            y: 0,
                            opacity: 1
                        }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 15
                        }}
                    >
                        {gs.flashMessage.includes('بصرة') && (
                            <motion.div
                                className="basra-glow"
                                animate={{ opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                        {gs.flashMessage}
                    </motion.div>
                )}
            </AnimatePresence>

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
                    <motion.div
                        className={`turn-ind ${isActuallyMyTurn ? 'my-turn' : ''}`}
                        animate={{
                            scale: isActuallyMyTurn ? [1, 1.1, 1] : [1, 1, 1],
                            boxShadow: isActuallyMyTurn ? '0 0 20px rgba(76, 175, 80, 0.6)' : '0 0 10px rgba(0, 0, 0, 0.3)'
                        }}
                        transition={{
                            duration: 2,
                            repeat: isActuallyMyTurn ? Infinity : 0,
                            ease: "easeInOut"
                        }}
                    >
                        {previewMove ? `● يلعب: ${gs.players[previewMove.playerIndex]?.name || '...'}` :
                            (isActuallyMyTurn ? `● دورك (${turnTimer}ث)` : `● ${gs.players[gs.currentPlayer]?.name || '...'} (${turnTimer}ث)`)}
                    </motion.div>
                </div>
            </header>

            <main className="game-table-area">
                <Opponent player={turnsSafe((myIndex + 2) % 4)} pos="top" active={gs.currentPlayer === (myIndex + 2) % 4} timer={turnTimer} />
                <Opponent player={turnsSafe((myIndex + 1) % 4)} pos="left" active={gs.currentPlayer === (myIndex + 1) % 4} timer={turnTimer} />
                <Opponent player={turnsSafe((myIndex + 3) % 4)} pos="right" active={gs.currentPlayer === (myIndex + 3) % 4} timer={turnTimer} />

                <div className={isImageTable ? "sadu-table-image-layout" : "sadu-border"} style={{
                    background: !isImageTable && tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[1]} 0%, ${tableSkin.colors[0]} 100%)` : 'transparent',
                    margin: 'auto',
                    marginTop: '10%',
                    position: 'relative',
                    border: isImageTable ? 'none' : undefined,
                    boxShadow: isImageTable ? 'none' : undefined
                }}>
                    {!isImageTable && <div className="sadu-stripe-h" />}
                    <div className="sadu-body">
                        {!isImageTable && <div className="sadu-stripe-v" />}
                        <div className={isImageTable ? "felt-center-image" : "felt-center"} style={{
                            background: !isImageTable && tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[0]} 0%, ${tableSkin.colors[1]} 100%)` : 'transparent',
                            width: '100%',
                            position: 'relative',
                            minHeight: isImageTable ? '300px' : '280px',
                            overflow: 'hidden'
                        }}>
                            {gs.tableCards.length === 0 && !previewMove && (
                                <span className="empty-hint" style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}>الأرض فارغة</span>
                            )}
                            <AnimatePresence>
                                {gs.tableCards.map((c, i) => {
                                    const pos = getTableCardPosition(c.id, i);
                                    // If it's a new card (not in initial 4), it comes from THE PREVIOUS player
                                    // because the turn has already incremented in the state
                                    const isInitialDeal = i < 4 && gs.deck.length >= 40;
                                    const actualActorIdx = (gs.currentPlayer - 1 + 4) % 4;
                                    const playerPos = getPlayerPositionStyles(actualActorIdx, myIndex);

                                    return (
                                        <motion.div
                                            key={`${gs.roundNumber}-${c.id}`}
                                            initial={isInitialDeal ? {
                                                scale: 0.2,
                                                opacity: 0,
                                                left: '85%',
                                                top: '85%',
                                                rotate: 0
                                            } : {
                                                scale: 0.5,
                                                opacity: 0,
                                                left: playerPos.left,
                                                top: playerPos.top,
                                                rotate: 0
                                            }}
                                            animate={{
                                                scale: 1,
                                                opacity: 1,
                                                left: `${pos.left}%`,
                                                top: `${pos.top}%`,
                                                rotate: pos.rotation
                                            }}
                                            exit={{
                                                scale: 0.2,
                                                opacity: 0,
                                                x: actualActorIdx === (myIndex + 2) % 4 ? '0%' : // top
                                                    actualActorIdx === (myIndex + 1) % 4 ? '-400%' : // left
                                                        actualActorIdx === (myIndex + 3) % 4 ? '400%' : // right
                                                            '0%', // bottom (default)
                                                y: actualActorIdx === (myIndex + 2) % 4 ? '-400%' : // top
                                                    actualActorIdx === myIndex ? '400%' : // bottom
                                                        '0%',
                                                transition: { duration: 0.5, ease: "circIn" }
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 150,
                                                damping: 20,
                                                delay: isInitialDeal ? i * 0.15 : 0 // No delay for player throws
                                            }}
                                            style={{
                                                position: 'absolute',
                                                zIndex: i,
                                                transform: 'translate(-50%, -50%)',
                                                filter: 'drop-shadow(0 6px 15px rgba(0,0,0,0.3))'
                                            }}
                                        >
                                            <CardComp card={c} hl={highlightIds.has(c.id)} size="table" />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                        {!isImageTable && <div className="sadu-stripe-v" />}
                    </div>
                    {!isImageTable && <div className="sadu-stripe-h" />}
                </div>
                {previewMove && gs.players[previewMove.playerIndex] && (
                    <motion.div
                        className="preview-layer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{
                                scale: 0.3,
                                rotate: -15,
                                ...getPlayerPositionStyles(previewMove.playerIndex, myIndex)
                            }}
                            animate={{ scale: 1, rotate: 0, x: '-50%', y: '-50%', left: '50%', top: '50%' }}
                            transition={{
                                type: "spring",
                                stiffness: 350,
                                damping: 18,
                            }}
                            style={{ position: 'absolute' }}
                        >
                            <CardComp
                                card={previewMove.card}
                                size="large"
                                hl={true}
                                cardSkin={STORE_ITEMS.find(s => s.id === gs.players[previewMove.playerIndex].activeSkinId)}
                                style={{
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 60px rgba(212, 160, 23, 0.3)',
                                }}
                            />
                        </motion.div>
                        <motion.div
                            className="player-indicator-tag"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                        >
                            {gs.players[previewMove.playerIndex].name}
                        </motion.div>
                    </motion.div>
                )}
                <AnimatePresence>
                    <motion.div
                        className="deck-info"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                        {gs.deck.length > 0 && (
                            <CardComp
                                card={{ id: 'deck', suit: 'spades', value: 0 }}
                                style={{ isBack: true, transform: 'scale(0.8)' }}
                                cardSkin={myCardSkin}
                                size="small"
                            />
                        )}
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                            {gs.deck.length}
                        </motion.span>
                    </motion.div>
                </AnimatePresence>
            </main>

            <div className="player-hand-area">
                <div className="my-avatar-container">
                    <Opponent
                        player={{ ...human, name: auth.currentUser?.displayName || 'أنا' }}
                        pos="bottom-me"
                        active={gs.currentPlayer === myIndex}
                        timer={turnTimer}
                    />
                </div>
                <div className="hand-label">{human.basraPoints > 0 && <span>⭐ بصرة: {human.basraPoints}</span>}</div>
                <div className="hand-cards">
                    {human.hand.map((c: any, i: number) => {
                        const rot = (i - (human.hand.length - 1) / 2) * 8;
                        const isSel = selectedCard?.id === c.id;
                        return (
                            <motion.div
                                key={`${gs.roundNumber}-${c.id}`}
                                initial={{
                                    scale: 0.3,
                                    opacity: 0,
                                    y: -300, // Come from table area
                                    x: 200,   // Offset to make it look like it's from the deck
                                    rotate: 0
                                }}
                                animate={{
                                    scale: isSel ? 1.05 : 1, // Slightly less scale jump too
                                    opacity: 1,
                                    y: isSel ? -50 : 0, // Reduced from -150 to -50
                                    x: 0,
                                    rotate: rot
                                }}
                                whileHover={{ scale: 1.05 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 25,
                                    delay: i * 0.1 + 0.5 // Start after table cards
                                }}
                                style={{
                                    zIndex: isSel ? 50 : i,
                                    opacity: previewMove ? 0.5 : 1,
                                    display: 'inline-block'
                                }}
                            >
                                <CardComp
                                    card={c}
                                    size="large"
                                    onClick={(e: any) => handleSelect(e, c)}
                                    hl={isSel}
                                    cardSkin={myCardSkin}
                                    style={{
                                        transform: `rotate(${rot}deg)`,
                                        pointerEvents: 'auto'
                                    }}
                                />
                            </motion.div>
                        );
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
            className={`playing-card ${size === 'large' ? 'card-lg' : ''} ${size === 'table' ? 'card-table' : ''} ${hl ? 'card-hl' : ''} ${onClick ? 'card-btn' : ''}`}
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

function Opponent({ player, pos, active, timer }: any) {
    const skin = STORE_ITEMS.find(s => s.id === player.activeSkinId);

    // SVG Circle logic
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const maxTime = player.isHuman ? 15 : 3; // Match the logic in performMoveLocal
    const progress = active ? (timer / maxTime) : 0;
    const dashOffset = circumference - (progress * circumference);
    const isLow = active && timer <= 5 && player.isHuman;

    return (
        <div className={`player-slot ps-${pos} ${active ? 'ps-active' : ''}`}>
            <div className="ps-avatar">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.name}`} alt="" />
                <AnimatePresence>
                    {active && (
                        <motion.div
                            className="ps-ring-container"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                        >
                            <svg className="ps-timer-svg" viewBox="0 0 50 50">
                                <circle
                                    className="ps-timer-bg"
                                    cx="25" cy="25" r={radius}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="3"
                                />
                                <motion.circle
                                    className={`ps-timer-circle ${isLow ? 'timer-low' : ''}`}
                                    cx="25" cy="25" r={radius}
                                    strokeDasharray={circumference}
                                    initial={{ strokeDashoffset: circumference }}
                                    animate={{ strokeDashoffset: dashOffset }}
                                    transition={{ duration: 1, ease: "linear" }}
                                    stroke="var(--gold)"
                                    strokeWidth="3"
                                    fill="none"
                                />
                            </svg>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="ps-name">{player.name}{player.basraPoints > 0 && <span className="ps-pts">{player.basraPoints}⭐</span>}</div>
            {pos !== 'bottom-me' && (
                <div className="ps-cards">
                    {Array.from({ length: player.hand.length }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ scale: 0.3, opacity: 0, x: 100, y: 100 }}
                            animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                            transition={{
                                delay: (i * 0.1) + 0.2,
                                type: "spring",
                                stiffness: 200
                            }}
                            style={{ marginLeft: i > 0 ? '-45px' : '0', display: 'inline-block' }}
                        >
                            <CardComp
                                card={{ id: `back-${i}`, suit: 'spades', value: 0 }}
                                style={{ isBack: true }}
                                cardSkin={skin}
                                size="small"
                            />
                        </motion.div>
                    ))}
                </div>
            )}
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
