import {
    Card, CaptureOption, GameState, PlayerState, Suit,
    isDiamondSeven, isJack,
} from './basraTypes';
import { db, doc, updateDoc, deleteDoc } from '../firebase';

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

function calcPoints(played: Card, table: Card[] = []): number {
    const v = played.value;
    
    // 2, 3, 4 = 0 points
    if ([2, 3, 4].includes(v)) return 0;
    
    // Ace = 25 points (only on Ace)
    if (v === 1) {
        // Check if table has only one Ace
        if (table.length === 1 && table[0].value === 1) {
            return 25;
        }
        return 0; // Ace doesn't capture other cards
    }
    
    // Regular cards (5-10)
    if (v === 5) return 10;
    if (v === 6) return 12;
    if (v === 8) return 16;
    if (v === 9) return 18;
    if (v === 10) return 20;
    
    // Regular 7 = 25 points
    if (v === 7 && played.suit !== 'diamonds') return 25;
    
    // 7♦️ (الكوماندو) - acts as joker with target value
    if (v === 7 && played.suit === 'diamonds') {
        // Points depend on what it's capturing
        // This will be handled in applyMove
        return 0;
    }
    
    // Jack (الولد) = 50 points (only on Jack or 7♦️)
    if (v === 11) {
        // Check if table has only one Jack or one 7♦️
        if (table.length === 1 && 
            (table[0].value === 11 || (table[0].value === 7 && table[0].suit === 'diamonds'))) {
            return 50;
        }
        return 0; // Jack doesn't get points on other cards
    }
    
    return 0;
}

export function calcRoundScores(players: PlayerState[]): [number, number] {
    let s0 = 0, s1 = 0;
    players.forEach(p => {
        if (p.team === 0) s0 += p.basraPoints;
        else s1 += p.basraPoints;
    });
    
    // Card collection bonus - 20 points to team with most cards
    const c0 = players.filter(p => p.team === 0).reduce((s, p) => s + p.captured.length, 0);
    const c1 = players.filter(p => p.team === 1).reduce((s, p) => s + p.captured.length, 0);
    
    if (c0 > c1) {
        s0 += 20;
    } else if (c1 > c0) {
        s1 += 20;
    }
    // If equal, no bonus
    
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
    // First deal: 4 cards to each player, no cards on table
    const players = state.players.map(p => ({
        ...p, hand: deck.splice(0, 4), captured: [], basraPoints: 0,
    }));
    return {
        ...state, deck, tableCards: [], players,
        currentPlayer: 0, phase: 'playing', lastCapturePlayer: null, flashMessage: 'بدأت الجولة الجديدة! 4 كروت لكل لاعب',
    };
}

