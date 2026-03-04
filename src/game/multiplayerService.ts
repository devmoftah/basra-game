import { db, auth, rtdb } from '../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    limit,
    runTransaction
} from 'firebase/firestore';
import { ref, onDisconnect as rtdbOnDisconnect, remove } from 'firebase/database';
import { GameRoom } from './basraTypes';
import { createInitialState, dealNewRound } from './basraEngine';

// ── Persistence helpers for room joining ──────────────────────────────
interface JoinHistory {
    [roomId: string]: {
        count: number;
        lastUpdate: number;
    }
}

const JOIN_LIMIT = 2;

function getJoinHistory(): JoinHistory {
    try {
        const history = localStorage.getItem('basra_join_history');
        return history ? JSON.parse(history) : {};
    } catch {
        return {};
    }
}

function saveJoinHistory(history: JoinHistory) {
    try {
        localStorage.setItem('basra_join_history', JSON.stringify(history));
    } catch (e) {
        console.warn("localStorage failed", e);
    }
}

function getRoomJoinCount(roomId: string): number {
    const history = getJoinHistory();
    return history[roomId]?.count || 0;
}

function incrementRoomJoinCount(roomId: string) {
    const history = getJoinHistory();
    const current = history[roomId] || { count: 0, lastUpdate: Date.now() };

    history[roomId] = {
        count: current.count + 1,
        lastUpdate: Date.now()
    };

    // Cleanup: remove entries older than 24 hours or keep only last 20 recent
    const now = Date.now();
    const filteredHistory: JoinHistory = {};
    const roomIds = Object.keys(history);

    const sortedRoomIds = roomIds
        .sort((a, b) => history[b].lastUpdate - history[a].lastUpdate)
        .slice(0, 20);

    for (const rid of sortedRoomIds) {
        if (now - history[rid].lastUpdate < 24 * 60 * 60 * 1000) {
            filteredHistory[rid] = history[rid];
        }
    }
    saveJoinHistory(filteredHistory);
}

export async function findOrCreateRoom(userName: string, skinId: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const roomsRef = collection(db, 'rooms');

    // 1. First, try to find an existing room
    const q = query(
        roomsRef,
        where('status', '==', 'waiting'),
        limit(10) // Grab several candidates to allow skipping
    );
    const querySnapshot = await getDocs(q);

    let targetRoomRef: any = null;

    if (!querySnapshot.empty) {
        // Priority 1: Check if player is already in one of these rooms (rejoining active session)
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data() as GameRoom;
            if (data.playerUids.includes(user.uid)) {
                targetRoomRef = docSnap.ref;
                break;
            }
        }

        // Priority 2: Find first room that hasn't reached the join limit (frustration escape)
        if (!targetRoomRef) {
            for (const docSnap of querySnapshot.docs) {
                if (getRoomJoinCount(docSnap.id) < JOIN_LIMIT) {
                    targetRoomRef = docSnap.ref;
                    break;
                }
            }
        }
    }

    if (!targetRoomRef) {
        // No room found or all rooms were blacklisted, create a new one
        return await createRoom(user.uid, userName, skinId);
    }

    // 2. Use a transaction to safely join
    try {
        const result = await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(targetRoomRef);
            if (!roomSnap.exists()) return { retry: true };

            const roomData = roomSnap.data() as GameRoom;

            // Already in this room?
            if (roomData.playerUids.includes(user.uid)) {
                // Check if player is in their correct seat
                const existingPlayerIndex = roomData.players.findIndex(p => p.uid === user.uid);
                if (existingPlayerIndex !== -1) {
                    return { roomId: roomSnap.id };
                }
            }

            // Room full in the meantime?
            if (roomData.playerCount >= 4 || roomData.status !== 'waiting') {
                return { retry: true };
            }

            // Find first available seat (empty or bot)
            let nextSeat = -1;
            for (let i = 0; i < 4; i++) {
                const player = roomData.players[i];
                if (!player.uid || player.uid.startsWith('bot-')) {
                    nextSeat = i;
                    break;
                }
            }

            if (nextSeat === -1) {
                return { retry: true }; // No available seats
            }

            const newPlayers = [...roomData.players];

            // Replace bot with human
            newPlayers[nextSeat] = {
                ...newPlayers[nextSeat],
                uid: user.uid,
                name: userName,
                isHuman: true,
                activeSkinId: skinId
            };

            const updatedPlayerUids = [...roomData.playerUids, user.uid];

            transaction.update(targetRoomRef, {
                players: newPlayers,
                playerCount: updatedPlayerUids.length,
                playerUids: updatedPlayerUids,
                'gameState.players': newPlayers
            });

            return { roomId: roomSnap.id };
        });

        if (result.retry) {
            // Room became full or invalid, try once more (will likely create new)
            return findOrCreateRoom(userName, skinId);
        }

        if (result.roomId) {
            setupPlayerDisconnectHandler(result.roomId, user.uid);
            incrementRoomJoinCount(result.roomId); // Track that we successfully joined
            return result.roomId;
        }
        throw new Error("Failed to join room");
    } catch (e) {
        console.error("Transaction failed, creating new room:", e);
        return await createRoom(user.uid, userName, skinId);
    }
}

