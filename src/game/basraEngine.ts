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

    if (isDiamondSeven(played)) {
        let basraPoints = 0;
        let isBasra = false;
        if (table.length === 1) {
            const v = table[0].value;
            if (v === 1 || (v >= 5 && v <= 11)) {
                basraPoints = calcPoints(table[0]);
                isBasra = true;
            }
        }
        return [{ cards: [...table], isBasra, basraPoints, type: 'd7_sweep' }];
    }

    const options: CaptureOption[] = [];
    const directMatches = table.filter(c => c.value === played.value);
    if (directMatches.length > 0) {
        const isBasra = table.length === directMatches.length;
        const pts = (isBasra && ![2, 3, 4].includes(played.value)) ? calcPoints(played) : 0;
        options.push({ cards: directMatches, isBasra: isBasra && pts > 0, basraPoints: pts, type: 'direct' });
        return options;
    }

    const combos = findSumCombos(played.value, table);
    if (combos.length > 0) {
        combos.sort((a, b) => b.length - a.length);
        const best = combos[0];
        const isBasra = table.length === best.length;
        const pts = (isBasra && ![2, 3, 4].includes(played.value)) ? 14 : 0;
        options.push({ cards: best, isBasra: isBasra && pts > 0, basraPoints: pts, type: 'sum' });
    }

    return options;
}

function findSumCombos(target: number, table: Card[]): Card[][] {
    const results: Card[][] = [];
    function bt(i: number, cur: Card[], sum: number) {
        if (sum === target && cur.length >= 2) { results.push([...cur]); return; }
        if (sum >= target || i >= table.length) return;
        bt(i + 1, [...cur, table[i]], sum + table[i].value);
        bt(i + 1, cur, sum);
    }
    bt(0, [], 0);
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

export function createInitialState(): GameState {
    return {
        deck: [], tableCards: [], players: [
            { id: 0, name: 'أنت', hand: [], captured: [], basraPoints: 0, isHuman: true, team: 0 },
            { id: 1, name: 'Aaak22', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 1 },
            { id: 2, name: 'شريك', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 0 },
            { id: 3, name: 'هلالي', hand: [], captured: [], basraPoints: 0, isHuman: false, team: 1 },
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
    const players = state.players.map(p => ({
        ...p, hand: deck.splice(0, 4), captured: [], basraPoints: 0,
    }));
    return {
        ...state, deck, tableCards: [], players,
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
