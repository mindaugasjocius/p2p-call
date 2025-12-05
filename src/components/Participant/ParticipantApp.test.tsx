import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipantApp } from './ParticipantApp';
import signalingService from '../../services/SignalingService';

// Mock dependencies
vi.mock('../../services/SignalingService', () => ({
    default: {
        on: vi.fn(),
        off: vi.fn(),
        joinAsParticipant: vi.fn(),
        shareDevices: vi.fn(),
        sendParticipantInfo: vi.fn(),
        sendMuteStatus: vi.fn(),
    }
}));

vi.mock('../../hooks/useWebRTC', () => ({
    useWebRTC: vi.fn(() => ({
        localStream: {
            id: 'local-stream',
            getTracks: () => [],
            getAudioTracks: () => [{ enabled: true }],
            getVideoTracks: () => [{ enabled: true }],
        },
        remoteStream: null,
        createOffer: vi.fn(),
        createAnswer: vi.fn(),
        replaceTrack: vi.fn(),
        updateLocalStream: vi.fn(),
        cleanup: vi.fn(),
    }))
}));

describe('ParticipantApp', () => {
    const defaultProps = {
        participantId: 'p1',
        participantName: 'Test User',
        userAgentInfo: {
            browser: 'Chrome',
            os: 'Mac',
            deviceType: 'Desktop'
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock navigator.mediaDevices
        Object.defineProperty(window.navigator, 'mediaDevices', {
            value: {
                enumerateDevices: vi.fn().mockResolvedValue([
                    { deviceId: 'cam1', kind: 'videoinput', label: 'Camera 1' },
                    { deviceId: 'mic1', kind: 'audioinput', label: 'Mic 1' }
                ]),
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: () => [],
                }),
            },
            writable: true
        });
    });

    it('should render waiting state initially', () => {
        render(<ParticipantApp {...defaultProps} />);
        expect(screen.getByText(/Waiting for host/i)).toBeInTheDocument();
    });

    it('should join queue when local stream is ready', async () => {
        render(<ParticipantApp {...defaultProps} />);

        await waitFor(() => {
            expect(signalingService.joinAsParticipant).toHaveBeenCalledWith(expect.objectContaining({
                id: 'p1',
                name: 'Test User'
            }));
        });
    });

    it('should transition to inspecting state on inspectionStarted event', async () => {
        render(<ParticipantApp {...defaultProps} />);

        // Simulate event
        const signalingHandler = (signalingService.on as any).mock.calls.find((call: any) => call[0] === 'participant')[1];

        act(() => {
            signalingHandler({
                type: 'inspectionStarted',
                moderatorSocketId: 'mod1'
            });
        });

        expect(await screen.findByText(/Inspection in progress/i)).toBeInTheDocument();
        expect(signalingService.sendParticipantInfo).toHaveBeenCalled();
    });
});
