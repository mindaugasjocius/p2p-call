import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebRTC } from './useWebRTC';
import signalingService from '../services/SignalingService';

vi.mock('../services/SignalingService', () => ({
    default: {
        on: vi.fn(),
        off: vi.fn(),
        sendAnswer: vi.fn(),
        sendIceCandidate: vi.fn(),
        sendOffer: vi.fn(),
    }
}));

describe('useWebRTC', () => {
    let mockPC: any;

    beforeEach(() => {
        // Mock RTCPeerConnection
        mockPC = {
            onicecandidate: null,
            ontrack: null,
            onconnectionstatechange: null,
            oniceconnectionstatechange: null,
            onsignalingstatechange: null,
            onnegotiationneeded: null,
            addTrack: vi.fn(),
            addTransceiver: vi.fn(),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            addIceCandidate: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            getTransceivers: vi.fn().mockReturnValue([]),
            getSenders: vi.fn().mockReturnValue([]),
            signalingState: 'stable',
            connectionState: 'new',
        };

        window.RTCPeerConnection = vi.fn(function () { return mockPC; }) as any;
        window.RTCSessionDescription = vi.fn(function (desc) { return desc; }) as any;
        window.RTCIceCandidate = vi.fn(function (cand) { return cand; }) as any;

        // Mock navigator.mediaDevices
        Object.defineProperty(window.navigator, 'mediaDevices', {
            value: {
                enumerateDevices: vi.fn().mockResolvedValue([]),
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: vi.fn().mockReturnValue([{ kind: 'audio', stop: vi.fn() }, { kind: 'video', stop: vi.fn() }]),
                    getVideoTracks: vi.fn().mockReturnValue([{ kind: 'video', enabled: true }]),
                    getAudioTracks: vi.fn().mockReturnValue([{ kind: 'audio', enabled: true }]),
                    id: 'mock-stream-id'
                }),
            },
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize peer connection', async () => {
        const { result } = renderHook(() => useWebRTC());

        await act(async () => {
            await result.current.createOffer('remote-id');
        });

        expect(window.RTCPeerConnection).toHaveBeenCalled();
    });

    it('should get local stream on mount', async () => {
        renderHook(() => useWebRTC());
        await waitFor(() => {
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
        });
    });

    it('should handle incoming offer', async () => {
        renderHook(() => useWebRTC());

        // Simulate 'webrtc' event from signaling service
        const signalingHandler = (signalingService.on as any).mock.calls.find((call: any) => call[0] === 'webrtc')[1];

        await act(async () => {
            signalingHandler({
                type: 'offer',
                from: 'remote-id',
                offer: { type: 'offer', sdp: 'remote-offer' }
            });
        });

        expect(mockPC.setRemoteDescription).toHaveBeenCalled();
        expect(mockPC.createAnswer).toHaveBeenCalled();
        expect(mockPC.setLocalDescription).toHaveBeenCalled();
        expect(signalingService.sendAnswer).toHaveBeenCalled();
    });
});
