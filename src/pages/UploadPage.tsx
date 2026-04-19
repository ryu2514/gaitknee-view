import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { analyzeGait } from '../hooks/useGaitAnalysis';
import { useAuth, FREE_MONTHLY_LIMIT } from '../contexts/AuthContext';
import { consumeCredit } from '../lib/db';
import type { PoseLandmark } from '../types/pose';
import type { FrameData } from '../types/pose';
import type { GaitAnalysisResult } from '../types/gait';
import LoadingScreen from '../components/LoadingScreen';
import './UploadPage.css';

export default function UploadPage() {
    const navigate = useNavigate();
    const { user, refreshUsage } = useAuth();
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [poseLoading, setPoseLoading] = useState(true);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [recordedWebmUrl, setRecordedWebmUrl] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [conversionProgress, setConversionProgress] = useState(0);
    const [currentTrial, setCurrentTrial] = useState(0);
    const [totalTrials] = useState(5);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    // Initialize MediaPipe
    useEffect(() => {
        const init = async () => {
            try {
                setPoseLoading(true);
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
                setPoseLoading(false);
            } catch (err) {
                console.error('[UploadPage] MediaPipe init error:', err);
                setError('MediaPipeの初期化に失敗しました');
                setPoseLoading(false);
            }
        };
        init();

        return () => {
            if (poseLandmarkerRef.current) {
                poseLandmarkerRef.current.close();
            }
        };
    }, []);

    // Initialize FFmpeg
    useEffect(() => {
        const loadFFmpeg = async () => {
            try {
                const ffmpeg = new FFmpeg();
                ffmpegRef.current = ffmpeg;

                ffmpeg.on('log', ({ message }) => {
                    console.log('[FFmpeg]', message);
                });

                ffmpeg.on('progress', ({ progress }) => {
                    setConversionProgress(Math.round(progress * 100));
                });

                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });

                setFfmpegLoaded(true);
            } catch (err) {
                console.error('[FFmpeg] Load error:', err);
            }
        };
        loadFFmpeg();
    }, []);

    // Warn user when trying to leave during analysis
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isAnalyzing) {
                e.preventDefault();
                e.returnValue = '解析中です。ページを離れると解析が中断されます。';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isAnalyzing]);

    // Clean up URL on unmount
    useEffect(() => {
        return () => {
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl);
            }
        };
    }, [videoUrl]);

    // Clean up recorded video URL
    useEffect(() => {
        return () => {
            if (recordedVideoUrl) {
                URL.revokeObjectURL(recordedVideoUrl);
            }
        };
    }, [recordedVideoUrl]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            setError('動画ファイルを選択してください');
            return;
        }

        // Validate file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
            setError('ファイルサイズは100MB以下にしてください');
            return;
        }

        setError(null);
        setVideoFile(file);

        // Create object URL for preview
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
    }, [videoUrl]);

    const convertToMP4 = useCallback(async (webmBlob: Blob): Promise<Blob> => {
        if (!ffmpegRef.current || !ffmpegLoaded) {
            throw new Error('FFmpegが初期化されていません');
        }

        setIsConverting(true);
        setConversionProgress(0);

        try {
            const ffmpeg = ffmpegRef.current;

            // Write WebM file
            await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

            // Convert to MP4 with basic, universally compatible settings
            // Using only options that are guaranteed to work in FFmpeg WASM
            await ffmpeg.exec([
                '-i', 'input.webm',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-profile:v', 'baseline',
                '-level', '3.0',
                '-movflags', 'faststart',
                '-f', 'mp4',
                'output.mp4'
            ]);

            // Read output
            const data = await ffmpeg.readFile('output.mp4');
            const mp4Blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });

            // Cleanup
            await ffmpeg.deleteFile('input.webm');
            await ffmpeg.deleteFile('output.mp4');

            setIsConverting(false);
            return mp4Blob;
        } catch (err) {
            console.error('[FFmpeg] Conversion error:', err);
            setIsConverting(false);
            throw err;
        }
    }, [ffmpegLoaded]);

    // Perform a single trial of analysis
    const performSingleTrial = useCallback(async (
        video: HTMLVideoElement,
        canvas: HTMLCanvasElement,
        poseLandmarker: PoseLandmarker,
        drawingUtils: DrawingUtils,
        _trialNumber: number,
        shouldRecord: boolean
    ): Promise<FrameData[]> => {
        const recordedFrames: FrameData[] = [];
        const duration = video.duration;
        const frameInterval = 0.1; // Fixed interval: 10 fps for consistent sampling
        const totalFrames = Math.floor(duration / frameInterval);

        // Reset video to start
        video.currentTime = 0;
        video.pause();

        const ctx = canvas.getContext('2d')!;

        // Helper function to wait for video to seek
        const seekAndWait = (time: number): Promise<void> => {
            return new Promise((resolve) => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                video.addEventListener('seeked', onSeeked);
                video.currentTime = time;
            });
        };

        // Process frames at fixed intervals
        for (let i = 0; i < totalFrames; i++) {
            const targetTime = i * frameInterval;

            // Seek to target time
            await seekAndWait(targetTime);

            // Draw frame to canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Detect pose
            const timestamp = performance.now();
            const results = poseLandmarker.detectForVideo(video, timestamp);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0] as PoseLandmark[];
                const worldLandmarks = (results.worldLandmarks?.[0] || landmarks) as PoseLandmark[];

                // Draw skeleton on canvas (only if recording)
                if (shouldRecord) {
                    drawingUtils.drawConnectors(
                        landmarks,
                        PoseLandmarker.POSE_CONNECTIONS,
                        { color: '#00FF00', lineWidth: 2 }
                    );
                    drawingUtils.drawLandmarks(
                        landmarks,
                        { color: '#FF0000', fillColor: '#FF0000', radius: 3 }
                    );

                    // Highlight knees
                    const rightKnee = landmarks[26]; // RIGHT_KNEE
                    const leftKnee = landmarks[25];  // LEFT_KNEE

                    if (rightKnee) {
                        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
                        ctx.beginPath();
                        ctx.arc(rightKnee.x * canvas.width, rightKnee.y * canvas.height, 16, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = '#FF00FF';
                        ctx.beginPath();
                        ctx.arc(rightKnee.x * canvas.width, rightKnee.y * canvas.height, 8, 0, 2 * Math.PI);
                        ctx.fill();
                    }

                    if (leftKnee) {
                        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                        ctx.beginPath();
                        ctx.arc(leftKnee.x * canvas.width, leftKnee.y * canvas.height, 16, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = '#00FFFF';
                        ctx.beginPath();
                        ctx.arc(leftKnee.x * canvas.width, leftKnee.y * canvas.height, 8, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }

                // Record frame
                recordedFrames.push({
                    timestamp: targetTime * 1000,
                    landmarks,
                    worldLandmarks
                });
            }

            // Update progress
            const videoProgress = Math.round((i / totalFrames) * 100);
            setProgress(videoProgress);
        }

        return recordedFrames;
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || !videoUrl || poseLoading) {
            return;
        }

        // サーバー側でアトミックに利用回数を消費する（無制限プランはスキップされる）
        if (user) {
            try {
                await consumeCredit();
            } catch (err) {
                const msg = err instanceof Error ? err.message : '';
                if (msg.includes('resource-exhausted') || msg.includes('利用回数')) {
                    setError(`今月の無料利用回数（${FREE_MONTHLY_LIMIT}回）を使い切りました。クレジットを購入するか、プレミアムプランにアップグレードしてください。`);
                } else {
                    setError('利用回数の確認に失敗しました。しばらく経ってから再度お試しください。');
                }
                return;
            }
        }

        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
        setRecordedVideoUrl(null);
        setCurrentTrial(0);

        // Clear old session storage data
        sessionStorage.removeItem('recordedFrames');
        sessionStorage.removeItem('allTrialResults');

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const poseLandmarker = poseLandmarkerRef.current;

        try {
            // Wait for video metadata
            await new Promise<void>((resolve, reject) => {
                if (video.readyState >= 1) {
                    resolve();
                } else {
                    video.onloadedmetadata = () => resolve();
                    video.onerror = () => reject(new Error('動画の読み込みに失敗しました'));
                }
            });

            const _duration = video.duration;

            // Setup canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            const drawingUtils = new DrawingUtils(ctx);

            // Store results from all trials
            const allTrialResults: GaitAnalysisResult[] = [];
            const allTrialFrames: FrameData[][] = [];

            // === 3回ループ解析 ===
            for (let trial = 0; trial < totalTrials; trial++) {
                setCurrentTrial(trial + 1);
                setProgress(0);

                console.log(`[Trial ${trial + 1}/${totalTrials}] Starting analysis...`);

                // Always draw skeleton for visualization, only record video on last trial
                const shouldDrawSkeleton = true;
                const shouldRecordVideo = trial === totalTrials - 1;

                // Setup MediaRecorder for canvas recording (only on last trial)
                let mediaRecorder: MediaRecorder | null = null;
                if (shouldRecordVideo) {
                    recordedChunksRef.current = [];
                    const stream = canvas.captureStream(30);
                    mediaRecorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp9',
                        videoBitsPerSecond: 2500000
                    });

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            recordedChunksRef.current.push(event.data);
                        }
                    };

                    mediaRecorder.start();
                    mediaRecorderRef.current = mediaRecorder;
                }

                // Perform single trial with skeleton drawing
                const trialFrames = await performSingleTrial(
                    video, canvas, poseLandmarker, drawingUtils, trial + 1, shouldDrawSkeleton
                );

                // Stop recording if active
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();

                    // Wait for recording to complete
                    await new Promise<void>((resolve) => {
                        mediaRecorder!.onstop = async () => {
                            const webmBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

                            // Always save WebM as guaranteed fallback
                            const webmUrl = URL.createObjectURL(webmBlob);
                            setRecordedWebmUrl(webmUrl);

                            try {
                                const mp4Blob = await convertToMP4(webmBlob);
                                const mp4Url = URL.createObjectURL(mp4Blob);
                                setRecordedVideoUrl(mp4Url);
                            } catch (err) {
                                console.error('[UploadPage] MP4 conversion error:', err);
                                // Use WebM as fallback
                                setRecordedVideoUrl(webmUrl);
                            }
                            resolve();
                        };
                    });
                }

                if (trialFrames.length === 0) {
                    console.warn(`[Trial ${trial + 1}] No frames detected`);
                    continue;
                }

                allTrialFrames.push(trialFrames);

                // Analyze this trial
                const trialAnalysis = analyzeGait(trialFrames);
                if (trialAnalysis) {
                    allTrialResults.push(trialAnalysis);
                    console.log(`[Trial ${trial + 1}] Analysis complete:`, {
                        frames: trialFrames.length,
                        stancePhases: trialAnalysis.stancePhases.length,
                        rightAmplitude: trialAnalysis.lateralThrust.rightKnee.amplitude,
                        leftAmplitude: trialAnalysis.lateralThrust.leftKnee.amplitude
                    });
                }

                // Small delay between trials to let MediaPipe reset
                if (trial < totalTrials - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (allTrialResults.length === 0) {
                throw new Error('3回の解析全てで人物が検出されませんでした。動画に人が映っているか確認してください。');
            }

            // Choose the best result (most frames detected = most reliable)
            const bestTrialIndex = allTrialFrames.reduce((bestIndex, frames, currentIndex, arr) =>
                frames.length > arr[bestIndex].length ? currentIndex : bestIndex
                , 0);

            const bestFrames = allTrialFrames[bestTrialIndex];
            const _bestResult = allTrialResults[bestTrialIndex];

            console.log(`[Analysis Summary] Best trial: ${bestTrialIndex + 1}/${totalTrials}`);
            console.log(`[Analysis Summary] Total successful trials: ${allTrialResults.length}`);

            // Calculate average values across all trials for stability
            const avgRightAmplitude = allTrialResults.reduce((sum, r) => sum + r.lateralThrust.rightKnee.amplitude, 0) / allTrialResults.length;
            const avgLeftAmplitude = allTrialResults.reduce((sum, r) => sum + r.lateralThrust.leftKnee.amplitude, 0) / allTrialResults.length;
            const avgAsymmetry = allTrialResults.reduce((sum, r) => sum + r.lateralThrust.asymmetryPercent, 0) / allTrialResults.length;

            console.log(`[Analysis Summary] Average values across ${allTrialResults.length} trials:`, {
                rightAmplitude: avgRightAmplitude.toFixed(2),
                leftAmplitude: avgLeftAmplitude.toFixed(2),
                asymmetry: avgAsymmetry.toFixed(1)
            });

            // Store best frames for results page
            sessionStorage.setItem('recordedFrames', JSON.stringify(bestFrames));

            // Store all trial results for comparison
            sessionStorage.setItem('allTrialResults', JSON.stringify({
                trials: allTrialResults,
                bestTrialIndex,
                averages: {
                    rightAmplitude: avgRightAmplitude,
                    leftAmplitude: avgLeftAmplitude,
                    asymmetry: avgAsymmetry
                }
            }));

            // クレジットは解析前に consumeCredit で消費済みなので、ここでは残量表示のみ更新
            if (user) {
                await refreshUsage();
            }

            setIsAnalyzing(false);
            setCurrentTrial(0);
            navigate('/results');

        } catch (err) {
            console.error('[UploadPage] Analysis error:', err);
            setError(err instanceof Error ? err.message : '解析に失敗しました');
            setIsAnalyzing(false);
            setCurrentTrial(0);
        }
    }, [videoUrl, poseLoading, totalTrials, performSingleTrial, convertToMP4]);

    return (
        <div className="upload-page">
            <header className="upload-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    ← 戻る
                </button>
                <h1>動画をアップロード</h1>
            </header>

            <main className="upload-main">
                {!videoFile ? (
                    <div className="upload-zone">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="file-input"
                            id="video-input"
                        />
                        <label htmlFor="video-input" className="upload-label">
                            <div className="upload-icon">📁</div>
                            <p className="upload-text">動画ファイルを選択</p>
                            <p className="upload-hint">MP4, MOV, WebM対応（最大100MB）</p>
                        </label>
                    </div>
                ) : (
                    <div className="preview-container">
                        <div className="video-wrapper">
                            <video
                                ref={videoRef}
                                src={videoUrl || undefined}
                                className="preview-video"
                                controls={!isAnalyzing}
                                muted
                                playsInline
                            />
                            <canvas
                                ref={canvasRef}
                                className={`analysis-overlay ${isAnalyzing ? 'visible' : ''}`}
                            />
                        </div>

                        <div className="file-info">
                            <span className="file-name">{videoFile.name}</span>
                            <button
                                className="change-file-btn"
                                onClick={() => {
                                    setVideoFile(null);
                                    if (videoUrl) URL.revokeObjectURL(videoUrl);
                                    setVideoUrl(null);
                                    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
                                    setRecordedVideoUrl(null);
                                }}
                                disabled={isAnalyzing}
                            >
                                変更
                            </button>
                        </div>

                        {isAnalyzing && (
                            <div className="inline-loading">
                                <LoadingScreen
                                    message="解析中"
                                    progress={progress}
                                    trial={currentTrial > 0 ? { current: currentTrial, total: totalTrials } : undefined}
                                />
                            </div>
                        )}

                        {isConverting && (
                            <div className="inline-loading">
                                <LoadingScreen
                                    message="MP4に変換中"
                                    progress={conversionProgress}
                                />
                            </div>
                        )}

                        {recordedVideoUrl && !isAnalyzing && !isConverting && (
                            <div className="completion-actions">
                                <div className="success-message">
                                    ✓ 解析が完了しました！
                                </div>
                                <div className="action-buttons">
                                    <a
                                        href={recordedVideoUrl}
                                        download={`gaitknee-analyzed-${Date.now()}.mp4`}
                                        className="download-video-btn"
                                    >
                                        📹 MP4でダウンロード
                                    </a>
                                    {recordedWebmUrl && (
                                        <a
                                            href={recordedWebmUrl}
                                            download={`gaitknee-analyzed-${Date.now()}.webm`}
                                            className="download-video-btn secondary"
                                        >
                                            🎬 WebMでダウンロード
                                        </a>
                                    )}
                                    <button
                                        onClick={() => navigate('/results')}
                                        className="view-results-btn"
                                    >
                                        📊 結果を見る
                                    </button>
                                </div>
                                <p className="download-hint">
                                    ※ MP4が再生できない場合はWebM形式をお試しください
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}
            </main>

            <footer className="upload-footer">
                <button
                    className="btn btn-primary btn-large"
                    onClick={handleAnalyze}
                    disabled={!videoFile || isAnalyzing || poseLoading}
                >
                    {poseLoading ? 'モデル読み込み中...' : isAnalyzing ? '解析中...' : '解析開始'}
                </button>
            </footer>
        </div>
    );
}
