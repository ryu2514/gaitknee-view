import { useMemo } from 'react';
import type { FrameData } from '../types/pose';
import type { GaitAnalysisResult, StancePhase, LateralThrustData, ThrustMetrics, GaitCycle, GaitPhase, GaitPhaseType } from '../types/gait';
import { POSE_LANDMARKS } from '../types/pose';

interface UseGaitAnalysisResult {
    analysis: GaitAnalysisResult | null;
    isAnalyzing: boolean;
}

export function useGaitAnalysis(frames: FrameData[]): UseGaitAnalysisResult {
    const analysis = useMemo(() => {
        if (frames.length < 30) return null; // Need at least 1 second of data at 30fps

        const stancePhases = detectStancePhases(frames);
        const gaitCycles = detectGaitCycles(stancePhases, frames.length);
        const lateralThrust = calculateLateralThrust(frames, stancePhases);
        const duration = frames.length > 0
            ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000
            : 0;

        return {
            stancePhases,
            gaitCycles,
            lateralThrust,
            totalFrames: frames.length,
            duration
        };
    }, [frames]);

    return {
        analysis,
        isAnalyzing: false
    };
}

// Detect stance phases with improved algorithm
function detectStancePhases(frames: FrameData[]): StancePhase[] {
    if (frames.length < 10) return [];

    const phases: StancePhase[] = [];

    // Extract ankle and knee positions
    const leftAnkleY = frames.map(f => f.landmarks[POSE_LANDMARKS.LEFT_ANKLE]?.y ?? 0);
    const rightAnkleY = frames.map(f => f.landmarks[POSE_LANDMARKS.RIGHT_ANKLE]?.y ?? 0);
    const leftKneeY = frames.map(f => f.landmarks[POSE_LANDMARKS.LEFT_KNEE]?.y ?? 0);
    const rightKneeY = frames.map(f => f.landmarks[POSE_LANDMARKS.RIGHT_KNEE]?.y ?? 0);

    // Calculate velocities using simple differentiation
    const leftAnkleVelocity = calculateVelocity(leftAnkleY);
    const rightAnkleVelocity = calculateVelocity(rightAnkleY);

    // Smooth the signals
    const leftAnkleSmooth = smoothSignal(leftAnkleY, 5);  // Increased from 3 to 5 for stability
    const rightAnkleSmooth = smoothSignal(rightAnkleY, 5);

    // Use FIXED thresholds for consistent measurements (normalized coordinates: 0=top, 1=bottom)
    // Stance occurs when ankle is LOW (high Y value in normalized coords)
    const leftThreshold = 0.60;  // Lowered from 0.65 to detect more phases
    const rightThreshold = 0.60;  // Same threshold for both legs

    // Detect phases with hysteresis
    const hysteresis = 0.025; // Balanced hysteresis
    const minPhaseDuration = 6; // Lowered from 8 to 6 frames (0.4s at 15fps) for better detection

    // Process left leg
    processLegPhases(
        leftAnkleSmooth,
        leftAnkleVelocity,
        leftKneeY,
        leftThreshold,
        hysteresis,
        minPhaseDuration,
        'left',
        phases
    );

    // Process right leg
    processLegPhases(
        rightAnkleSmooth,
        rightAnkleVelocity,
        rightKneeY,
        rightThreshold,
        hysteresis,
        minPhaseDuration,
        'right',
        phases
    );

    // Debug: Log stance detection info
    console.log('[Consistency Check] Stance phases detected:', phases.length);
    console.log('[Consistency Check] Left phases:', phases.filter(p => p.leg === 'left').length);
    console.log('[Consistency Check] Right phases:', phases.filter(p => p.leg === 'right').length);
    console.log('[Consistency Check] FIXED threshold:', leftThreshold.toFixed(4), '(both legs)');
    console.log('[Consistency Check] Min phase duration:', minPhaseDuration, 'frames');
    console.log('[Consistency Check] Hysteresis:', hysteresis);

    return phases.sort((a, b) => a.startFrame - b.startFrame);
}

