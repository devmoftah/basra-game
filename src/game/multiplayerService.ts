import { db, auth } from '../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    limit
} from 'firebase/firestore';
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

        if (roomData.playerUids.includes(user.uid)) return roomDoc.id;

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
    nextGs.turnDeadline = Date.now() + 8000;

    await updateDoc(roomRef, {
        status: 'playing',
        players: nextGs.players,
        gameState: nextGs
    });
}
