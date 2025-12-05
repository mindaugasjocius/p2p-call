import { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import signalingService from '../../services/SignalingService';
import type { SignalingEvent } from '../../types';
import styles from './ParticipantApp.module.css';

interface ParticipantAppProps {
    /**
     * INTEGRATION POINT: This ID should come from your authentication system or URL parameters.
     * It identifies the user to the signaling server.
     */
    participantId: string;
    participantName: string;
    userAgentInfo: {
        browser: string;
        os: string;
        deviceType: string;
    };
}

type ParticipantState = 'waiting' | 'inspecting' | 'admitted' | 'removed';

export function ParticipantApp({ participantId, participantName, userAgentInfo }: ParticipantAppProps) {
    const [state, setState] = useState<ParticipantState>('waiting');
    const [deviceSuggestion, setDeviceSuggestion] = useState<{
        deviceId: string;
        deviceLabel: string;
    } | null>(null);
    const { localStream, cleanup, replaceTrack, updateLocalStream } = useWebRTC();
    const { announce } = useAnnouncer();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [moderatorSocketId, setModeratorSocketId] = useState<string | null>(null);
    const [hasJoined, setHasJoined] = useState<boolean>(false);

    // Signaling effect - re-runs when dependencies change
    useEffect(() => {
        // Listen for signaling events
        const handleSignalingEvent = (event: SignalingEvent) => {
            console.log('Participant received event:', event);

            switch (event.type) {
                case 'inspectionStarted':
                    if (event.moderatorSocketId) {
                        setModeratorSocketId(event.moderatorSocketId);
                        setState('inspecting');

                        // Share devices with moderator
                        if (devices.length > 0) {
                            signalingService.shareDevices(event.moderatorSocketId, devices);
                        }

                        // Share User Agent
                        signalingService.sendParticipantInfo(event.moderatorSocketId, {
                            userInfo: userAgentInfo
                        });
                    }
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
                case 'muteRequest':
                    // Moderator requested mute/unmute
                    if (currentStream) {
                        const audioTrack = currentStream.getAudioTracks()[0];
                        if (audioTrack) {
                            const shouldMute = event.mute ?? !isMuted;
                            audioTrack.enabled = !shouldMute;
                            setIsMuted(shouldMute);

                            // Also mute local stream track if different
                            if (localStream && localStream !== currentStream) {
                                const localAudio = localStream.getAudioTracks()[0];
                                if (localAudio) localAudio.enabled = !shouldMute;
                            }

                            // Ack back to moderator
                            if (event.moderatorSocketId || moderatorSocketId) {
                                signalingService.sendMuteStatus(event.moderatorSocketId || moderatorSocketId!, shouldMute);
                            }
                        }
                    }
                    break;
            }
        };

        signalingService.on('participant', handleSignalingEvent);

        return () => {
            signalingService.off('participant', handleSignalingEvent);
        };
    }, [participantId, devices, cleanup, localStream, currentStream, isMuted, moderatorSocketId, userAgentInfo]);

    // Announce state changes to screen readers
    useEffect(() => {
        switch (state) {
            case 'waiting':
                announce('Waiting for host to start inspection');
                break;
            case 'inspecting':
                announce('Inspection in progress. The moderator is reviewing your audio and video quality.');
                break;
            case 'admitted':
                announce('You have been admitted to the session');
                break;
            case 'removed':
                announce('You have been removed from the queue');
                break;
        }
    }, [state, announce]);

    // Join queue ONLY when local stream is ready
    useEffect(() => {
        if (localStream && !hasJoined) {
            console.log('Local stream ready, joining queue...');
            signalingService.joinAsParticipant({
                id: participantId,
                name: participantName,
                ...userAgentInfo
            });
            setHasJoined(true);
        }
    }, [localStream, hasJoined, participantId, participantName, userAgentInfo]);

    // Cleanup effect - runs only on mount/unmount
    useEffect(() => {
        return () => {
            console.log('ParticipantApp unmounting, cleaning up');
            cleanup();
        };
    }, []);

    // Enumerate devices AFTER permission is granted (when localStream is available)
    useEffect(() => {
        const enumerateDevices = async () => {
            if (!localStream) return; // Wait for permission

            try {
                const deviceList = await navigator.mediaDevices.enumerateDevices();
                const filteredDevices = deviceList.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput');
                setDevices(filteredDevices);

                // Set initial selection if empty
                if (!selectedCamera) {
                    const cam = filteredDevices.find(d => d.kind === 'videoinput');
                    if (cam) setSelectedCamera(cam.deviceId);
                }
                if (!selectedMic) {
                    const mic = filteredDevices.find(d => d.kind === 'audioinput');
                    if (mic) setSelectedMic(mic.deviceId);
                }

                console.log('Enumerated devices after permission:', filteredDevices.length);
            } catch (err) {
                console.error('Error enumerating devices:', err);
            }
        };

        enumerateDevices();
    }, [localStream]);

    // Set up video element with stream (either local or current)
    // Set up video element with stream (either local or current)
    useEffect(() => {
        const stream = currentStream || localStream;
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            console.log('Participant video element updated with stream. State:', state);
        }
        // Initialize currentStream with localStream if not set
        if (localStream && !currentStream) {
            setCurrentStream(localStream);
        }
    }, [localStream, currentStream, state]);

    const switchDevice = async (videoDeviceId?: string, audioDeviceId?: string) => {
        console.log('Switching device...', { videoDeviceId, audioDeviceId });

        // Use provided ID, or fallback to currently selected ID to preserve non-switched device
        const targetVideoId = videoDeviceId ?? selectedCamera;
        const targetAudioId = audioDeviceId ?? selectedMic;

        try {
            // Get new stream with specified devices
            const constraints: MediaStreamConstraints = {
                video: targetVideoId ? { deviceId: { exact: targetVideoId } } : true,
                audio: targetAudioId ? { deviceId: { exact: targetAudioId } } : true,
            };

            console.log('Requesting new stream with constraints:', constraints);
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Got new stream:', newStream.id);

            // Replace tracks in the peer connection (if active)
            const videoTrack = newStream.getVideoTracks()[0];
            const audioTrack = newStream.getAudioTracks()[0];

            // Always replace tracks if we got new ones, regardless of which device changed
            if (videoTrack) {
                console.log('Replacing video track:', videoTrack.id);
                await replaceTrack(videoTrack, 'video');
            }
            if (audioTrack) {
                console.log('Replacing audio track:', audioTrack.id);
                await replaceTrack(audioTrack, 'audio');
            }

            // Stop old stream tracks
            if (currentStream) {
                console.log('Stopping old stream tracks:', currentStream.id);
                currentStream.getTracks().forEach(track => track.stop());
            }

            // Update video element
            if (videoRef.current) {
                console.log('Updating video element srcObject to new stream');
                videoRef.current.srcObject = newStream;
            }

            setCurrentStream(newStream);
            updateLocalStream(newStream);
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
        const stream = currentStream || localStream;
        if (stream) {
            const audioTracks = stream.getAudioTracks();
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
                            aria-label="Your video preview"
                        />
                        <div className={styles.videoLabel}>Your Video</div>

                        {/* Mute Button */}
                        <button
                            onClick={toggleMute}
                            className={`${styles.controlButton} ${isMuted ? styles.muted : ''}`}
                            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                            aria-pressed={isMuted}
                        >
                            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
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
                                aria-label="Select camera"
                            >
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
                                aria-label="Select microphone"
                            >
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
                        <div
                            className={styles.modal}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="suggestion-title"
                            aria-describedby="suggestion-description"
                        >
                            <div className={styles.modalContent}>
                                <h3 id="suggestion-title" className={styles.modalTitle}>Device Change Suggested</h3>
                                <p id="suggestion-description" className={styles.modalMessage}>
                                    The moderator suggests switching to:
                                    <br />
                                    <strong>{deviceSuggestion.deviceLabel}</strong>
                                </p>
                                <div className={styles.modalActions}>
                                    <button
                                        className="ds-button ds-button-primary"
                                        onClick={handleAcceptSuggestion}
                                        aria-label="Accept device suggestion"
                                    >
                                        Allow
                                    </button>
                                    <button
                                        className="ds-button ds-button-secondary"
                                        onClick={handleDeclineSuggestion}
                                        aria-label="Decline device suggestion"
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
