import { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';
import signalingService from '../../services/SignalingService';
import type { Participant, SignalingEvent } from '../../types';
import styles from './InspectionConsole.module.css';

interface InspectionConsoleProps {
    participantId: string;
    onBack: () => void;
    onAutoAdvance: (nextParticipantId: string) => void;
}

export function InspectionConsole({
    participantId,
    onBack,
    onAutoAdvance,
}: InspectionConsoleProps) {
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [userInfo, setUserInfo] = useState<{
        browser: string;
        os: string;
        deviceType: string;
    } | null>(null);
    // Use receive-only mode for moderator (don't request camera/mic)
    const { remoteStream, createOffer, cleanup } = useWebRTC(true);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [isParticipantMuted, setIsParticipantMuted] = useState<boolean>(false);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [participantSocketId, setParticipantSocketId] = useState<string | null>(null);

    useEffect(() => {
        // Get participant info from server
        // Get participant info from server
        const loadParticipant = async () => {
            setParticipant({
                id: participantId,
                name: 'Participant',
                status: 'inspecting',
            });
        };

        loadParticipant();

        // Start inspection
        signalingService.startInspection(participantId);

        // Listen for inspection ready event and disconnects
        const handleSignalingEvent = (event: SignalingEvent) => {
            if (event.type === 'inspectionReady' && event.participantSocketId) {
                console.log('Inspection ready, creating offer to:', event.participantSocketId);
                setParticipantSocketId(event.participantSocketId);
                // Create WebRTC offer to participant
                createOffer(event.participantSocketId);
            }

            // Receive participant's device list
            if (event.type === 'devicesReceived' && event.devices) {
                console.log('Received participant devices:', event.devices);
                setDevices(event.devices);

                // Auto-select first camera and microphone
                const firstCamera = event.devices.find((d: any) => d.kind === 'videoinput');
                const firstMic = event.devices.find((d: any) => d.kind === 'audioinput');

                if (firstCamera) setSelectedCamera(firstCamera.deviceId);
                if (firstMic) setSelectedMic(firstMic.deviceId);
            }

            // Receive participant info (UA)
            if (event.type === 'participantInfo' && event.userInfo) {
                setUserInfo(event.userInfo);
            }

            // Receive mute status
            if (event.type === 'muteStatus') {
                setIsParticipantMuted(!!event.isMuted);
            }

            // Handle participant disconnect
            if (event.type === 'queueUpdated') {
                // Check if current participant is still in queue
                // If not, they disconnected - go back to dashboard
                console.log('Queue updated during inspection, checking if participant disconnected');
            }
        };

        signalingService.on('moderator', handleSignalingEvent);

        return () => {
            signalingService.off('moderator', handleSignalingEvent);
            cleanup();
        };
    }, [participantId, createOffer, cleanup]);

    // Set up remote video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            console.log('Moderator: Remote stream set to video element');
        }
    }, [remoteStream]);

    // Handle participant disconnect
    useEffect(() => {
        // If remote stream is lost (participant disconnected), go back to dashboard
        if (remoteStream === null && remoteVideoRef.current?.srcObject) {
            console.log('Participant disconnected, returning to dashboard');
            setTimeout(() => {
                onBack();
            }, 2000); // Give 2 seconds to show "connection lost" message
        }
    }, [remoteStream, onBack]);

    const toggleParticipantMute = () => {
        if (participantSocketId) {
            const newMuted = !isParticipantMuted;
            signalingService.requestMute(participantSocketId, newMuted);
            setIsParticipantMuted(newMuted);
        }
    };

    const handleAdmit = async () => {
        signalingService.admitParticipant(participantId);

        // Listen for next participant
        const handleNext = (event: SignalingEvent) => {
            if (event.type === 'queueUpdated') {
                if (event.nextParticipantId) {
                    onAutoAdvance(event.nextParticipantId);
                } else {
                    onBack();
                }
                signalingService.off('moderator', handleNext);
            }
        };

        signalingService.on('moderator', handleNext);
    };

    const handleRemove = async () => {
        signalingService.removeParticipant(participantId);

        // Listen for next participant
        const handleNext = (event: SignalingEvent) => {
            if (event.type === 'queueUpdated') {
                if (event.nextParticipantId) {
                    onAutoAdvance(event.nextParticipantId);
                } else {
                    onBack();
                }
                signalingService.off('moderator', handleNext);
            }
        };

        signalingService.on('moderator', handleNext);
    };

    const handleCancel = () => {
        signalingService.cancelInspection(participantId);
        cleanup();
        onBack();
    };



    if (!participant) {
        return <div className={styles.loading}>Loading...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.console}>
                <header className={styles.header}>
                    <h1 className="ds-heading">Inspection Console</h1>
                    <button className="ds-button ds-button-secondary" onClick={handleCancel}>
                        Cancel
                    </button>
                </header>

                <div className={styles.content}>
                    {/* Video Feed */}
                    <div className={styles.videoSection}>
                        <div className={styles.videoContainer}>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className={styles.video}
                            />

                            {/* User Info Overlay */}
                            <div className={styles.userInfo}>
                                <h3 className={styles.participantName}>{participant.name}</h3>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <strong>Browser:</strong> {userInfo?.browser || 'Unknown'}
                                    </div>
                                    <div className={styles.infoItem}>
                                        <strong>OS:</strong> {userInfo?.os || 'Unknown'}
                                    </div>
                                    <div className={styles.infoItem}>
                                        <strong>Device:</strong> {userInfo?.deviceType || 'Desktop'}
                                    </div>
                                </div>
                            </div>

                            {/* Moderator Mute Button */}
                            <button
                                className={`${styles.muteButton} ${isParticipantMuted ? styles.muted : ''}`}
                                onClick={toggleParticipantMute}
                                title={isParticipantMuted ? 'Unmute Participant' : 'Mute Participant'}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                    {isParticipantMuted && <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />}
                                </svg>
                            </button>
                        </div>

                        {/* Controls */}
                        <div className={styles.controls}>
                            <button
                                className="ds-button ds-button-success"
                                onClick={handleAdmit}
                            >
                                ✓ Admit
                            </button>
                            <button
                                className="ds-button ds-button-danger"
                                onClick={handleRemove}
                            >
                                ✕ Remove
                            </button>
                        </div>
                    </div>

                    {/* Device Settings Panel */}
                    {devices.length > 0 && (
                        <div className={styles.devicePanel}>
                            <h2 className={styles.panelTitle}>Participant Devices</h2>

                            <div className={styles.deviceSection}>
                                <h3 className={styles.deviceTitle}>Camera</h3>
                                {devices.filter(d => d.kind === 'videoinput').length > 0 ? (
                                    <select
                                        className={styles.deviceSelect}
                                        value={selectedCamera}
                                        onChange={(e) => {
                                            const deviceId = e.target.value;
                                            setSelectedCamera(deviceId);
                                            if (deviceId) {
                                                const device = devices.find(d => d.deviceId === deviceId);
                                                if (device) {
                                                    signalingService.suggestDeviceChange(participantId, deviceId, device.label);
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Select camera to suggest...</option>
                                        {devices.filter(d => d.kind === 'videoinput').map((device) => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className={styles.noDevices}>No cameras detected</p>
                                )}
                            </div>

                            <div className={styles.deviceSection}>
                                <h3 className={styles.deviceTitle}>Microphone</h3>
                                {devices.filter(d => d.kind === 'audioinput').length > 0 ? (
                                    <select
                                        className={styles.deviceSelect}
                                        value={selectedMic}
                                        onChange={(e) => {
                                            const deviceId = e.target.value;
                                            setSelectedMic(deviceId);
                                            if (deviceId) {
                                                const device = devices.find(d => d.deviceId === deviceId);
                                                if (device) {
                                                    signalingService.suggestDeviceChange(participantId, deviceId, device.label);
                                                }
                                            }
                                        }}
                                    >
                                        <option value="">Select microphone to suggest...</option>
                                        {devices.filter(d => d.kind === 'audioinput').map((device) => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className={styles.noDevices}>No microphones detected</p>
                                )}
                            </div>

                            <div className={styles.panelInfo}>
                                <p className="ds-text">
                                    Select a device to suggest it to the participant.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
