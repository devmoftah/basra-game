import { useState, useEffect, useRef } from 'react';
import {
    GameState, Card, CaptureOption,
    SUIT_SYMBOL, SUIT_COLOR, cardDisplay, Suit,
} from '../game/basraTypes';
import {
    createInitialState, dealNewRound, applyMove, processScore, findCaptures,
} from '../game/basraEngine';
import { aiChooseMove } from '../game/basraAI';
import { STORE_ITEMS } from '../data/storeItems';
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
    const cardSkin = STORE_ITEMS.find(s => s.id === activeCardSkinId);
    const tableSkin = STORE_ITEMS.find(s => s.id === activeTableSkinId);
    const [gs, setGs] = useState<GameState>(() => createInitialState());
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [validCapture, setValidCapture] = useState<CaptureOption | null>(null);
    const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
    const [countdown, setCountdown] = useState<number>(0);

    // New state to show the card being played before it's processed
    const [previewMove, setPreviewMove] = useState<PendingMove | null>(null);

    const aiTimerRef = useRef<any>(null);
    const isScoringInProgress = useRef(false);
    const isProcessingMove = useRef(false);

    // Initial deal
    useEffect(() => { setGs(prev => dealNewRound(prev)); }, []);

    // Flash message clear
    useEffect(() => {
        if (!gs.flashMessage) return;
        const t = setTimeout(() => setGs(p => ({ ...p, flashMessage: null })), 2300);
        return () => clearTimeout(t);
    }, [gs.flashMessage]);

    // AI Turn Logic with PREVIEW
    useEffect(() => {
        if (gs.phase !== 'playing' || isProcessingMove.current) return;
        const curP = gs.players[gs.currentPlayer];
        if (curP.isHuman) return;

        if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

        aiTimerRef.current = setTimeout(() => {
            const move = aiChooseMove(gs.currentPlayer, gs);

            // 1. Show preview first
            setPreviewMove({
                card: move.card,
                playerIndex: gs.currentPlayer,
                capture: move.capture
            });

            // 2. Wait 0.5s then apply
            setTimeout(() => {
                setGs(prev => applyMove(prev, prev.currentPlayer, move.card, move.capture));
                setPreviewMove(null);
            }, 500);

        }, 1000);

        return () => clearTimeout(aiTimerRef.current);
    }, [gs.currentPlayer, gs.phase]);

    // Round End Handling
    useEffect(() => {
        if (gs.phase === 'roundEnd' && !isScoringInProgress.current) {
            isScoringInProgress.current = true;
            setGs(prev => processScore(prev));
        }
    }, [gs.phase]);

    useEffect(() => {
        if (gs.phase === 'roundEndScored') {
            setCountdown(6);
            const timer = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) {
                        clearInterval(timer);
                        isScoringInProgress.current = false;
                        setGs(prev => dealNewRound(prev));
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [gs.phase === 'roundEndScored']);

    const handleSelect = (e: React.MouseEvent, card: Card) => {
        e.stopPropagation();
        if (gs.phase !== 'playing' || gs.currentPlayer !== 0 || previewMove) return;

        if (selectedCard?.id === card.id) {
            handlePlay();
            return;
        }
        setSelectedCard(card);
        const caps = findCaptures(card, gs.tableCards);
        if (caps.length > 0) {
            setValidCapture(caps[0]);
            setHighlightIds(new Set(caps[0].cards.map(c => c.id)));
        } else {
            setValidCapture(null); setHighlightIds(new Set());
        }
    };

    const handlePlay = () => {
        if (!selectedCard || gs.phase !== 'playing' || previewMove) return;

        const moveCard = selectedCard;
        const moveCap = validCapture;

        // Process human move with a tiny delay to show the card too
        setPreviewMove({ card: moveCard, playerIndex: 0, capture: moveCap });

        setTimeout(() => {
            setGs(prev => applyMove(prev, 0, moveCard, moveCap));
            setPreviewMove(null);
            setSelectedCard(null); setValidCapture(null); setHighlightIds(new Set());
        }, 500);
    };

    const human = gs.players[0];
    const isMyTurn = gs.currentPlayer === 0 && gs.phase === 'playing' && !previewMove;

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
                    <div className={`turn-ind ${isMyTurn ? 'my-turn' : ''}`}>
                        {previewMove ? `● يلعب: ${gs.players[previewMove.playerIndex].name}` :
                            (isMyTurn ? '● دورك' : `● ${gs.players[gs.currentPlayer].name}`)}
                    </div>
                </div>
            </header>

            <main className="game-table-area">
                <Opponent player={gs.players[2]} pos="top" active={gs.currentPlayer === 2} cardSkin={cardSkin} />
                <Opponent player={gs.players[1]} pos="left" active={gs.currentPlayer === 1} cardSkin={cardSkin} />
                <Opponent player={gs.players[3]} pos="right" active={gs.currentPlayer === 3} cardSkin={cardSkin} />

                <div className="sadu-table" style={{
                    background: tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[1]} 0%, ${tableSkin.colors[0]} 100%)` : undefined
                }}>
                    <div className="sadu-border">
                        <div className="felt-center" style={{
                            background: tableSkin?.colors ? `radial-gradient(circle, ${tableSkin.colors[0]} 0%, ${tableSkin.colors[1]} 100%)` : undefined
                        }}>
                            {gs.tableCards.length === 0 && !previewMove && <span className="empty-hint">الأرض فارغة</span>}
                            {gs.tableCards.map((c, i) => (
                                <CardComp key={c.id} card={c} style={{ transform: `rotate(${(i % 4 - 2) * 6}deg)`, marginRight: i > 0 ? '-24px' : '0', zIndex: i }} hl={highlightIds.has(c.id)} cardSkin={cardSkin} />
                            ))}

                            {/* THE PREVIEW CARD: Shown when someone makes a move */}
                            {previewMove && (
                                <div className="preview-layer">
                                    <CardComp
                                        card={previewMove.card}
                                        size="large"
                                        hl={true}
                                        cardSkin={cardSkin}
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
                            style={{ isBack: true, transform: 'scale(0.5)' }}
                            cardSkin={cardSkin}
                        />
                    )}
                    <span>{gs.deck.length}</span>
                </div>
            </main>

            <div className="player-hand-area">
                <div className="hand-label">{human.basraPoints > 0 && <span>⭐ بصرة: {human.basraPoints}</span>}</div>
                <div className="hand-cards">
                    {human.hand.map((c, i) => {
                        const rot = (i - (human.hand.length - 1) / 2) * 7;
                        const isSel = selectedCard?.id === c.id;
                        return <CardComp key={c.id} card={c} size="large" onClick={(e: any) => handleSelect(e, c)} hl={isSel} cardSkin={cardSkin} style={{ transform: `rotate(${rot}deg) translateY(${isSel ? -25 : 0}px)`, zIndex: isSel ? 50 : i, opacity: previewMove ? 0.5 : 1 }} />;
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

    const isImageSkin = cardSkin?.image?.endsWith('.png');

    return (
        <div
            className={`playing-card ${size === 'large' ? 'card-lg' : ''} ${hl ? 'card-hl' : ''} ${onClick ? 'card-btn' : ''}`}
            style={{
                color: SUIT_COLOR[card.suit as Suit],
                ...style,
                backgroundColor: isBack ? (cardSkin?.colors?.[0] || '#222') : '#fff',
                borderColor: isBack ? (cardSkin?.colors?.[1] || '#444') : '#ddd',
                backgroundImage: isBack && isImageSkin ? `url(${cardSkin.image})` : 'none',
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
                <div className="card-back-pattern" style={{ border: `10px solid ${cardSkin?.colors?.[1] || '#444'}`, height: '100%', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card-back-logo" style={{ fontSize: '2rem', opacity: 0.3 }}>{cardSkin?.name?.charAt(0) || 'B'}</div>
                </div>
            )}
        </div>
    );
}

function Opponent({ player, pos, active, cardSkin }: any) {
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
                        cardSkin={cardSkin}
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
