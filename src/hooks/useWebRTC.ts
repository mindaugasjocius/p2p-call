import { useState, useEffect, useRef, useCallback } from 'react';
import signalingService from '../services/SignalingService';

interface UseWebRTCResult {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    createOffer: (remoteSocketId: string) => Promise<void>;
    createAnswer: (remoteSocketId: string, offer: RTCSessionDescriptionInit) => Promise<void>;
    replaceTrack: (newTrack: MediaStreamTrack, kind: 'audio' | 'video') => Promise<void>;
    cleanup: () => void;
}

// INTEGRATION POINT: Configure your STUN/TURN servers here.
// For production, you should use a TURN server to handle restrictive firewalls.
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export function useWebRTC(receiveOnly: boolean = false): UseWebRTCResult {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const remoteSocketIdRef = useRef<string | null>(null);

    // Initialize peer connection
    const initializePeerConnection = useCallback(() => {
        if (peerConnection.current) {
            return peerConnection.current;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnection.current = pc;

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && remoteSocketIdRef.current) {
                console.log('Sending ICE candidate');
                signalingService.sendIceCandidate(remoteSocketIdRef.current, event.candidate);
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('Received remote track:', {
                kind: event.track.kind,
                enabled: event.track.enabled,
                muted: event.track.muted,
                readyState: event.track.readyState,
                streamId: event.streams[0]?.id,
            });
            setRemoteStream(event.streams[0]);
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);

            // Clean up remote stream if connection fails or closes
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
                console.log('Connection lost, cleaning up remote stream');
                setRemoteStream(null);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState);

            // Additional disconnect detection via ICE state
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                console.log('ICE connection lost');
            }
        };

        return pc;
    }, []);

    // Get local media stream (skip for receive-only mode like moderator)
    useEffect(() => {
        if (receiveOnly) {
            console.log('Receive-only mode: skipping getUserMedia');
            return;
        }

        const getLocalStream = async () => {
            try {
                console.log('Enumerating devices...');
                // First, enumerate devices to get actual device IDs
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                const audioDevices = devices.filter(d => d.kind === 'audioinput');

                console.log('Found devices:', {
                    video: videoDevices.length,
                    audio: audioDevices.length
                });

                // Use first available device instead of default
                const constraints: MediaStreamConstraints = {
                    video: videoDevices.length > 0 ? { deviceId: videoDevices[0].deviceId } : true,
                    audio: audioDevices.length > 0 ? { deviceId: audioDevices[0].deviceId } : true,
                };

                console.log('Requesting getUserMedia with constraints:', constraints);
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                setLocalStream(stream);
                console.log('Got local stream:', {
                    id: stream.id,
                    videoTracks: stream.getVideoTracks().length,
                    audioTracks: stream.getAudioTracks().length,
                    videoEnabled: stream.getVideoTracks()[0]?.enabled,
                    audioEnabled: stream.getAudioTracks()[0]?.enabled,
                });
            } catch (err) {
                console.error('Error getting local stream:', err);
            }
        };

        getLocalStream();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [receiveOnly]);


    // Note: Tracks are added when creating offer/answer, not automatically

    // Listen for WebRTC signaling events
    useEffect(() => {
        const handleOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            console.log('Received offer from:', from);
            remoteSocketIdRef.current = from;

            // Reuse existing peer connection or create new one
            let pc = peerConnection.current;
            if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                pc = initializePeerConnection();
            }

            // Add local stream if available and not already added
            if (localStream && pc.getSenders().length === 0) {
                localStream.getTracks().forEach((track) => {
                    pc!.addTrack(track, localStream);
                    console.log('Added track to peer connection:', track.kind);
                });
            }

            // Only set remote description if we're in the right state
            if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                signalingService.sendAnswer(from, answer);
                console.log('Sent answer');
            } else {
                console.warn('Cannot handle offer in state:', pc.signalingState);
            }
        };

        const handleAnswer = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            console.log('Received answer from:', from);
            if (peerConnection.current) {
                try {
                    // Only set remote description if we're expecting an answer
                    if (peerConnection.current.signalingState === 'have-local-offer') {
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                        console.log('Remote description set successfully');
                    } else {
                        console.warn('Cannot handle answer in state:', peerConnection.current.signalingState);
                    }
                } catch (err) {
                    console.error('Error setting remote description:', err);
                }
            }
        };

        const handleIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidate }) => {
            console.log('Received ICE candidate from:', from);
            if (peerConnection.current && candidate) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('Error adding ICE candidate:', err);
                }
            }
        };

        signalingService.onWebRTCOffer(handleOffer);
        signalingService.onWebRTCAnswer(handleAnswer);
        signalingService.onWebRTCIceCandidate(handleIceCandidate);

        return () => {
            // Cleanup handled by cleanup function
        };
    }, [localStream, initializePeerConnection]);

    // Create offer (moderator initiates)
    const createOffer = useCallback(async (remoteSocketId: string) => {
        console.log('Creating offer for:', remoteSocketId);
        remoteSocketIdRef.current = remoteSocketId;

        const pc = initializePeerConnection();

        // Add local stream
        if (localStream) {
            localStream.getTracks().forEach((track) => {
                pc.addTrack(track, localStream);
            });
        }

        const offerOptions: RTCOfferOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        };
        const offer = await pc.createOffer(offerOptions);
        await pc.setLocalDescription(offer);

        signalingService.sendOffer(remoteSocketId, offer);
        console.log('Sent offer');
    }, [localStream, initializePeerConnection]);

    // Create answer (participant responds)
    const createAnswer = useCallback(async (remoteSocketId: string, offer: RTCSessionDescriptionInit) => {
        console.log('Creating answer for:', remoteSocketId);
        remoteSocketIdRef.current = remoteSocketId;

        const pc = initializePeerConnection();

        // Add local stream
        if (localStream) {
            localStream.getTracks().forEach((track) => {
                pc.addTrack(track, localStream);
            });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        signalingService.sendAnswer(remoteSocketId, answer);
        console.log('Sent answer');
    }, [localStream, initializePeerConnection]);

    // Cleanup
    const cleanup = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }
        setRemoteStream(null);
    }, [localStream]);

    // Replace track (for device switching)
    const replaceTrack = useCallback(async (newTrack: MediaStreamTrack, kind: 'audio' | 'video') => {
        if (!peerConnection.current) {
            console.warn('No peer connection to replace track');
            return;
        }

        const senders = peerConnection.current.getSenders();
        const sender = senders.find(s => s.track?.kind === kind);

        if (sender) {
            await sender.replaceTrack(newTrack);
            console.log(`Replaced ${kind} track successfully`);
        } else {
            console.warn(`No ${kind} sender found to replace track`);
        }
    }, []);

    return {
        localStream,
        remoteStream,
        createOffer,
        createAnswer,
        replaceTrack,
        cleanup,
    };
}
