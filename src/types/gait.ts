// Lateral Thrust結果
export interface LateralThrustData {
    leftKnee: ThrustMetrics;
    rightKnee: ThrustMetrics;
    asymmetryPercent: number;  // 左右差%
}

export interface ThrustMetrics {
    amplitude: number;         // 振幅
    maxDisplacement: number;   // 最大変位
    waveform: number[];        // 時系列データ
    timePoints: number[];      // 時間軸
    severity: 'low' | 'moderate' | 'high';
}

// 歩行周期のフェーズ（Rancho Los Amigos方式）
export type GaitPhaseType =
    | 'IC'    // Initial Contact (0-2%)
    | 'LR'    // Loading Response (2-12%)
    | 'MSt'   // Mid Stance (12-31%)
    | 'TSt'   // Terminal Stance (31-50%)
    | 'PSw'   // Pre-Swing (50-62%)
    | 'ISw'   // Initial Swing (62-75%)
    | 'MSw'   // Mid Swing (75-87%)
    | 'TSw';  // Terminal Swing (87-100%)

export interface GaitPhase {
    leg: 'left' | 'right';
    type: GaitPhaseType;
    startFrame: number;
    endFrame: number;
    startPercent: number;  // 歩行周期内での開始% (0-100)
    endPercent: number;    // 歩行周期内での終了% (0-100)
}

export interface GaitCycle {
    leg: 'left' | 'right';
    startFrame: number;    // IC
    endFrame: number;      // 次のIC
    phases: GaitPhase[];   // 8つのフェーズ
}

// 旧型定義（後方互換性のため残す）
export interface StancePhase {
    leg: 'left' | 'right';
    startFrame: number;
    endFrame: number;
}

export interface GaitAnalysisResult {
    stancePhases: StancePhase[];  // 簡易版（IC-TOのみ）
    gaitCycles: GaitCycle[];      // 詳細版（8フェーズ）
    lateralThrust: LateralThrustData;
    totalFrames: number;
    duration: number;  // 秒
}
