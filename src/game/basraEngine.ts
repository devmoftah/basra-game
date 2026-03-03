import {
    Card, CaptureOption, GameState, PlayerState, Suit,
    isDiamondSeven, isJack,
} from './basraTypes';

// ── Deck (44 cards: A to J only) ──
export function createDeck(): Card[] {
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const deck: Card[] = [];
    let n = 0;
    for (const suit of suits)
        for (const value of values)
            deck.push({ id: `${suit}${value}_${n++}`, suit, value });
    return deck;
}

export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Capture logic ──────────────────────────────────────
export function findCaptures(played: Card, table: Card[]): CaptureOption[] {
    if (table.length === 0) return [];

    // 1. Jack (J) - Always sweeps the whole table
    if (isJack(played)) {
        let basraPoints = 0;
        let isBasra = false;
        let type: CaptureOption['type'] = 'direct';

        if (table.length === 1 && isJack(table[0])) {
            basraPoints = 50; isBasra = true; type = 'j_on_j';
        } else if (table.length === 1 && isDiamondSeven(table[0])) {
            basraPoints = 50; isBasra = true; type = 'j_on_d7';
        }
        return [{ cards: [...table], isBasra, basraPoints, type }];
    }

    // 2. Diamond 7 (Comando) - Special wildcard logic
    if (isDiamondSeven(played)) {
        const totalSum = table.reduce((s, c) => s + c.value, 0);

        // Rule: If total sum is 10 or less, it's a total sweep Basra
        if (totalSum <= 10) {
            return [{ cards: [...table], isBasra: true, basraPoints: 50, type: 'd7_sweep' }];
        }

        // Rule: Diamond 7 can also act as any value (1-10) to clear the table
        // We check if any target value (1-10) can sweep the whole table using combined rules
        for (let v = 1; v <= 10; v++) {
            const captured = getBestCaptureForValue(v, table);
            if (captured.length === table.length) {
                return [{ cards: captured, isBasra: true, basraPoints: 25, type: 'd7_sweep' }];
            }
        }
    }

    // 3. General Logic for 1-10 (including Diamond 7 acting as face value 7)
    const targetValue = played.value;
    const captured = getBestCaptureForValue(targetValue, table);

    if (captured.length > 0) {
        const isBasra = captured.length === table.length;
        let basraPoints = 0;
        if (isBasra) {
            basraPoints = calcPoints(played);
        }
        return [{ cards: captured, isBasra, basraPoints, type: 'direct' }];
    }

    return [];
}

/**
 * Finds the best combination of cards to capture for a given value.
 * This includes all direct matches of the value + all disjoint sets that sum to the value.
 */
function getBestCaptureForValue(target: number, table: Card[]): Card[] {
    // Take all direct matches first
    const directMatches = table.filter(c => c.value === target);
    let remainingTable = table.filter(c => c.value !== target);

    // From remaining, find the maximum number of cards that can be partitioned into sets summing to target
    const sumCaptures = findMaxSumPartition(target, remainingTable);

    return [...directMatches, ...sumCaptures];
}

function findMaxSumPartition(target: number, cards: Card[]): Card[] {
    let bestSet: Card[] = [];

    function solve(index: number, currentAvailable: Card[], currentCaptured: Card[]) {
        if (currentCaptured.length > bestSet.length) {
            bestSet = [...currentCaptured];
        }
        if (index >= currentAvailable.length) return;

        // Try all possible subsets starting from 'index' that sum to 'target'
        const subsets = findAllSubsetsSummarizingTo(target, currentAvailable, index);

        for (const subset of subsets) {
            const remaining = currentAvailable.filter(c => !subset.find(s => s.id === c.id));
            solve(0, remaining, [...currentCaptured, ...subset]);

            // Optimization: if we already cleared everything, stop
            if (bestSet.length === currentAvailable.length + currentCaptured.length) return;
        }
    }

    solve(0, cards, []);
    return bestSet;
}

function findAllSubsetsSummarizingTo(target: number, cards: Card[], startIndex: number): Card[][] {
    const results: Card[][] = [];
    function backtrack(i: number, current: Card[], currentSum: number) {
        if (currentSum === target) {
            results.push([...current]);
            return;
        }
        if (currentSum > target || i >= cards.length) return;

        for (let j = i; j < cards.length; j++) {
            backtrack(j + 1, [...current, cards[j]], currentSum + cards[j].value);
        }
    }
    backtrack(startIndex, [], 0);
    return results;
}

function calcPoints(played: Card): number {
    const v = played.value;
    if ([2, 3, 4].includes(v)) return 0;
    if (v === 1) return 25;
    if (v === 5) return 10;
    if (v === 6) return 12;
    if (v === 7) return 25;
    if (v === 8) return 16;
    if (v === 9) return 18;
    if (v === 10) return 20;
    if (v === 11) return 50;
    return 0;
}

