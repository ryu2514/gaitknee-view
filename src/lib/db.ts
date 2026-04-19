import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

export const FREE_MONTHLY_LIMIT = 5;

function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Profile ───

export interface Profile {
    id: string;
    last_name: string | null;
    first_name: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const snap = await getDoc(doc(db, 'profiles', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Profile;
}

export async function upsertProfile(
    userId: string,
    data: { last_name: string; first_name: string }
): Promise<{ error: Error | null }> {
    try {
        const ref = doc(db, 'profiles', userId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            await updateDoc(ref, data);
        } else {
            await setDoc(ref, { ...data, created_at: new Date() });
        }
        return { error: null };
    } catch (err) {
        return { error: err as Error };
    }
}

// ─── Usage / Credits (read-only from client) ───
// usage ドキュメントへの書き込みはサーバー(Cloud Function / Webhook)のみ。
// Firestore ルールで client write を拒否している。

export async function getMonthlyUsage(
    userId: string
): Promise<{ count: number; bonusCredits: number }> {
    const month = getCurrentMonth();
    const docId = `${userId}_${month}`;

    try {
        const snap = await getDoc(doc(db, 'usage', docId));
        if (!snap.exists()) {
            return { count: 0, bonusCredits: 0 };
        }
        const data = snap.data();
        return {
            count: data.count || 0,
            bonusCredits: data.bonus_credits || 0,
        };
    } catch (err) {
        console.error('Error fetching usage:', err);
        return { count: 0, bonusCredits: 0 };
    }
}

export async function canAnalyze(
    userId: string
): Promise<{
    allowed: boolean;
    remaining: number;
    isPremium: boolean;
    bonusCredits: number;
}> {
    try {
        const subSnap = await getDoc(doc(db, 'subscriptions', userId));
        if (subSnap.exists() && subSnap.data().status === 'active') {
            return { allowed: true, remaining: -1, isPremium: true, bonusCredits: 0 };
        }
    } catch {
        // no subscription -> continue
    }

    const usageData = await getMonthlyUsage(userId);
    const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - usageData.count);
    const totalRemaining = freeRemaining + usageData.bonusCredits;

    return {
        allowed: totalRemaining > 0,
        remaining: totalRemaining,
        isPremium: false,
        bonusCredits: usageData.bonusCredits,
    };
}

// サーバー側でアトミックにクレジットを消費する
export async function consumeCredit(): Promise<{
    allowed: boolean;
    remaining: number;
    isPremium: boolean;
    bonusCredits: number;
}> {
    const call = httpsCallable<unknown, {
        allowed: boolean;
        remaining: number;
        isPremium: boolean;
        bonusCredits: number;
    }>(functions, 'consumeCredit');
    const result = await call({});
    return result.data;
}
