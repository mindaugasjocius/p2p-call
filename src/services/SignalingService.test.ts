import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import signalingService from './SignalingService';
import { io } from 'socket.io-client';

vi.mock('socket.io-client');

describe('SignalingService', () => {
    let mockSocket: any;

    beforeEach(() => {
        // Reset singleton instance if possible, or just reconnect
        // Since it's a singleton, we might need to handle state carefully

        mockSocket = {
            on: vi.fn(),
            emit: vi.fn(),
            connected: false,
            id: 'mock-socket-id',
            connect: vi.fn(),
            disconnect: vi.fn(),
            off: vi.fn(),
        };
        (io as any).mockReturnValue(mockSocket);
    });

    afterEach(() => {
        vi.clearAllMocks();
        signalingService.disconnect();
    });

    it('should connect to the server', async () => {
        const connectPromise = signalingService.connect();

        // Verify io was called
        expect(io).toHaveBeenCalled();

        // Simulate 'connect' event
        const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
        expect(connectHandler).toBeDefined();
        connectHandler();

        await connectPromise;
        expect(signalingService.getSocketId()).toBe('mock-socket-id');
    });

    it('should join as participant', async () => {
        const p = signalingService.connect();
        const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
        connectHandler();
        await p;

        const participant = {
            id: 'p1',
            name: 'Test User',
            browser: 'Chrome',
            os: 'Mac',
            deviceType: 'Desktop'
        };

        signalingService.joinAsParticipant(participant);
        expect(mockSocket.emit).toHaveBeenCalledWith('participant:join', participant);
    });

    it('should emit local events when socket events are received', async () => {
        const p = signalingService.connect();
        const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
        connectHandler();
        await p;

        const listener = vi.fn();
        signalingService.on('moderator', listener);

        // Find the 'participant:joined' handler registered on the socket
        // Note: setupListeners is called inside connect()
        const joinHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'participant:joined')[1];
        expect(joinHandler).toBeDefined();

        const mockParticipant = { id: 'p2', name: 'New User' };
        joinHandler(mockParticipant);

        expect(listener).toHaveBeenCalledWith({
            type: 'participantJoined',
            participantId: 'p2'
        });
    });

    it('should send mute status', async () => {
        const p = signalingService.connect();
        const connectHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
        connectHandler();
        await p;

        signalingService.sendMuteStatus('mod-id', true);
        expect(mockSocket.emit).toHaveBeenCalledWith('mute:status', { to: 'mod-id', isMuted: true });
    });
});