export function calcRoundScores(players: PlayerState[]): [number, number] {
    let s0 = 0, s1 = 0;
    players.forEach(p => {
        if (p.team === 0) s0 += p.basraPoints;
        else s1 += p.basraPoints;
    });
    const c0 = players.filter(p => p.team === 0).reduce((s, p) => s + p.captured.length, 0);
    const c1 = players.filter(p => p.team === 1).reduce((s, p) => s + p.captured.length, 0);
    if (c0 > c1) s0 += 20;
    else if (c1 > c0) s1 += 20;
    return [s0, s1];
}

export function createInitialState(humanSkinId?: string): GameState {
    return {
        deck: [], tableCards: [], players: [
            { id: 0, name: 'أنت', hand: [], captured: [], basraPoints: 0, isHuman: true, team: 0, activeSkinId: humanSkinId || 'k1' },
            { id: 1, name: 'Aaak22', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 1, activeSkinId: 'k4' }, // الاتحاد
            { id: 2, name: 'شريك', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 0, activeSkinId: 'k3' }, // الأهلي طرابلس
            { id: 3, name: 'هلالي', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 1, activeSkinId: 'k6' }, // النصر
        ],
        currentPlayer: 0, totalScores: [0, 0], consecutiveZeros: [0, 0],
        phase: 'idle', lastCapturePlayer: null, winner: null,
        flashMessage: null, lastMoveDesc: '', roundNumber: 1,
        activeSkin: {
            cardBack: '/assets/skins/cards/card_back_darnes.png'
        }
    };
}

export function dealNewRound(state: GameState): GameState {
    const deck = shuffle(createDeck());
    // In Basra, the first round of a game puts 4 cards on the table
    const tableCards = deck.splice(0, 4);
    const players = state.players.map(p => ({
        ...p, hand: deck.splice(0, 4), captured: [], basraPoints: 0,
    }));
    return {
        ...state, deck, tableCards, players,
        currentPlayer: 0, phase: 'playing', lastCapturePlayer: null, flashMessage: null,
    };
}

function dealNextBatch(state: GameState): GameState {
    const deck = [...state.deck];
    const perPlayer = deck.length === 28 ? 3 : 4;
    const players = state.players.map(p => ({
        ...p, hand: deck.splice(0, perPlayer),
    }));
    return { ...state, deck, players };
}

export function applyMove(state: GameState, playerIndex: number, card: Card, capture: CaptureOption | null): GameState {
    const players = state.players.map(p => ({ ...p, hand: [...p.hand], captured: [...p.captured] }));
    const player = players[playerIndex];
    let tableCards = [...state.tableCards];
    let lastCapturePlayer = state.lastCapturePlayer;
    let flashMessage: string | null = null;

    player.hand = player.hand.filter(c => c.id !== card.id);

    if (capture) {
        player.captured.push(card, ...capture.cards);
        tableCards = tableCards.filter(c => !capture.cards.find(x => x.id === c.id));
        lastCapturePlayer = playerIndex; // يتم تسجيل آخر لاعب أكل بنجاح
        if (capture.isBasra && capture.basraPoints > 0) {
            player.basraPoints += capture.basraPoints;
            flashMessage = `بصرة! +${capture.basraPoints} 🎉`;
        }
    } else {
        tableCards = [...tableCards, card];
    }

    let newState: GameState = {
        ...state, tableCards, players, currentPlayer: (playerIndex + 1) % 4,
        lastCapturePlayer, flashMessage, phase: 'playing'
    };

    // تحقق مما إذا كانت هذه آخر حركة في الجولة (اليد فارغة والكومة فارغة)
    if (players.every(p => p.hand.length === 0)) {
        if (newState.deck.length > 0) {
            newState = dealNextBatch(newState);
        } else {
            // ─── قاعدة الورق المتبقي ───
            // إذا انتهت الجولة تماماً، الفريق الذي قام بآخر أكلة يأخذ ما تبقى على الأرض
            if (lastCapturePlayer !== null && tableCards.length > 0) {
                newState.players[lastCapturePlayer].captured.push(...tableCards);
                newState.tableCards = [];
                newState.flashMessage = `قش الأرض لـ ${newState.players[lastCapturePlayer].name}! 🧹`;
            }
            newState.phase = 'roundEnd';
        }
    }
    return newState;
}

export function processScore(state: GameState): GameState {
    const [r0, r1] = calcRoundScores(state.players);
    let totalScores: [number, number] = [state.totalScores[0] + r0, state.totalScores[1] + r1];
    let cz: [number, number] = [...state.consecutiveZeros] as [number, number];

    if (r0 === 0) cz[0]++; else cz[0] = 0;
    if (r1 === 0) cz[1]++; else cz[1] = 0;

    if (cz[0] >= 2) { totalScores[0] = 0; cz[0] = 0; }
    if (cz[1] >= 2) { totalScores[1] = 0; cz[1] = 0; }

    let winner: 0 | 1 | null = null;
    if (cz[0] >= 3) winner = 1; else if (cz[1] >= 3) winner = 0;
    else if (totalScores[0] >= 250) winner = 0; else if (totalScores[1] >= 250) winner = 1;

    return {
        ...state, totalScores, consecutiveZeros: cz, winner,
        phase: winner !== null ? 'gameEnd' : 'roundEndScored',
        roundNumber: state.roundNumber + 1,
        lastRoundScores: [r0, r1],
    } as any;
}