async function createRoom(uid: string, userName: string, skinId: string): Promise<string> {
    const roomsRef = collection(db, 'rooms');
    const initialState = createInitialState(skinId);

    // Setup initial players (1 human host + 3 bots)
    const players = [...initialState.players];
    players[0] = {
        ...players[0],
        uid: uid,
        name: userName,
        activeSkinId: skinId,
        isHuman: true
    };
    initialState.players = players;

    const newRoomData: any = {
        status: 'waiting',
        adminId: uid,
        playerCount: 1,
        playerUids: [uid],
        players: players,
        gameState: initialState,
        createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(roomsRef, newRoomData);
    setupPlayerDisconnectHandler(docRef.id, uid);
    incrementRoomJoinCount(docRef.id); // Also track creating a room
    return docRef.id;
}

export async function startGameInRoom(roomId: string) {
    const roomRef = doc(db, 'rooms', roomId);
    // Use transaction or simple update if we assume host is the only one starting
    const roomSnap = await getDocs(query(collection(db, 'rooms'), where('__name__', '==', roomId)));
    if (roomSnap.empty) return;
    const roomData = roomSnap.docs[0].data() as GameRoom;

    // Deal cards using the engine
    let nextGs = dealNewRound(roomData.gameState);

    // Set initial deadline
    const firstPlayer = nextGs.players[nextGs.currentPlayer];
    const initialDeadline = firstPlayer?.isHuman ? 15000 : 3000;
    nextGs.turnDeadline = Date.now() + initialDeadline;

    await updateDoc(roomRef, {
        status: 'playing',
        players: nextGs.players,
        gameState: nextGs
    });
}

// ── Player Disconnect Handling ───────────────────────────────────────
export async function setupPlayerDisconnectHandler(roomId: string, playerUid: string) {
    try {
        const disconnectRef = ref(rtdb, `disconnects/${roomId}/${playerUid}`);

        // Set up onDisconnect with voluntary exit flag
        const disconnectHandler = rtdbOnDisconnect(disconnectRef);
        await disconnectHandler.set({
            timestamp: Date.now(),
            playerUid: playerUid,
            roomId: roomId,
            isVoluntaryExit: false // Default to false, will be set to true on manual exit
        });
        console.log('📡 Disconnect handler setup successfully');
    } catch (error) {
        console.warn('⚠️ Realtime Database not configured or failed to setup disconnect handler:', error);
        // We don't throw here to avoid blocking the game joining process
    }
}

export async function markVoluntaryExit(roomId: string, playerUid: string) {
    try {
        // Handle the disconnect immediately
        await handlePlayerDisconnect(roomId, playerUid);
    } catch (error) {
        console.warn('⚠️ Failed to handle voluntary exit:', error);
    }
}

// Manual room cleanup as backup
export async function manualRoomCleanup(roomId: string) {
    try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            console.log(`🗑️ Room ${roomId} already deleted`);
            return;
        }

        const roomData = roomSnap.data() as GameRoom;
        const humanPlayers = roomData.players.filter(p => p.isHuman);

        console.log(`🔍 Room ${roomId} has ${humanPlayers.length} human players`);

        if (humanPlayers.length === 0) {
            console.log(`🗑️ Manually deleting room ${roomId} - no human players`);
            await deleteDoc(roomRef);

            // Also delete from RTDB
            try {
                const rtdbRef = ref(rtdb, `disconnects/${roomId}`);
                await remove(rtdbRef);
                console.log(`🗑️ RTDB data for room ${roomId} also deleted`);
            } catch (rtdbError) {
                console.warn('RTDB deletion failed:', rtdbError);
            }
        }
    } catch (error) {
        console.error('Error in manual room cleanup:', error);
    }
}

