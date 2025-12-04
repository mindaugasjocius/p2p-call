import type { Participant, SignalingEvent } from '../types';

type EventListener = (event: SignalingEvent) => void;

const STORAGE_KEY = 'p2p-participants';
const EVENT_KEY = 'p2p-event';

class MockSignalingService {
    private static instance: MockSignalingService;
    private listeners: Map<string, EventListener[]> = new Map();

    private constructor() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', this.handleStorageChange.bind(this));

        // Initialize storage if empty
        if (!localStorage.getItem(STORAGE_KEY)) {
            this.saveParticipants([]);
        }
    }

    static getInstance(): MockSignalingService {
        if (!MockSignalingService.instance) {
            MockSignalingService.instance = new MockSignalingService();
        }
        return MockSignalingService.instance;
    }

    private handleStorageChange(e: StorageEvent) {
        // Handle events from other tabs
        if (e.key === EVENT_KEY && e.newValue) {
            try {
                const event: SignalingEvent = JSON.parse(e.newValue);
                this.emitLocal(event.participantId || 'moderator', event);
            } catch (err) {
                console.error('Error parsing storage event:', err);
            }
        }
    }

    private getParticipants(): Participant[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (err) {
            console.error('Error reading participants:', err);
            return [];
        }
    }

    private saveParticipants(participants: Participant[]) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
        } catch (err) {
            console.error('Error saving participants:', err);
        }
    }

    private broadcastEvent(event: SignalingEvent) {
        // Broadcast to other tabs via localStorage
        try {
            localStorage.setItem(EVENT_KEY, JSON.stringify(event));
            // Clear it immediately so the same event can be sent again
            localStorage.removeItem(EVENT_KEY);
        } catch (err) {
            console.error('Error broadcasting event:', err);
        }

        // Also emit locally
        this.emitLocal(event.participantId || 'moderator', event);
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

    private emitLocal(participantId: string, event: SignalingEvent) {
        const listeners = this.listeners.get(participantId);
        if (listeners) {
            listeners.forEach((listener) => listener(event));
        }
        // Also emit to 'moderator' listener for dashboard updates
        if (participantId !== 'moderator') {
            const moderatorListeners = this.listeners.get('moderator');
            if (moderatorListeners) {
                moderatorListeners.forEach((listener) => listener(event));
            }
        }
    }

    // Queue management
    getQueue(): Participant[] {
        return this.getParticipants().filter((p) => p.status === 'waiting');
    }

    getParticipant(id: string): Participant | undefined {
        return this.getParticipants().find((p) => p.id === id);
    }

    getNextInQueue(): Participant | null {
        const waiting = this.getQueue();
        return waiting.length > 0 ? waiting[0] : null;
    }

    // P2P Connection
    connectP2P(participantId: string): boolean {
        const participants = this.getParticipants();
        const participant = participants.find((p) => p.id === participantId);

        if (!participant || participant.status !== 'waiting') {
            return false;
        }

        participant.status = 'inspecting';
        this.saveParticipants(participants);

        // Notify participant
        this.broadcastEvent({
            type: 'inspectionStarted',
            participantId,
        });

        return true;
    }

    // Moderator actions
    admitUser(participantId: string): Participant | null {
        const participants = this.getParticipants();
        const participant = participants.find((p) => p.id === participantId);

        if (!participant) return null;

        participant.status = 'admitted';
        this.saveParticipants(participants);

        // Notify participant
        this.broadcastEvent({
            type: 'admitted',
            participantId,
        });

        // Get next participant for auto-advance
        const next = this.getNextInQueue();

        // Emit queue update
        this.broadcastEvent({
            type: 'queueUpdated',
            nextParticipantId: next?.id,
        });

        return next;
    }

    removeUser(participantId: string): Participant | null {
        const participants = this.getParticipants();
        const participant = participants.find((p) => p.id === participantId);

        if (!participant) return null;

        participant.status = 'removed';
        this.saveParticipants(participants);

        // Notify participant
        this.broadcastEvent({
            type: 'removed',
            participantId,
        });

        // Get next participant for auto-advance
        const next = this.getNextInQueue();

        // Emit queue update
        this.broadcastEvent({
            type: 'queueUpdated',
            nextParticipantId: next?.id,
        });

        return next;
    }

    cancelInspection(participantId: string): void {
        const participants = this.getParticipants();
        const participant = participants.find((p) => p.id === participantId);

        if (!participant) return;

        participant.status = 'waiting';
        this.saveParticipants(participants);

        // Notify participant
        this.broadcastEvent({
            type: 'cancelled',
            participantId,
        });

        // Emit queue update
        this.broadcastEvent({
            type: 'queueUpdated',
        });
    }

    suggestDeviceChange(participantId: string, deviceId: string, deviceLabel: string): void {
        // Notify participant
        this.broadcastEvent({
            type: 'deviceSuggestion',
            participantId,
            deviceId,
            deviceLabel,
        });
    }

    // Add a new participant
    addParticipant(participant: Omit<Participant, 'status'>): void {
        const participants = this.getParticipants();
        participants.push({ ...participant, status: 'waiting' });
        this.saveParticipants(participants);

        this.broadcastEvent({
            type: 'participantJoined',
            participantId: participant.id,
        });
    }
}

export default MockSignalingService.getInstance();
