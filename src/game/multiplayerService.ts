import { db, auth } from '../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    limit,
    runTransaction
} from 'firebase/firestore';
import { getDatabase, ref, onDisconnect as rtdbOnDisconnect } from 'firebase/database';
import { GameRoom, PlayerState } from './basraTypes';
import { createInitialState, dealNewRound } from './basraEngine';

export async function findOrCreateRoom(userName: string, skinId: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const roomsRef = collection(db, 'rooms');
    const q = query(
        roomsRef,
        where('status', '==', 'waiting'),
        limit(10)
    );
    const querySnapshot = await getDocs(q);

    let roomDoc = null;
    if (!querySnapshot.empty) {
        // Find a room that isn't full
        roomDoc = querySnapshot.docs.find(d => {
            const data = d.data() as GameRoom;
            return data.playerCount < 4;
        });
    }

    if (roomDoc) {
        // Join existing room
        const roomData = roomDoc.data() as GameRoom;

        // Allow returning to same room if it's still waiting
        if (roomData.playerUids.includes(user.uid)) {
            if (roomData.status === 'waiting') {
                // Find the player's existing seat and return the room
                const existingPlayer = roomData.players.find(p => p.uid === user.uid);
                if (existingPlayer) {
                    return roomDoc.id; // Return to waiting room with existing seat
                }
            } else {
                return roomDoc.id; // Already in this room (playing)
            }
        }

        const newPlayers = [...roomData.players];
        const nextSeat = roomData.playerCount;

        const newPlayer: PlayerState = {
            id: nextSeat,
            uid: user.uid,
            name: userName,
            hand: [],
            captured: [],
            basraPoints: 0,
            isHuman: true,
            team: (nextSeat === 0 || nextSeat === 2) ? 0 : 1,
            activeSkinId: skinId
        };

        newPlayers[nextSeat] = newPlayer;

        await updateDoc(roomDoc.ref, {
            players: newPlayers,
            playerCount: nextSeat + 1,
            playerUids: [...roomData.playerUids, user.uid],
            'gameState.players': newPlayers
        });

        // Set up disconnect handler for the new player
        await setupPlayerDisconnectHandler(roomDoc.id, user.uid);

        return roomDoc.id;
    } else {
        // Create new room
        const initialState = createInitialState(skinId);
        const hostPlayer: PlayerState = {
            id: 0,
            uid: user.uid,
            name: userName,
            hand: [],
            captured: [],
            basraPoints: 0,
            isHuman: true,
            team: 0,
            activeSkinId: skinId
        };

        const players = [hostPlayer, ...initialState.players.slice(1).map(p => ({ ...p, isHuman: false }))];

        const newRoom: Partial<GameRoom> = {
            status: 'waiting',
            adminId: user.uid,
            playerCount: 1,
            playerUids: [user.uid],
            players: players,
            gameState: { ...initialState, players },
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(roomsRef, newRoom);
        
        // Set up disconnect handler for the host
        await setupPlayerDisconnectHandler(docRef.id, user.uid);
        
        return docRef.id;
    }
}

export async function startGameInRoom(roomId: string) {
    const roomRef = doc(db, 'rooms', roomId);
    const s = await getDocs(query(collection(db, 'rooms'), where('__name__', '==', roomId)));
    if (s.empty) return;
    const roomSnap = s.docs[0];
    const roomData = roomSnap.data() as GameRoom;

    // Deal cards using the engine
    let nextGs = dealNewRound(roomData.gameState);
    
    // Set initial deadline based on first player type
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
    const rtdb = getDatabase();
    const disconnectRef = ref(rtdb, `disconnects/${roomId}/${playerUid}`);
    
    // Set up onDisconnect with voluntary exit flag
    const disconnectHandler = rtdbOnDisconnect(disconnectRef);
    await disconnectHandler.set({
        timestamp: Date.now(),
        playerUid: playerUid,
        roomId: roomId,
        isVoluntaryExit: false // Default to false, will be set to true on manual exit
    });
}

export async function markVoluntaryExit(roomId: string, playerUid: string) {
    const rtdb = getDatabase();
    const disconnectRef = ref(rtdb, `disconnects/${roomId}/${playerUid}`);
    const disconnect = rtdbOnDisconnect(disconnectRef);
    await disconnect.set({
        timestamp: Date.now(),
        playerUid: playerUid,
        roomId: roomId,
        isVoluntaryExit: true // Mark as voluntary exit
    });
}

export async function handlePlayerDisconnect(roomId: string, playerUid: string) {
    const roomRef = doc(db, 'rooms', roomId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) return;
            
            const roomData = roomSnap.data() as GameRoom;
            const playerIndex = roomData.players.findIndex(p => p.uid === playerUid);
            
            if (playerIndex === -1) return; // Player not found
            
            // For now, we'll implement a simple check:
            // If player is still connected to auth, assume it's a voluntary exit
            // If player is not connected, assume it's a real disconnect
            const isVoluntaryExit = auth.currentUser?.uid === playerUid;
            
            // Count human players remaining
            const humanPlayers = roomData.players.filter(p => p.isHuman && p.uid !== playerUid);
            
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
            } else if (!isVoluntaryExit) {
                // Only replace with bot if it's not a voluntary exit
                const updatedPlayers = [...roomData.players];
                updatedPlayers[playerIndex] = {
                    ...updatedPlayers[playerIndex],
                    isHuman: false,
                    uid: undefined,
                    name: `بوت ${playerIndex + 1}`
                };
                
                // Update playerUids to remove disconnected player
                const updatedPlayerUids = roomData.playerUids.filter(uid => uid !== playerUid);
                
                transaction.update(roomRef, {
                    players: updatedPlayers,
                    playerCount: updatedPlayerUids.length,
                    playerUids: updatedPlayerUids,
                    'gameState.players': updatedPlayers,
                    'gameState.flashMessage': `تم استبدال اللاعب الذي خرج ببوت`
                });
            }
            // If it's a voluntary exit, don't replace the player - just remove them
        });
    } catch (error) {
        console.error('Error handling player disconnect:', error);
    }
}
