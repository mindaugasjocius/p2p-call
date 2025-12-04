import { io, Socket } from 'socket.io-client';
import type { Participant, SignalingEvent } from '../types';

type EventListener = (event: SignalingEvent) => void;

const SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001';

class SignalingService {
    private static instance: SignalingService;
    private socket: Socket | null = null;
    private listeners: Map<string, EventListener[]> = new Map();
    private mySocketId: string | null = null;

    private constructor() {
        // Will connect when needed
    }

    static getInstance(): SignalingService {
        if (!SignalingService.instance) {
            SignalingService.instance = new SignalingService();
        }
        return SignalingService.instance;
    }

    connect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            this.socket = io(SERVER_URL, {
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Connected to signaling server');
                this.mySocketId = this.socket!.id || null;
                resolve();
            });

            this.setupListeners();
        });
    }

    private setupListeners() {
        if (!this.socket) return;

        // Participant events
        this.socket.on('participant:joined', (participant: Participant) => {
            this.emitLocal('moderator', {
                type: 'participantJoined',
                participantId: participant.id,
            });
        });

        this.socket.on('queue:update', () => {
            this.emitLocal('moderator', {
                type: 'queueUpdated',
            });
        });

        this.socket.on('queue:next', (nextParticipant: Participant | null) => {
            this.emitLocal('moderator', {
                type: 'queueUpdated',
                nextParticipantId: nextParticipant?.id,
            });
        });

        // Inspection events
        this.socket.on('inspection:started', ({ moderatorSocketId }: { moderatorSocketId: string }) => {
            this.emitLocal('participant', {
                type: 'inspectionStarted',
            });
            // Store moderator socket ID for WebRTC
            (this as any).moderatorSocketId = moderatorSocketId;
        });

        this.socket.on('inspection:cancelled', () => {
            this.emitLocal('participant', {
                type: 'cancelled',
            });
        });

        this.socket.on('inspection:ready', ({ participantSocketId }: { participantSocketId: string }) => {
            // Store participant socket ID for WebRTC
            (this as any).participantSocketId = participantSocketId;
            this.emitLocal('moderator', {
                type: 'inspectionReady',
                participantSocketId,
            });
        });

        this.socket.on('participant:admitted', () => {
            this.emitLocal('participant', {
                type: 'admitted',
            });
        });

        this.socket.on('participant:removed', () => {
            this.emitLocal('participant', {
                type: 'removed',
            });
        });

        // Device suggestion
        this.socket.on('device:suggestion', ({ deviceId, deviceLabel }: { deviceId: string; deviceLabel: string }) => {
            this.emitLocal('participant', {
                type: 'deviceSuggestion',
                deviceId,
                deviceLabel,
            });
        });
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    getMySocketId(): string | null {
        return this.mySocketId;
    }

    // Event emitter methods
    on(participantId: string, listener: EventListener) {
        if (!this.listeners.has(participantId)) {
            this.listeners.set(participantId, []);
        }
        this.listeners.get(participantId)!.push(listener);
    }

    off(participantId: string, listener: EventListener) {
        const listeners = this.listeners.get(participantId);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emitLocal(target: string, event: SignalingEvent) {
        const listeners = this.listeners.get(target);
        if (listeners) {
            listeners.forEach((listener) => listener(event));
        }
    }

    // Queue management (fetched from server)
    async getQueue(): Promise<Participant[]> {
        return new Promise((resolve) => {
            if (!this.socket) {
                resolve([]);
                return;
            }

            this.socket.once('queue:update', (participants: Participant[]) => {
                resolve(participants.filter((p) => p.status === 'waiting'));
            });

            // Request queue update
            this.socket.emit('moderator:connect');
        });
    }

    // Participant joins
    joinAsParticipant(participant: Omit<Participant, 'status'>): void {
        if (!this.socket) return;
        this.socket.emit('participant:join', participant);
    }

    // Moderator connects
    connectAsModerator(): void {
        if (!this.socket) return;
        this.socket.emit('moderator:connect');
    }

    // Start inspection
    startInspection(participantId: string): void {
        if (!this.socket) return;
        this.socket.emit('inspection:start', { participantId });
    }

    // Admit participant
    admitParticipant(participantId: string): void {
        if (!this.socket) return;
        this.socket.emit('participant:admit', { participantId });
    }

    // Remove participant
    removeParticipant(participantId: string): void {
        if (!this.socket) return;
        this.socket.emit('participant:remove', { participantId });
    }

    // Cancel inspection
    cancelInspection(participantId: string): void {
        if (!this.socket) return;
        this.socket.emit('inspection:cancel', { participantId });
    }

    // Suggest device change
    suggestDeviceChange(participantId: string, deviceId: string, deviceLabel: string): void {
        if (!this.socket) return;
        this.socket.emit('device:suggest', { participantId, deviceId, deviceLabel });
    }

    // WebRTC signaling
    sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
        if (!this.socket) return;
        this.socket.emit('webrtc:offer', { to, offer });
    }

    sendAnswer(to: string, answer: RTCSessionDescriptionInit): void {
        if (!this.socket) return;
        this.socket.emit('webrtc:answer', { to, answer });
    }

    sendIceCandidate(to: string, candidate: RTCIceCandidate): void {
        if (!this.socket) return;
        this.socket.emit('webrtc:ice-candidate', { to, candidate });
    }

    // Listen for WebRTC events
    onWebRTCOffer(callback: (data: { from: string; offer: RTCSessionDescriptionInit }) => void): void {
        if (!this.socket) return;
        this.socket.on('webrtc:offer', callback);
    }

    onWebRTCAnswer(callback: (data: { from: string; answer: RTCSessionDescriptionInit }) => void): void {
        if (!this.socket) return;
        this.socket.on('webrtc:answer', callback);
    }

    onWebRTCIceCandidate(callback: (data: { from: string; candidate: RTCIceCandidate }) => void): void {
        if (!this.socket) return;
        this.socket.on('webrtc:ice-candidate', callback);
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.mySocketId = null;
        }
    }
}

export default SignalingService.getInstance();
