import { useState, useEffect } from 'react';
import signalingService from '../../services/SignalingService';
import type { Participant, SignalingEvent } from '../../types';
import styles from './ModeratorDashboard.module.css';

interface ModeratorDashboardProps {
    onSelectParticipant: (participantId: string) => void;
}

export function ModeratorDashboard({ onSelectParticipant }: ModeratorDashboardProps) {
    const [queue, setQueue] = useState<Participant[]>([]);

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
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.dashboard}>
                <header className={styles.header}>
                    <h1 className="ds-heading">Moderator Dashboard</h1>
                    <p className="ds-text">Select a participant to begin inspection</p>
                </header>

                <div className={styles.queueContainer}>
                    <h2 className={styles.queueTitle}>Waiting Room ({queue.length})</h2>

                    {queue.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p className="ds-text">No participants waiting</p>
                        </div>
                    ) : (
                        <div className={styles.participantList}>
                            {queue.map((participant) => (
                                <div
                                    key={participant.id}
                                    className={styles.participantCard}
                                    onClick={() => onSelectParticipant(participant.id)}
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
                                    <button className="ds-button ds-button-primary">
                                        Inspect
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
