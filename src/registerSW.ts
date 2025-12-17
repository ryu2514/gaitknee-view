// Register Service Worker for PWA support
export function registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registered:', registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute
                })
                .catch((error) => {
                    console.error('[PWA] Service Worker registration failed:', error);
                });
        });
    }
}

// Prompt user to install PWA
export function setupInstallPrompt(): void {
    let deferredPrompt: Event | null = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] Install prompt available');
    });

    // Expose install function globally
    (window as unknown as { installPWA?: () => void }).installPWA = () => {
        if (!deferredPrompt) {
            console.log('[PWA] Install prompt not available');
            return;
        }

        (deferredPrompt as BeforeInstallPromptEvent).prompt();
        (deferredPrompt as BeforeInstallPromptEvent)
            .userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('[PWA] User accepted install prompt');
                } else {
                    console.log('[PWA] User dismissed install prompt');
                }
                deferredPrompt = null;
            });
    };
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => void;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
