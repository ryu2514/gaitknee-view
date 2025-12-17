// 姿勢ランドマーク
export interface PoseLandmark {
    x: number;  // 0-1 正規化座標
    y: number;
    z: number;  // 深度
    visibility: number;
}

// フレームデータ
export interface FrameData {
    timestamp: number;
    landmarks: PoseLandmark[];
    worldLandmarks: PoseLandmark[];
}

// MediaPipe Pose Landmarker インデックス
export const POSE_LANDMARKS = {
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28
} as const;