// Helper: Calculate velocity from position array
function calculateVelocity(positions: number[]): number[] {
    const velocity: number[] = [0];
    for (let i = 1; i < positions.length; i++) {
        velocity.push(positions[i] - positions[i - 1]);
    }
    return velocity;
}

// Helper: Smooth signal using moving average
function smoothSignal(signal: number[], windowSize: number): number[] {
    const smoothed: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
        const start = Math.max(0, i - halfWindow);
        const end = Math.min(signal.length, i + halfWindow + 1);
        const window = signal.slice(start, end);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        smoothed.push(avg);
    }

    return smoothed;
}

// Helper: Calculate adaptive threshold (reserved for future use)
function _calculateAdaptiveThreshold(signal: number[]): number {
    const sorted = [...signal].sort((a, b) => a - b);
    const percentile75 = sorted[Math.floor(sorted.length * 0.75)];
    const percentile25 = sorted[Math.floor(sorted.length * 0.25)];

    // Threshold is 70% between 25th and 75th percentile
    return percentile25 + (percentile75 - percentile25) * 0.7;
}

// Helper: Process phases for one leg
function processLegPhases(
    ankleY: number[],
    velocity: number[],
    _kneeY: number[],
    threshold: number,
    hysteresis: number,
    minDuration: number,
    leg: 'left' | 'right',
    phases: StancePhase[]
): void {
    let inStance = false;
    let stanceStart = 0;
    const upperThreshold = threshold + hysteresis;
    const lowerThreshold = threshold - hysteresis;

    for (let i = 0; i < ankleY.length; i++) {
        const isHigh = ankleY[i] > upperThreshold;
        const isLow = ankleY[i] < lowerThreshold;
        const velocitySmall = Math.abs(velocity[i]) < 0.012; // FIXED velocity threshold for consistency

        if (!inStance && isHigh && velocitySmall) {
            // Enter stance phase
            inStance = true;
            stanceStart = i;
        } else if (inStance && (isLow || !velocitySmall)) {
            // Exit stance phase
            inStance = false;
            const duration = i - stanceStart;
            if (duration >= minDuration) {
                phases.push({
                    leg,
                    startFrame: stanceStart,
                    endFrame: i - 1
                });
            }
        }
    }

    // Handle ongoing stance at end
    if (inStance && ankleY.length - stanceStart >= minDuration) {
        phases.push({
            leg,
            startFrame: stanceStart,
            endFrame: ankleY.length - 1
        });
    }
}

// Helper: Calculate angle from vertical axis (in degrees) - reserved for future use
// Returns positive angle for lateral deviation
function _calculateAngleFromVertical(
    proximal: { x: number; y: number },
    distal: { x: number; y: number }
): number {
    const dx = distal.x - proximal.x;
    const dy = distal.y - proximal.y;

    // Calculate angle from vertical (y-axis)
    // atan2(dx, dy) gives angle from vertical axis
    const angleRad = Math.atan2(dx, dy);
    const angleDeg = angleRad * (180 / Math.PI);

    return angleDeg;
}

// Calculate lateral thrust
function calculateLateralThrust(frames: FrameData[], stancePhases: StancePhase[]): LateralThrustData {
    const leftMetrics = calculateThrustMetrics(frames, stancePhases.filter(p => p.leg === 'left'), 'left');
    const rightMetrics = calculateThrustMetrics(frames, stancePhases.filter(p => p.leg === 'right'), 'right');

    const maxAmplitude = Math.max(leftMetrics.amplitude, rightMetrics.amplitude);
    const asymmetry = maxAmplitude > 0
        ? Math.abs(leftMetrics.amplitude - rightMetrics.amplitude) / maxAmplitude * 100
        : 0;

    return {
        leftKnee: leftMetrics,
        rightKnee: rightMetrics,
        asymmetryPercent: Math.round(asymmetry)
    };
}

