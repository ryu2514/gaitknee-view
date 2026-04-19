import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();

const FREE_MONTHLY_LIMIT = 5;

// priceId -> credits の対応はサーバー側で確定させ、クライアント値は信頼しない
const PRICE_CREDIT_MAP: Record<string, number> = {
    price_1SfNRfFcZOGgYBHRcFIr2QUO: 5,
    price_1SfNSDFcZOGgYBHRKXKA81SG: 10,
    price_1SfNTCFcZOGgYBHRu1p1nFaS: 30,
};

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-02-24.acacia',
    });
}

function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const createCheckoutSession = onCall(
    { region: 'asia-northeast1', invoker: 'public' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'ログインが必要です');
        }

        const uid = request.auth.uid;
        const email = request.auth.token.email ?? undefined;
        const { priceId } = request.data ?? {};

        if (typeof priceId !== 'string' || !(priceId in PRICE_CREDIT_MAP)) {
            throw new HttpsError('invalid-argument', '不明なプランです');
        }
        const credits = PRICE_CREDIT_MAP[priceId];

        try {
            const stripe = getStripe();
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'payment',
                success_url: `${process.env.APP_URL || 'https://gaitknee-view.web.app'}/purchase?success=true`,
                cancel_url: `${process.env.APP_URL || 'https://gaitknee-view.web.app'}/purchase?canceled=true`,
                customer_email: email,
                metadata: {
                    userId: uid,
                    credits: String(credits),
                    priceId,
                },
            });

            return { url: session.url };
        } catch (err) {
            console.error('Stripe session creation error:', err);
            throw new HttpsError('internal', '決済セッションの作成に失敗しました');
        }
    }
);

export const consumeCredit = onCall(
    { region: 'asia-northeast1', invoker: 'public' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'ログインが必要です');
        }
        const uid = request.auth.uid;
        const db = admin.firestore();

        const subSnap = await db.collection('subscriptions').doc(uid).get();
        if (subSnap.exists && subSnap.data()?.status === 'active') {
            return { allowed: true, remaining: -1, isPremium: true, bonusCredits: 0 };
        }

        const month = currentMonth();
        const docId = `${uid}_${month}`;
        const ref = db.collection('usage').doc(docId);

        return db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data()! : { user_id: uid, month, count: 0, bonus_credits: 0 };
            const count: number = data.count || 0;
            const bonus: number = data.bonus_credits || 0;
            const freeRemaining = Math.max(0, FREE_MONTHLY_LIMIT - count);
            const totalRemaining = freeRemaining + bonus;

            if (totalRemaining <= 0) {
                throw new HttpsError('resource-exhausted', '今月の利用回数を使い切りました');
            }

            // 無料枠から先に消費
            if (freeRemaining > 0) {
                if (snap.exists) {
                    tx.update(ref, { count: count + 1 });
                } else {
                    tx.set(ref, { user_id: uid, month, count: 1, bonus_credits: 0 });
                }
            } else {
                tx.update(ref, { bonus_credits: bonus - 1 });
            }

            const newRemaining = totalRemaining - 1;
            return {
                allowed: true,
                remaining: newRemaining,
                isPremium: false,
                bonusCredits: freeRemaining > 0 ? bonus : bonus - 1,
            };
        });
    }
);

export const stripeWebhook = onRequest(
    { region: 'asia-northeast1' },
    async (req, res) => {
        const sig = req.headers['stripe-signature'] as string;
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

        let event: Stripe.Event;
        try {
            const stripe = getStripe();
            event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            console.error('Webhook signature verification failed:', msg);
            res.status(400).send(`Webhook Error: ${msg}`);
            return;
        }

        if (event.type !== 'checkout.session.completed') {
            res.status(200).json({ received: true, ignored: event.type });
            return;
        }

        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const priceId = session.metadata?.priceId;

        // metadata.credits は参考値に留め、priceId からサーバー側で再算出する
        const credits = priceId ? PRICE_CREDIT_MAP[priceId] : undefined;

        if (!userId || !credits) {
            console.warn('Missing metadata', { userId, priceId });
            res.status(200).json({ received: true, skipped: 'missing metadata' });
            return;
        }

        const db = admin.firestore();
        const eventRef = db.collection('stripe_events').doc(event.id);
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const usageRef = db.collection('usage').doc(`${userId}_${month}`);

        try {
            await db.runTransaction(async (tx) => {
                const eventSnap = await tx.get(eventRef);
                if (eventSnap.exists) {
                    return; // 処理済み
                }
                const usageSnap = await tx.get(usageRef);
                if (usageSnap.exists) {
                    tx.update(usageRef, {
                        bonus_credits: admin.firestore.FieldValue.increment(credits),
                    });
                } else {
                    tx.set(usageRef, {
                        user_id: userId,
                        month,
                        count: 0,
                        bonus_credits: credits,
                    });
                }
                tx.set(eventRef, {
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    userId,
                    credits,
                });
            });
            console.log(`Added ${credits} bonus credits to user ${userId} (event ${event.id})`);
        } catch (err) {
            console.error('Failed to apply credits:', err);
            res.status(500).json({ error: 'failed to apply credits' });
            return;
        }

        res.status(200).json({ received: true });
    }
);
