import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
    console.warn('Missing Stripe publishable key');
}

export const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

// Credit pack configurations
export const CREDIT_PACKS = [
    {
        id: '5_credits',
        name: '5回パック',
        credits: 5,
        price: 980,
        priceId: import.meta.env.VITE_STRIPE_PRICE_5_CREDITS,
        description: 'ちょっと足りない時に',
    },
    {
        id: '10_credits',
        name: '10回パック',
        credits: 10,
        price: 1980,
        priceId: import.meta.env.VITE_STRIPE_PRICE_10_CREDITS,
        description: '人気No.1',
        popular: true,
    },
    {
        id: '30_credits',
        name: '30回パック',
        credits: 30,
        price: 4980,
        priceId: import.meta.env.VITE_STRIPE_PRICE_30_CREDITS,
        description: '最大17%お得',
    },
];

export type CreditPack = typeof CREDIT_PACKS[number];