function calculateThrustMetrics(
    frames: FrameData[],
    phases: StancePhase[],
    leg: 'left' | 'right'
): ThrustMetrics {
    const kneeIdx = leg === 'left' ? POSE_LANDMARKS.LEFT_KNEE : POSE_LANDMARKS.RIGHT_KNEE;
    const ankleIdx = leg === 'left' ? POSE_LANDMARKS.LEFT_ANKLE : POSE_LANDMARKS.RIGHT_ANKLE;
    const hipIdx = leg === 'left' ? POSE_LANDMARKS.LEFT_HIP : POSE_LANDMARKS.RIGHT_HIP;

    // Create stance phase frame mask (true if frame is in any stance phase)
    const isStanceFrame = new Array(frames.length).fill(false);
    for (const phase of phases) {
        for (let i = phase.startFrame; i <= phase.endFrame; i++) {
            if (i < frames.length) {
                isStanceFrame[i] = true;
            }
        }
    }

    const waveform: number[] = [];
    const timePoints: number[] = [];
    let stanceFrameCount = 0;
    let swingFrameCount = 0;

    // Calculate lateral thrust ONLY during stance phases (体重がかかっている時のみ)
    for (let i = 0; i < frames.length; i++) {
        const hip = frames[i].landmarks[hipIdx];
        const knee = frames[i].landmarks[kneeIdx];
        const ankle = frames[i].landmarks[ankleIdx];

        if (hip && knee && ankle) {
            // Calculate perpendicular distance from knee to hip-ankle line
            // This measures true lateral thrust: knee displacement from body axis
            const dx = ankle.x - hip.x;
            const dy = ankle.y - hip.y;
            const lineLength = Math.sqrt(dx * dx + dy * dy);

            let lateralThrust = 0;
            if (lineLength > 0) {
                // Perpendicular distance using cross product: |AP × AB| / |AB|
                // where A=hip, B=ankle, P=knee
                const distance = Math.abs(
                    (ankle.x - hip.x) * (hip.y - knee.y) -
                    (hip.x - knee.x) * (ankle.y - hip.y)
                ) / lineLength;

                // Scale to approximate cm (normalized coordinates 0-1 → ~100cm)
                lateralThrust = distance * 100;
            }

            if (isStanceFrame[i]) {
                // ONLY add stance phase data to waveform
                waveform.push(lateralThrust);
                timePoints.push(frames[i].timestamp);
                stanceFrameCount++;
            } else {
                // Swing phase - add 0 for visualization continuity
                waveform.push(0);
                timePoints.push(frames[i].timestamp);
                swingFrameCount++;
            }
        } else {
            waveform.push(0);
            timePoints.push(frames[i].timestamp);
        }
    }

    // Calculate amplitude from stance phase data only
    let maxAmplitude = 0;
    let maxDisplacement = 0;

    for (const phase of phases) {
        const phaseData: number[] = [];
        for (let i = phase.startFrame; i <= phase.endFrame && i < waveform.length; i++) {
            if (waveform[i] > 0) {  // Skip zeros (swing phase markers)
                phaseData.push(waveform[i]);
            }
        }

        if (phaseData.length > 0) {
            const min = Math.min(...phaseData);
            const max = Math.max(...phaseData);
            const amplitude = max - min;

            if (amplitude > maxAmplitude) {
                maxAmplitude = amplitude;
            }

            const displacement = Math.max(Math.abs(min), Math.abs(max));
            if (displacement > maxDisplacement) {
                maxDisplacement = displacement;
            }
        }
    }

    // Determine severity based on distance (cm)
    // Clinical thresholds: normal <2cm, abnormal >4cm
    let severity: 'low' | 'moderate' | 'high';
    if (maxAmplitude < 2) {
        severity = 'low';  // Normal range
    } else if (maxAmplitude < 4) {
        severity = 'moderate';  // Mild lateral thrust
    } else {
        severity = 'high';  // Significant lateral thrust
    }

    const result = {
        amplitude: Math.round(maxAmplitude * 10) / 10,
        maxDisplacement: Math.round(maxDisplacement * 10) / 10,
        waveform,
        timePoints,
        severity
    };

    // Debug: Log thrust calculation
    console.log('[Consistency Check] Thrust calculation - Amplitude:', result.amplitude, 'Severity:', result.severity);
    console.log('[Consistency Check] Stance frames:', stanceFrameCount, '/ Total:', waveform.length);
    console.log('[Consistency Check] Swing frames (excluded):', swingFrameCount);
    console.log('[Consistency Check] Stance phases used:', phases.length);

    return result;
}

