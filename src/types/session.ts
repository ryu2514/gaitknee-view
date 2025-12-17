import type { FrameData } from './pose';
import type { GaitAnalysisResult } from './gait';

export interface Session {
    id: string;
    createdAt: Date;
    frames: FrameData[];
    analysis: GaitAnalysisResult | null;
    thumbnailUrl?: string;
}
