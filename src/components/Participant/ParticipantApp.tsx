import { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';
import signalingService from '../../services/SignalingService';
import type { SignalingEvent } from '../../types';
import styles from './ParticipantApp.module.css';

interface ParticipantAppProps {
    participantId: string;
}

type ParticipantState = 'waiting' | 'inspecting' | 'admitted' | 'removed';

export function ParticipantApp({ participantId }: ParticipantAppProps) {
    const [state, setState] = useState<ParticipantState>('waiting');
    const [deviceSuggestion, setDeviceSuggestion] = useState<{
        deviceId: string;
        deviceLabel: string;
    } | null>(null);
    const { localStream, cleanup } = useWebRTC();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(false);

    useEffect(() => {
        // Listen for signaling events
        const handleSignalingEvent = (event: SignalingEvent) => {
            console.log('Participant received event:', event);

            switch (event.type) {
                case 'inspectionStarted':
                    setState('inspecting');
                    break;
                case 'admitted':
                    setState('admitted');
                    setTimeout(() => {
                        cleanup();
                    }, 3000);
                    break;
                case 'removed':
                    setState('removed');
                    setTimeout(() => {
                        cleanup();
                    }, 3000);
                    break;
                case 'cancelled':
                    setState('waiting');
                    break;
                case 'deviceSuggestion':
                    if (event.deviceId && event.deviceLabel) {
                        setDeviceSuggestion({
                            deviceId: event.deviceId,
                            deviceLabel: event.deviceLabel,
                        });
                    }
                    break;
            }
        };

        signalingService.on('participant', handleSignalingEvent);

        // Enumerate devices
        const enumerateDevices = async () => {
            try {
                const deviceList = await navigator.mediaDevices.enumerateDevices();
                setDevices(deviceList.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput'));
            } catch (err) {
                console.error('Error enumerating devices:', err);
            }
        };

        enumerateDevices();

        return () => {
            signalingService.off('participant', handleSignalingEvent);
            cleanup();
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [participantId, cleanup]);

    // Set up video element with local stream
    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
            setCurrentStream(localStream);
            console.log('Participant local stream set to video element');
        }
    }, [localStream]);

    const switchDevice = async (videoDeviceId?: string, audioDeviceId?: string) => {
        try {
            // Stop current stream
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }

            // Get new stream with specified devices
            const constraints: MediaStreamConstraints = {
                video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
                audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setCurrentStream(stream);
            console.log('Switched device successfully');
        } catch (err) {
            console.error('Error switching device:', err);
            alert('Failed to switch device. Please try again.');
        }
    };

    const handleAcceptSuggestion = async () => {
        if (!deviceSuggestion) return;

        try {
            const device = devices.find(d => d.deviceId === deviceSuggestion.deviceId);
            if (!device) return;

            if (device.kind === 'videoinput') {
                await switchDevice(deviceSuggestion.deviceId, undefined);
                setSelectedCamera(deviceSuggestion.deviceId);
            } else if (device.kind === 'audioinput') {
                await switchDevice(undefined, deviceSuggestion.deviceId);
                setSelectedMic(deviceSuggestion.deviceId);
            }

            setDeviceSuggestion(null);
        } catch (err) {
            console.error('Error accepting suggestion:', err);
            alert('Failed to switch device. Please try again.');
        }
    };

    const handleDeclineSuggestion = () => {
        setDeviceSuggestion(null);
    };

    const handleCameraChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        setSelectedCamera(deviceId);
        if (deviceId) {
            await switchDevice(deviceId, selectedMic || undefined);
        }
    };

    const handleMicChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        setSelectedMic(deviceId);
        if (deviceId) {
            await switchDevice(selectedCamera || undefined, deviceId);
        }
    };

    const toggleMute = () => {
        if (currentStream) {
            const audioTracks = currentStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
            console.log('Audio', isMuted ? 'unmuted' : 'muted');
        }
    };

    const videoDevices = devices.filter((d) => d.kind === 'videoinput');
    const audioDevices = devices.filter((d) => d.kind === 'audioinput');

    // Waiting state
    if (state === 'waiting') {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.spinner}></div>
                    <h2 className={styles.title}>Waiting for host...</h2>
                    <p className={styles.message}>
                        Please wait while the moderator reviews participants.
                    </p>
                </div>
            </div>
        );
    }

    // Inspection state
    if (state === 'inspecting') {
        return (
            <div className={styles.container}>
                <div className={styles.inspectionCard}>
                    <h2 className={styles.title}>Inspection in Progress</h2>
                    <p className={styles.message}>
                        The moderator is reviewing your audio and video quality.
                    </p>

                    <div className={styles.videoContainer}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={styles.video}
                        />
                        <div className={styles.videoLabel}>Your Video</div>

                        {/* Mute Button */}
                        <button
                            className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                {isMuted && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />}
                            </svg>
                        </button>
                    </div>

                    {/* Device Controls */}
                    <div className={styles.deviceControls}>
                        <div className={styles.deviceControl}>
                            <label className={styles.deviceLabel}>Camera:</label>
                            <select
                                className={styles.deviceSelect}
                                value={selectedCamera}
                                onChange={handleCameraChange}
                            >
                                <option value="">Default Camera</option>
                                {videoDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.deviceControl}>
                            <label className={styles.deviceLabel}>Microphone:</label>
                            <select
                                className={styles.deviceSelect}
                                value={selectedMic}
                                onChange={handleMicChange}
                            >
                                <option value="">Default Microphone</option>
                                {audioDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <p className={styles.hint}>
                        Please ensure your camera and microphone are working properly.
                    </p>

                    {/* Device Suggestion Modal */}
                    {deviceSuggestion && (
                        <div className={styles.modal}>
                            <div className={styles.modalContent}>
                                <h3 className={styles.modalTitle}>Device Change Suggested</h3>
                                <p className={styles.modalMessage}>
                                    The moderator suggests switching to:
                                    <br />
                                    <strong>{deviceSuggestion.deviceLabel}</strong>
                                </p>
                                <div className={styles.modalActions}>
                                    <button
                                        className="ds-button ds-button-primary"
                                        onClick={handleAcceptSuggestion}
                                    >
                                        Allow
                                    </button>
                                    <button
                                        className="ds-button ds-button-secondary"
                                        onClick={handleDeclineSuggestion}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Admitted state
    if (state === 'admitted') {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.successIcon}>✓</div>
                    <h2 className={styles.title}>Admitted!</h2>
                    <p className={styles.message}>Joining meeting...</p>
                </div>
            </div>
        );
    }

    // Removed state
    if (state === 'removed') {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.errorIcon}>✕</div>
                    <h2 className={styles.title}>Access Denied</h2>
                    <p className={styles.message}>
                        The moderator has removed you from the waiting room.
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
