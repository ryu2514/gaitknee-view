import { useState, useCallback, useRef, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from '../types/pose';

interface UsePoseDetectionOptions {
    onResults?: (landmarks: PoseLandmark[], worldLandmarks: PoseLandmark[]) => void;
}

interface UsePoseDetectionResult {
    isLoading: boolean;
    isProcessing: boolean;
    error: Error | null;
    fps: number;
    landmarks: PoseLandmark[] | null;
    worldLandmarks: PoseLandmark[] | null;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    startDetection: (video: HTMLVideoElement) => void;
    stopDetection: () => void;
}

export function usePoseDetection(options: UsePoseDetectionOptions = {}): UsePoseDetectionResult {
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [fps, setFps] = useState(0);
    const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);
    const [worldLandmarks, setWorldLandmarks] = useState<PoseLandmark[] | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const fpsIntervalRef = useRef<number | null>(null);
    const kneeTrailRef = useRef<{ left: Array<{ x: number; y: number }>; right: Array<{ x: number; y: number }> }>({
        left: [],
        right: []
    });

    // Initialize MediaPipe
    useEffect(() => {
        const init = async () => {
            try {
                setIsLoading(true);

                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
                );

                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1
                });

                setIsLoading(false);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('MediaPipeの初期化に失敗しました');
                setError(error);
                setIsLoading(false);
                console.error('MediaPipe init error:', err);
            }
        };

        init();

        return () => {
            if (poseLandmarkerRef.current) {
                poseLandmarkerRef.current.close();
            }
        };
    }, []);

    const startDetection = useCallback((video: HTMLVideoElement) => {
        if (!poseLandmarkerRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        frameCountRef.current = 0;

        // Reset knee trails
        kneeTrailRef.current = { left: [], right: [] };

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drawingUtils = new DrawingUtils(ctx);

        // FPS counter
        fpsIntervalRef.current = window.setInterval(() => {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
        }, 1000);

        const detect = () => {
            if (!poseLandmarkerRef.current || !video.videoWidth) {
                animationFrameRef.current = requestAnimationFrame(detect);
                return;
            }

            const now = performance.now();

            // Ensure we have a valid timestamp
            if (now <= lastFrameTimeRef.current) {
                animationFrameRef.current = requestAnimationFrame(detect);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const results = poseLandmarkerRef.current.detectForVideo(video, now);
            lastFrameTimeRef.current = now;
            frameCountRef.current++;

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const detectedLandmarks = results.landmarks[0] as PoseLandmark[];
                const detectedWorldLandmarks = (results.worldLandmarks?.[0] || detectedLandmarks) as PoseLandmark[];

                setLandmarks(detectedLandmarks);
                setWorldLandmarks(detectedWorldLandmarks);

                // Draw skeleton
                drawingUtils.drawConnectors(
                    detectedLandmarks,
                    PoseLandmarker.POSE_CONNECTIONS,
                    { color: '#00FF00', lineWidth: 3 }
                );
                drawingUtils.drawLandmarks(
                    detectedLandmarks,
                    { color: '#FF0000', radius: 4 }
                );

                // Track knee positions for trail
                const leftKnee = detectedLandmarks[26]; // LEFT_KNEE
                const rightKnee = detectedLandmarks[25]; // RIGHT_KNEE
                const leftAnkle = detectedLandmarks[28]; // LEFT_ANKLE
                const rightAnkle = detectedLandmarks[27]; // RIGHT_ANKLE

                if (leftKnee && leftAnkle) {
                    kneeTrailRef.current.left.push({
                        x: leftKnee.x * canvas.width,
                        y: leftKnee.y * canvas.height
                    });
                    // Keep only last 30 points
                    if (kneeTrailRef.current.left.length > 30) {
                        kneeTrailRef.current.left.shift();
                    }
                }

                if (rightKnee && rightAnkle) {
                    kneeTrailRef.current.right.push({
                        x: rightKnee.x * canvas.width,
                        y: rightKnee.y * canvas.height
                    });
                    if (kneeTrailRef.current.right.length > 30) {
                        kneeTrailRef.current.right.shift();
                    }
                }

                // Draw knee trails
                const drawTrail = (trail: Array<{ x: number; y: number }>, color: string) => {
                    if (trail.length < 2) return;

                    ctx.beginPath();
                    ctx.moveTo(trail[0].x, trail[0].y);
                    for (let i = 1; i < trail.length; i++) {
                        ctx.lineTo(trail[i].x, trail[i].y);
                    }
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.stroke();

                    // Draw gradient overlay for trail
                    trail.forEach((point, i) => {
                        const alpha = (i / trail.length) * 0.6;
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                        ctx.fillStyle = color.replace('1)', `${alpha})`);
                        ctx.fill();
                    });
                };

                drawTrail(kneeTrailRef.current.left, 'rgba(0, 255, 255, 1)'); // Cyan for left
                drawTrail(kneeTrailRef.current.right, 'rgba(255, 0, 255, 1)'); // Magenta for right

                // Highlight knee landmarks with glow effect
                const highlightKnee = (knee: PoseLandmark | undefined, color: string) => {
                    if (!knee) return;

                    const x = knee.x * canvas.width;
                    const y = knee.y * canvas.height;

                    // Outer glow
                    ctx.beginPath();
                    ctx.arc(x, y, 16, 0, 2 * Math.PI);
                    ctx.fillStyle = color.replace('1)', '0.3)');
                    ctx.fill();

                    // Inner circle
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                };

                highlightKnee(leftKnee, 'rgba(0, 255, 255, 1)');
                highlightKnee(rightKnee, 'rgba(255, 0, 255, 1)');

                // Draw lateral thrust arrows
                if (leftKnee && leftAnkle) {
                    const dx = (leftKnee.x - leftAnkle.x) * canvas.width;
                    if (Math.abs(dx) > 10) {
                        const kneeX = leftKnee.x * canvas.width;
                        const kneeY = leftKnee.y * canvas.height;
                        const arrowLength = Math.min(Math.abs(dx), 50);
                        const direction = dx > 0 ? 1 : -1;

                        // Arrow line
                        ctx.beginPath();
                        ctx.moveTo(kneeX, kneeY);
                        ctx.lineTo(kneeX + direction * arrowLength, kneeY);
                        ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
                        ctx.lineWidth = 3;
                        ctx.stroke();

                        // Arrowhead
                        const arrowSize = 10;
                        ctx.beginPath();
                        ctx.moveTo(kneeX + direction * arrowLength, kneeY);
                        ctx.lineTo(kneeX + direction * (arrowLength - arrowSize), kneeY - arrowSize / 2);
                        ctx.lineTo(kneeX + direction * (arrowLength - arrowSize), kneeY + arrowSize / 2);
                        ctx.closePath();
                        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
                        ctx.fill();
                    }
                }

                if (rightKnee && rightAnkle) {
                    const dx = (rightKnee.x - rightAnkle.x) * canvas.width;
                    if (Math.abs(dx) > 10) {
                        const kneeX = rightKnee.x * canvas.width;
                        const kneeY = rightKnee.y * canvas.height;
                        const arrowLength = Math.min(Math.abs(dx), 50);
                        const direction = dx > 0 ? 1 : -1;

                        ctx.beginPath();
                        ctx.moveTo(kneeX, kneeY);
                        ctx.lineTo(kneeX + direction * arrowLength, kneeY);
                        ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
                        ctx.lineWidth = 3;
                        ctx.stroke();

                        const arrowSize = 10;
                        ctx.beginPath();
                        ctx.moveTo(kneeX + direction * arrowLength, kneeY);
                        ctx.lineTo(kneeX + direction * (arrowLength - arrowSize), kneeY - arrowSize / 2);
                        ctx.lineTo(kneeX + direction * (arrowLength - arrowSize), kneeY + arrowSize / 2);
                        ctx.closePath();
                        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
                        ctx.fill();
                    }
                }

                // Callback
                options.onResults?.(detectedLandmarks, detectedWorldLandmarks);
            }

            animationFrameRef.current = requestAnimationFrame(detect);
        };

        animationFrameRef.current = requestAnimationFrame(detect);
    }, [options]);

    const stopDetection = useCallback(() => {
        setIsProcessing(false);

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (fpsIntervalRef.current) {
            clearInterval(fpsIntervalRef.current);
            fpsIntervalRef.current = null;
        }
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            stopDetection();
        };
    }, [stopDetection]);

    return {
        isLoading,
        isProcessing,
        error,
        fps,
        landmarks,
        worldLandmarks,
        canvasRef,
        startDetection,
        stopDetection
    };
}