export function redealIfNeeded(state: GameState): GameState {
    // Check if all players have empty hands
    const allHandsEmpty = state.players.every(p => p.hand.length === 0);
    
    if (!allHandsEmpty || state.deck.length === 0) {
        return state; // No redeal needed
    }
    
    // Determine how many cards to deal based on deck size
    const deckSize = state.deck.length;
    let cardsToDeal: number;
    let message: string;
    
    if (deckSize === 28) {
        // Second deal: 3 cards to each player
        cardsToDeal = 3;
        message = 'تم توزيع 3 كروت جديدة لكل لاعب';
    } else if (deckSize === 16) {
        // Third deal: 4 cards to each player
        cardsToDeal = 4;
        message = 'تم توزيع 4 كروت جديدة لكل لاعب';
    } else {
        return state; // Unexpected deck size
    }
    
    const newDeck = [...state.deck];
    const players = state.players.map(p => ({
        ...p,
        hand: newDeck.splice(0, cardsToDeal),
    }));
    
    return {
        ...state,
        deck: newDeck,
        players,
        flashMessage: message,
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

export function applyMove(state: GameState, playerIndex: number, card: Card, capture: CaptureOption | null, roomId?: string): GameState {
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
        // Special rules for Jack and 7♦️
        if (card.value === 11) {
            // Jack (الولد) - بصرة 50 فقط على ولد أو 7♦️ وحدهم
            if (tableCards.length === 1) {
                const targetCard = tableCards[0];
                // Check if it's a Jack or 7♦️
                if (targetCard.value === 11 || (targetCard.value === 7 && targetCard.suit === 'diamonds')) {
                    // بصرة 50 نقطة
                    player.captured.push(card, ...tableCards);
                    player.basraPoints += 50;
                    flashMessage = `بصرة الولد! +50 نقطة 🎯`;
                    tableCards = [];
                    lastCapturePlayer = playerIndex;
                } else {
                    // يقش الطاولة بدون نقاط
                    player.captured.push(card, ...tableCards);
                    flashMessage = `الولد يقش الطاولة! 🎯`;
                    tableCards = [];
                    lastCapturePlayer = playerIndex;
                }
            } else {
                // يقش الطاولة بدون نقاط
                player.captured.push(card, ...tableCards);
                flashMessage = `الولد يقش الطاولة! 🎯`;
                tableCards = [];
                lastCapturePlayer = playerIndex;
            }
        } else if (card.value === 7 && card.suit === 'diamonds') {
            // 7♦️ (الكوماندو) - جوكر ياخد بنفس قيمة الرقم
            // TODO: Add logic to let player choose which value to use
            // For now, we'll implement basic logic
            if (tableCards.length === 1) {
                // بصرة على ورقة واحدة - ياخد بنفس قيمة الورقة
                const targetCard = tableCards[0];
                const points = calcPoints(targetCard);
                player.captured.push(card, ...tableCards);
                player.basraPoints += points;
                flashMessage = `الكوماندو بصرة! +${points} نقطة 💎`;
                tableCards = [];
                lastCapturePlayer = playerIndex;
            } else {
                // Check if there's a capture possibility (sum to some value)
                const hasCapture = findCaptures(card, tableCards).length > 0;
                if (hasCapture) {
                    // TODO: Let player choose which capture to make
                    // For now, just take first available capture
                    const capture = findCaptures(card, tableCards)[0];
                    player.captured.push(card, ...capture.cards);
                    player.basraPoints += capture.basraPoints || 0;
                    flashMessage = `الكوماندو بصرة! +${capture.basraPoints || 0} نقطة 💎`;
                    tableCards = tableCards.filter(c => !capture.cards.find(x => x.id === c.id));
                    lastCapturePlayer = playerIndex;
                } else {
                    // يقش الطاولة بدون نقاط
                    player.captured.push(card, ...tableCards);
                    flashMessage = `الكوماندو يقش الطاولة! 💎`;
                    tableCards = [];
                    lastCapturePlayer = playerIndex;
                }
            }
        } else {
            tableCards = [...tableCards, card];
        }
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
            // End of round - قش الأرض
            if (lastCapturePlayer !== null && newState.tableCards.length > 0) {
                // الفريق الذي قام بآخر عملية "أكل" يأخذ كل الكروت المتبقية
                const lastPlayer = players[lastCapturePlayer];
                lastPlayer.captured.push(...newState.tableCards);
                flashMessage = `${lastPlayer.name} يقش الأرض! يأخذ ${newState.tableCards.length} كروت 🌍`;
                newState.tableCards = [];
            }
            newState = processScore(newState, roomId);
        }
    }

    // Check for redeal
    newState = redealIfNeeded(newState);

    return newState;
}

export function processScore(state: GameState, roomId?: string): GameState {
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

    const newState = {
        ...state, totalScores, consecutiveZeros: cz, winner,
        phase: winner !== null ? 'gameEnd' : 'roundEndScored',
        roundNumber: state.roundNumber + 1,
        lastRoundScores: [r0, r1],
    } as any;

    // Auto-cleanup: if game ended, clean up the room
    if (winner !== null && roomId) {
        setTimeout(async () => {
            try {
                const roomRef = doc(db, 'rooms', roomId);
                await updateDoc(roomRef, {
                    status: 'finished',
                    'gameState.phase': 'gameEnd',
                    'gameState.winner': winner,
                    'gameState.flashMessage': `انتهت اللعبة! الفريق ${winner === 0 ? 'الأحمر' : 'الأزرق'} فاز! 🏆`
                });
                
                // Delete room after 30 seconds to allow cleanup
                setTimeout(async () => {
                    try {
                        await deleteDoc(roomRef);
                        console.log(`🗑️ Room ${roomId} deleted automatically`);
                    } catch (error) {
                        console.error('Error deleting room:', error);
                    }
                }, 30000);
            } catch (error) {
                console.error('Error updating room:', error);
            }
        }, 2000);
    } else {
        // Start new round after 5 seconds
        setTimeout(() => {
            // This will be handled by the game screen
        }, 5000);
    }

    return newState;
}
