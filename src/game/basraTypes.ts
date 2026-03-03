// Types for Basra game
// Deck: A, 2-10, J only (no Q, no K) = 44 cards

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
    id: string;
    suit: Suit;
    value: number; // 1=A, 2-10, 11=J
}

export interface CaptureOption {
    cards: Card[];        // cards taken from table
    isBasra: boolean;     // table cleared completely
    basraPoints: number;  // points for this basra
    type: 'direct' | 'sum' | 'j_on_j' | 'j_on_d7' | 'd7_sweep';
}

export interface PlayerState {
    id: number;
    name: string;
    hand: Card[];
    captured: Card[];
    basraPoints: number;
    isHuman: boolean;
    team: 0 | 1;
    activeSkinId?: string;
}

export type GamePhase = 'idle' | 'playing' | 'aiThinking' | 'roundEnd' | 'roundEndScored' | 'gameEnd';

export interface GameState {
    deck: Card[];
    tableCards: Card[];
    players: PlayerState[];
    currentPlayer: number;
    totalScores: [number, number]; // [team0, team1]
    consecutiveZeros: [number, number];
    phase: GamePhase;
    lastCapturePlayer: number | null;
    winner: 0 | 1 | null;
    flashMessage: string | null;
    lastMoveDesc: string;
    roundNumber: number;
    activeSkin?: {
        cardBack?: string;
        tableBg?: string;
    };
    turnDeadline?: number; // Server timestamp (ms)
}

export interface GameRoom {
    id: string;
    status: 'waiting' | 'playing' | 'finished';
    adminId: string;
    playerCount: number;
    playerUids: string[];
    players: PlayerState[];
    gameState: GameState;
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────
export const SUIT_SYMBOL: Record<Suit, string> = {
    spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
    spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black',
};
export function cardDisplay(v: number) {
    if (v === 1) return 'A';
    if (v === 11) return 'J';
    return String(v);
}
export function isDiamondSeven(c: Card) {
    return c.suit === 'diamonds' && c.value === 7;
}
export function isJack(c: Card) { return c.value === 11; }
export function getTeam(pid: number): 0 | 1 {
    return (pid === 0 || pid === 2) ? 0 : 1;
}
