import { Card, GameState, getTeam, isDiamondSeven, isJack, CaptureOption } from './basraTypes';
import { findCaptures } from './basraEngine';

interface ScoredMove {
    card: Card;
    capture: CaptureOption | null;
    score: number;
}

export function aiChooseMove(
    playerIndex: number,
    state: GameState,
): { card: Card; capture: CaptureOption | null } {
    const player = state.players[playerIndex];
    const table = state.tableCards;
    const myTeam = getTeam(playerIndex);

    const moves: ScoredMove[] = [];

    for (const card of player.hand) {
        const captures = findCaptures(card, table);

        if (captures.length > 0) {
            const best = captures.reduce((a, b) =>
                scoreCapture(b) > scoreCapture(a) ? b : a
            );
            moves.push({
                card,
                capture: best,
                score: scoreCapture(best) + 2000,
            });
        } else {
            moves.push({
                card,
                capture: null,
                score: scoreDiscard(card, table, state, myTeam),
            });
        }
    }

    moves.sort((a, b) => b.score - a.score);
    return { card: moves[0].card, capture: moves[0].capture };
}

function scoreCapture(opt: CaptureOption): number {
    let s = 0;
    if (opt.isBasra) s += 800 + opt.basraPoints * 10;
    for (const c of opt.cards) s += cardValue(c);
    s += opt.cards.length * 5;
    return s;
}

function scoreDiscard(
    card: Card,
    table: Card[],
    state: GameState,
    myTeam: 0 | 1,
): number {
    let s = 200;

    // Never put ♦7 alone (opponent J → 50 pts)
    if (isDiamondSeven(card) && table.length === 0) return -9999;

    // Never put J alone (opponent J → 50 pts)
    if (isJack(card) && table.length === 0) return -9999;

    // Avoid setting up easy basra for opponents
    const newTable = [...table, card];
    for (const p of state.players) {
        if (getTeam(p.id) === myTeam) continue;
        for (const oc of p.hand) {
            for (const cap of findCaptures(oc, newTable)) {
                if (cap.isBasra) s -= 200 + cap.basraPoints * 8;
            }
        }
    }

    // Prefer to keep important cards in hand
    s -= cardValue(card) * 3;

    // Prefer discarding low cards
    s += (12 - card.value) * 4;

    return s;
}

function cardValue(card: Card): number {
    if (isDiamondSeven(card)) return 50;
    if (card.value === 1) return 20; // Ace
    return card.value;
}
