import type { FrameData } from '../types/pose';
import type { GaitAnalysisResult } from '../types/gait';

export interface SavedSession {
    id: string;
    timestamp: number;
    name: string;
    notes?: string;
    frames: FrameData[];
    analysis: GaitAnalysisResult;
}

const DB_NAME = 'GaitKneeViewDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Save a session
export async function saveSession(
    frames: FrameData[],
    analysis: GaitAnalysisResult,
    name?: string,
    notes?: string
): Promise<string> {
    const db = await openDB();
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: SavedSession = {
        id,
        timestamp: Date.now(),
        name: name || `セッション ${new Date().toLocaleDateString('ja-JP')}`,
        notes,
        frames,
        analysis
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(session);

        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
    });
}

// Get all sessions
export async function getAllSessions(): Promise<SavedSession[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const sessions = request.result as SavedSession[];
            // Sort by timestamp descending (newest first)
            sessions.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
        request.onerror = () => reject(request.error);
    });
}

// Get a single session by ID
export async function getSession(id: string): Promise<SavedSession | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

// Delete a session
export async function deleteSession(id: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Update session metadata
export async function updateSession(
    id: string,
    updates: { name?: string; notes?: string }
): Promise<void> {
    const db = await openDB();
    const session = await getSession(id);

    if (!session) {
        throw new Error('Session not found');
    }

    const updatedSession = { ...session, ...updates };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(updatedSession);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Clear all sessions
export async function clearAllSessions(): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
