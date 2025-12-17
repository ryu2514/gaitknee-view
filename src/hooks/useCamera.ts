import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraOptions {
    facingMode?: 'user' | 'environment';
}

interface UseCameraResult {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    stream: MediaStream | null;
    isReady: boolean;
    error: Error | null;
    facingMode: 'user' | 'environment';
    switchCamera: () => Promise<void>;
    startCamera: () => Promise<void>;
    stopCamera: () => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
        options.facingMode || 'environment'
    );

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const isMountedRef = useRef(true);
    const streamRef = useRef<MediaStream | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setStream(null);
            setIsReady(false);
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setError(null);
            setIsReady(false);

            // Stop any existing stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Check if component is still mounted
            if (!isMountedRef.current) {
                mediaStream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = mediaStream;
            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;

                // Use onloadedmetadata event instead of directly calling play()
                videoRef.current.onloadedmetadata = async () => {
                    if (!isMountedRef.current || !videoRef.current) return;

                    try {
                        await videoRef.current.play();
                        if (isMountedRef.current) {
                            setIsReady(true);
                        }
                    } catch (playError) {
                        // Ignore AbortError - this happens when navigating away
                        if (playError instanceof Error && playError.name === 'AbortError') {
                            console.log('Play was aborted - this is expected during navigation');
                            return;
                        }
                        throw playError;
                    }
                };
            }
        } catch (err) {
            if (!isMountedRef.current) return;

            const error = err instanceof Error ? err : new Error('カメラの起動に失敗しました');
            setError(error);
            console.error('Camera error:', err);
        }
    }, [facingMode]);

    const switchCamera = useCallback(async () => {
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);
    }, [facingMode]);

    // Restart camera when facing mode changes
    useEffect(() => {
        if (streamRef.current) {
            startCamera();
        }
    }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    return {
        videoRef,
        stream,
        isReady,
        error,
        facingMode,
        switchCamera,
        startCamera,
        stopCamera
    };
}
