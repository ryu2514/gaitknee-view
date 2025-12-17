import { useState, useCallback, useRef } from 'react';
import type { FrameData, PoseLandmark } from '../types/pose';

interface UseRecorderResult {
    isRecording: boolean;
    duration: number;
    frames: FrameData[];
    startRecording: () => void;
    stopRecording: () => FrameData[];
    addFrame: (landmarks: PoseLandmark[], worldLandmarks: PoseLandmark[]) => void;
}

export function useRecorder(): UseRecorderResult {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [frames, setFrames] = useState<FrameData[]>([]);

    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const framesRef = useRef<FrameData[]>([]);

    const startRecording = useCallback(() => {
        setFrames([]);
        framesRef.current = [];
        setDuration(0);
        startTimeRef.current = performance.now();
        setIsRecording(true);

        // Update duration every 100ms
        timerRef.current = window.setInterval(() => {
            const elapsed = (performance.now() - startTimeRef.current) / 1000;
            setDuration(elapsed);
        }, 100);
    }, []);

    const stopRecording = useCallback(() => {
        setIsRecording(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const recordedFrames = [...framesRef.current];
        setFrames(recordedFrames);
        return recordedFrames;
    }, []);

    const addFrame = useCallback((landmarks: PoseLandmark[], worldLandmarks: PoseLandmark[]) => {
        if (!isRecording) return;

        const frame: FrameData = {
            timestamp: performance.now() - startTimeRef.current,
            landmarks,
            worldLandmarks
        };

        framesRef.current.push(frame);
    }, [isRecording]);

    return {
        isRecording,
        duration,
        frames,
        startRecording,
        stopRecording,
        addFrame
    };
}