// Detect detailed gait cycles with 8 phases (Rancho Los Amigos)
function detectGaitCycles(stancePhases: StancePhase[], _totalFrames: number): GaitCycle[] {
    const cycles: GaitCycle[] = [];

    // Group stance phases by leg
    const leftStances = stancePhases.filter(p => p.leg === 'left').sort((a, b) => a.startFrame - b.startFrame);
    const rightStances = stancePhases.filter(p => p.leg === 'right').sort((a, b) => a.startFrame - b.startFrame);

    // Process each leg
    [
        { leg: 'left' as const, stances: leftStances },
        { leg: 'right' as const, stances: rightStances }
    ].forEach(({ leg, stances }) => {
        // Create cycles from consecutive stance phases
        for (let i = 0; i < stances.length - 1; i++) {
            const currentStance = stances[i];
            const nextStance = stances[i + 1];

            const cycleStart = currentStance.startFrame;  // IC
            const cycleEnd = nextStance.startFrame;       // Next IC
            const cycleDuration = cycleEnd - cycleStart;

            if (cycleDuration < 10) continue; // Skip too-short cycles

            const phases = subdivideGaitCycle(cycleStart, cycleEnd, currentStance.endFrame, leg);
            cycles.push({
                leg,
                startFrame: cycleStart,
                endFrame: cycleEnd,
                phases
            });
        }
    });

    return cycles.sort((a, b) => a.startFrame - b.startFrame);
}

// Subdivide a gait cycle into 8 phases based on Rancho Los Amigos percentages
function subdivideGaitCycle(
    cycleStart: number,
    cycleEnd: number,
    _toeOff: number,
    leg: 'left' | 'right'
): GaitPhase[] {
    const cycleDuration = cycleEnd - cycleStart;
    const phases: GaitPhase[] = [];

    // Phase definitions: [type, startPercent, endPercent]
    const phaseDefinitions: Array<[GaitPhaseType, number, number]> = [
        ['IC', 0, 2],        // Initial Contact
        ['LR', 2, 12],       // Loading Response
        ['MSt', 12, 31],     // Mid Stance
        ['TSt', 31, 50],     // Terminal Stance
        ['PSw', 50, 62],     // Pre-Swing
        ['ISw', 62, 75],     // Initial Swing
        ['MSw', 75, 87],     // Mid Swing
        ['TSw', 87, 100]     // Terminal Swing
    ];

    for (const [type, startPct, endPct] of phaseDefinitions) {
        const startFrame = Math.round(cycleStart + (cycleDuration * startPct / 100));
        const endFrame = Math.round(cycleStart + (cycleDuration * endPct / 100));

        phases.push({
            leg,
            type,
            startFrame,
            endFrame,
            startPercent: startPct,
            endPercent: endPct
        });
    }

    return phases;
}

// Export standalone analysis function for use outside of React components
export function analyzeGait(frames: FrameData[]): GaitAnalysisResult | null {
    if (frames.length < 30) return null; // Need at least 1 second of data at 30fps

    const stancePhases = detectStancePhases(frames);
    const gaitCycles = detectGaitCycles(stancePhases, frames.length);
    const lateralThrust = calculateLateralThrust(frames, stancePhases);
    const duration = frames.length > 0
        ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000
        : 0;

    return {
        stancePhases,
        gaitCycles,
        lateralThrust,
        totalFrames: frames.length,
        duration
    };
}
