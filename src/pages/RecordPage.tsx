import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { useRecorder } from '../hooks/useRecorder';
import { usePoseDetection } from '../hooks/usePoseDetection';
import './RecordPage.css';

export default function RecordPage() {
    const navigate = useNavigate();
    const [showGuide, setShowGuide] = useState(true);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

    const { videoRef, isReady, error: cameraError, facingMode, switchCamera, startCamera, stopCamera } = useCamera();
    const { isRecording, duration, startRecording, stopRecording, addFrame } = useRecorder();
    const {
        isLoading: poseLoading,
        fps,
        canvasRef,
        startDetection,
        stopDetection
    } = usePoseDetection({
        onResults: (landmarks, worldLandmarks) => {
            addFrame(landmarks, worldLandmarks);
        }
    });

    // Check orientation
    useEffect(() => {
        const handleResize = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Start camera on mount
    useEffect(() => {
        let isMounted = true;

        const initCamera = async () => {
            await startCamera();
        };

        initCamera();

        return () => {
            isMounted = false;
            stopDetection();
            stopCamera();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Start pose detection when camera is ready
    useEffect(() => {
        if (isReady && videoRef.current && !poseLoading) {
            // Small delay to ensure video is fully ready
            const timer = setTimeout(() => {
                if (videoRef.current) {
                    startDetection(videoRef.current);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isReady, poseLoading, startDetection, videoRef]);

    const handleRecordToggle = useCallback(() => {
        if (isRecording) {
            const frames = stopRecording();
            stopDetection();
            stopCamera();

            // Store frames in sessionStorage for results page
            sessionStorage.setItem('recordedFrames', JSON.stringify(frames));
            navigate('/results');
        } else {
            setShowGuide(false);
            startRecording();
        }
    }, [isRecording, stopRecording, startRecording, stopDetection, stopCamera, navigate]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (cameraError) {
        return (
            <div className="record-page">
                <div className="error-container">
                    <h2>カメラエラー</h2>
                    <p>{cameraError.message}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        ホームに戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="record-page">
            {/* Orientation warning */}
            {!isLandscape && (
                <div className="orientation-warning">
                    <span className="rotate-icon">📱↻</span>
                    横向きでの撮影を推奨します
                </div>
            )}

            {/* Camera preview */}
            <div className="camera-container">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                />
                <canvas
                    ref={canvasRef}
                    className="pose-overlay"
                />

                {/* Position guide */}
                {showGuide && !isRecording && (
                    <div className="position-guide">
                        <svg viewBox="0 0 200 300" className="guide-silhouette">
                            <ellipse cx="100" cy="30" rx="20" ry="25" stroke="white" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                            <line x1="100" y1="55" x2="100" y2="140" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="100" y1="80" x2="60" y2="120" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="100" y1="80" x2="140" y2="120" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="100" y1="140" x2="70" y2="220" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="100" y1="140" x2="130" y2="220" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="70" y1="220" x2="65" y2="290" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                            <line x1="130" y1="220" x2="135" y2="290" stroke="white" strokeWidth="2" strokeDasharray="5,5" />
                        </svg>
                        <p className="guide-text">被写体を枠内に収めてください</p>
                    </div>
                )}

                {/* Status bar */}
                <div className="status-bar">
                    <span className="fps-display">{fps} FPS</span>
                    {poseLoading && <span className="loading-text">読み込み中...</span>}
                </div>
            </div>

            {/* Controls */}
            <div className="controls-container">
                <button
                    className="btn btn-secondary back-button"
                    onClick={() => navigate('/')}
                    disabled={isRecording}
                >
                    ✕
                </button>

                <div className="record-control">
                    <button
                        className={`record-button ${isRecording ? 'recording' : ''}`}
                        onClick={handleRecordToggle}
                        disabled={poseLoading || !isReady}
                    >
                        {isRecording ? (
                            <span className="stop-icon" />
                        ) : (
                            <span className="rec-icon" />
                        )}
                    </button>
                    <span className="duration-display">
                        {formatDuration(duration)}
                    </span>
                </div>

                <button
                    className="btn btn-secondary flip-button"
                    onClick={switchCamera}
                    disabled={isRecording}
                >
                    {facingMode === 'environment' ? '🔄' : '🔄'}
                </button>
            </div>

            {/* Recording indicator */}
            {isRecording && (
                <div className="recording-indicator">
                    <span className="rec-dot" />
                    REC
                </div>
            )}
        </div>
    );
}
