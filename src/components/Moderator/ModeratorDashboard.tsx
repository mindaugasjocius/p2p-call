import { useState, useEffect } from 'react';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import signalingService from '../../services/SignalingService';
import type { Participant, SignalingEvent } from '../../types';
import styles from './ModeratorDashboard.module.css';

interface ModeratorDashboardProps {
    onSelectParticipant: (participantId: string) => void;
}

export function ModeratorDashboard({ onSelectParticipant }: ModeratorDashboardProps) {
    const [queue, setQueue] = useState<Participant[]>([]);
    const { announce } = useAnnouncer();

    useEffect(() => {
        // Connect as moderator once
        signalingService.connectAsModerator();

        // Fetch initial queue
        const loadQueue = async () => {
            const participants = await signalingService.getQueue();
            setQueue(participants);
            console.log('Queue loaded:', participants.length, 'participants');
        };

        // Refresh queue (for polling, doesn't reconnect)
        const refreshQueue = async () => {
            const participants = await signalingService.requestQueue();
            setQueue(participants);
            if (participants.length > 0) {
                announce(`${participants.length} participant${participants.length === 1 ? '' : 's'} waiting in queue`);
            }
        };

        loadQueue();

        // Poll for updates every 5 seconds as backup (only if events fail)
        const pollInterval = setInterval(() => {
            refreshQueue();
        }, 5000);

        // Listen for queue updates - just update state directly, don't refetch
        const handleSignalingEvent = (event: SignalingEvent) => {
            console.log('Moderator dashboard received event:', event.type);
            if (event.type === 'queueUpdated' || event.type === 'participantJoined') {
                // Reload queue on real events
                refreshQueue();
            }
        };

        signalingService.on('moderator', handleSignalingEvent);

        return () => {
            clearInterval(pollInterval);
            signalingService.off('moderator', handleSignalingEvent);
        };
    }, [announce]);

    // Keyboard navigation handler
    const handleKeyDown = (e: React.KeyboardEvent, participantId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectParticipant(participantId);
        }
    };

    return (
        <div className={styles.container}>
            <main className={styles.dashboard} role="main" aria-label="Moderator dashboard">
                <header className={styles.header}>
                    <h1 className="ds-heading">Moderator Dashboard</h1>
                    <p className="ds-text">Select a participant to begin inspection</p>
                </header>

                <section className={styles.queueContainer} aria-labelledby="queue-heading">
                    <h2 id="queue-heading" className={styles.queueTitle}>Waiting Room ({queue.length})</h2>

                    {queue.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p className="ds-text">No participants waiting</p>
                        </div>
                    ) : (
                        <ul role="list" aria-label="Participant queue" className={styles.participantList}>
                            {queue.map((participant) => (
                                <li key={participant.id} role="listitem">
                                    <div
                                        className={styles.participantCard}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelectParticipant(participant.id)}
                                        onKeyDown={(e) => handleKeyDown(e, participant.id)}
                                        aria-label={`Inspect ${participant.name}, ${participant.browser} on ${participant.os}`}
                                    >
                                        <div className={styles.participantInfo}>
                                            <h3 className={styles.participantName}>{participant.name}</h3>
                                            <div className={styles.participantDetails}>
                                                <span className={styles.detail}>
                                                    <strong>Browser:</strong> {participant.browser}
                                                </span>
                                                <span className={styles.detail}>
                                                    <strong>OS:</strong> {participant.os}
                                                </span>
                                                <span className={styles.detail}>
                                                    <strong>Device:</strong> {participant.deviceType}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            className="ds-button ds-button-primary"
                                            aria-label={`Inspect ${participant.name}`}
                                            tabIndex={-1}
                                        >
                                            Inspect
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}