export async function replacePlayerWithBot(roomId: string, playerUid: string) {
    const roomRef = doc(db, 'rooms', roomId);

    try {
        await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as GameRoom;
            const playerIndex = roomData.players.findIndex(p => p.uid === playerUid);

            if (playerIndex === -1) return; // Player not found

            // Replace player with bot immediately
            const updatedPlayers = [...roomData.players];
            updatedPlayers[playerIndex] = {
                ...updatedPlayers[playerIndex],
                isHuman: false,
                uid: `bot-${playerIndex}`,
                name: `بوت ${playerIndex + 1}`
            };

            // Update playerUids to remove exited player
            const updatedPlayerUids = roomData.playerUids.filter(uid => uid !== playerUid);

            // Keep the same status based on game phase
            const gamePhase = roomData.gameState.phase;

            // Only keep 'playing' status if game is actually playing
            const newStatus = (gamePhase === 'playing') ? 'playing' : 'waiting';

            transaction.update(roomRef, {
                status: newStatus,
                players: updatedPlayers,
                playerCount: updatedPlayerUids.length,
                playerUids: updatedPlayerUids,
                'gameState.players': updatedPlayers,
                'gameState.flashMessage': `تم استبدال اللاعب الذي خرج ببوت`
            });
        });
    } catch (error) {
        console.error('Error replacing player with bot:', error);
    }
}

export async function handlePlayerDisconnect(roomId: string, playerUid: string) {
    const roomRef = doc(db, 'rooms', roomId);

    try {
        const shouldDeleteRoom = await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) return false;

            const roomData = roomSnap.data() as GameRoom;
            const playerIndex = roomData.players.findIndex(p => p.uid === playerUid);

            if (playerIndex === -1) return false; // Player not found

            // For now, we'll implement a simple check:
            // If player is still connected to auth, assume it's a voluntary exit
            // If player is not connected, assume it's a real disconnect
            const isVoluntaryExit = auth.currentUser?.uid === playerUid;

            // Count human players remaining
            const humanPlayers = roomData.players.filter(p => p.isHuman && p.uid !== playerUid);
            const isExitingAdmin = roomData.adminId === playerUid;

            if (humanPlayers.length === 0) {
                // Close the room if no human players left
                transaction.update(roomRef, {
                    status: 'finished',
                    playerCount: 0,
                    playerUids: [],
                    'gameState.phase': 'gameEnd',
                    'gameState.winner': null,
                    'gameState.flashMessage': 'تم إغلاق الطاولة - لم يتبق لاعبون بشريون'
                });

                return true; // Signal that room should be deleted
            } else {
                let updatedPlayers = [...roomData.players];
                let updatedPlayerUids = roomData.playerUids.filter(uid => uid !== playerUid);
                let newAdminId = roomData.adminId;
                let flashMessage = '';

                if (isExitingAdmin && humanPlayers.length > 0) {
                    // Transfer admin to the next human player
                    const newAdmin = humanPlayers[0];
                    if (newAdmin.uid) {
                        newAdminId = newAdmin.uid;
                        flashMessage = `تم نقل الأدمنية إلى ${newAdmin.name}`;
                    }
                }

                if (!isVoluntaryExit) {
                    // Replace with bot if it's not a voluntary exit
                    updatedPlayers[playerIndex] = {
                        ...updatedPlayers[playerIndex],
                        isHuman: false,
                        uid: undefined,
                        name: `بوت ${playerIndex + 1}`
                    };
                    flashMessage = flashMessage || `تم استبدال اللاعب الذي خرج ببوت`;
                } else {
                    // For voluntary exit, just remove the player from arrays
                    updatedPlayerUids = roomData.playerUids.filter(uid => uid !== playerUid);
                    flashMessage = flashMessage || `غادر اللاعب`;
                }

                transaction.update(roomRef, {
                    adminId: newAdminId,
                    players: updatedPlayers,
                    playerCount: updatedPlayerUids.length,
                    playerUids: updatedPlayerUids,
                    'gameState.players': updatedPlayers,
                    'gameState.flashMessage': flashMessage
                });

                return false; // Don't delete room
            }
        });

        // If we closed the room, delete it immediately
        if (shouldDeleteRoom) {
            setTimeout(async () => {
                try {
                    await deleteDoc(roomRef);
                    console.log(`🗑️ Room ${roomId} deleted immediately - no human players left`);

                    // Also try to delete from RTDB if it exists
                    try {
                        const rtdbRef = ref(rtdb, `disconnects/${roomId}`);
                        await remove(rtdbRef);
                        console.log(`🗑️ RTDB data for room ${roomId} also deleted`);
                    } catch (rtdbError) {
                        console.warn('RTDB deletion failed (this is ok):', rtdbError);
                    }
                } catch (error) {
                    console.error('Error deleting room:', error);
                    // Try one more time after 2 seconds
                    setTimeout(async () => {
                        try {
                            await deleteDoc(roomRef);
                            console.log(`🗑️ Room ${roomId} deleted on retry`);
                        } catch (retryError) {
                            console.error('Room deletion failed on retry:', retryError);
                        }
                    }, 2000);
                }
            }, 500);
        }
    } catch (error) {
        console.error('Error handling player disconnect:', error);
    }
}
