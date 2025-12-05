import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// In-memory storage
const participants = new Map();
const moderators = new Set();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Participant joins waiting room
    socket.on('participant:join', (data) => {
        const { id, name, browser, os, deviceType } = data;

        participants.set(id, {
            id,
            name,
            browser,
            os,
            deviceType,
            status: 'waiting',
            socketId: socket.id
        });

        console.log(`Participant joined: ${name} (${id})`);

        // Notify all moderators
        moderators.forEach((modSocketId) => {
            io.to(modSocketId).emit('participant:joined', {
                id,
                name,
                browser,
                os,
                deviceType,
                status: 'waiting'
            });
        });

        // Send current queue to the participant
        socket.emit('queue:update', Array.from(participants.values()));
    });

    // Moderator connects
    socket.on('moderator:connect', () => {
        moderators.add(socket.id);
        console.log('Moderator connected:', socket.id);

        // Send current queue
        socket.emit('queue:update', Array.from(participants.values()));
    });

    // Request queue (without reconnecting)
    socket.on('queue:request', () => {
        // Just send queue, don't add to moderators again
        socket.emit('queue:update', Array.from(participants.values()));
    });

    // Start inspection
    socket.on('inspection:start', ({ participantId }) => {
        const participant = participants.get(participantId);
        if (participant) {
            participant.status = 'inspecting';

            // Notify participant
            io.to(participant.socketId).emit('inspection:started', {
                moderatorSocketId: socket.id
            });

            // Send participant socket ID to moderator
            socket.emit('inspection:ready', {
                participantSocketId: participant.socketId
            });

            console.log(`Inspection started for: ${participant.name}`);
        }
    });

    // WebRTC Signaling - Offer
    socket.on('webrtc:offer', ({ to, offer }) => {
        console.log('Relaying offer to:', to);
        io.to(to).emit('webrtc:offer', {
            from: socket.id,
            offer
        });
    });

    // WebRTC Signaling - Answer
    socket.on('webrtc:answer', ({ to, answer }) => {
        console.log('Relaying answer to:', to);
        io.to(to).emit('webrtc:answer', {
            from: socket.id,
            answer
        });
    });

    // WebRTC Signaling - ICE Candidate
    socket.on('webrtc:ice-candidate', ({ to, candidate }) => {
        console.log('Relaying ICE candidate to:', to);
        io.to(to).emit('webrtc:ice-candidate', {
            from: socket.id,
            candidate
        });
    });

    // Device list sharing (participant -> moderator)
    socket.on('devices:share', ({ to, devices }) => {
        console.log('Relaying device list to moderator:', to);
        io.to(to).emit('devices:list', {
            from: socket.id,
            devices,
        });
    });

    // Admit participant
    socket.on('participant:admit', ({ participantId }) => {
        const participant = participants.get(participantId);
        if (participant) {
            participant.status = 'admitted';

            // Notify participant
            io.to(participant.socketId).emit('participant:admitted');

            console.log(`Participant admitted: ${participant.name}`);

            // Get next in queue
            const waiting = Array.from(participants.values()).filter(p => p.status === 'waiting');
            const next = waiting.length > 0 ? waiting[0] : null;

            // Notify moderator
            socket.emit('queue:next', next);

            // Broadcast queue update
            moderators.forEach((modSocketId) => {
                io.to(modSocketId).emit('queue:update', Array.from(participants.values()));
            });
        }
    });

    // Remove participant
    socket.on('participant:remove', ({ participantId }) => {
        const participant = participants.get(participantId);
        if (participant) {
            participant.status = 'removed';

            // Notify participant
            io.to(participant.socketId).emit('participant:removed');

            console.log(`Participant removed: ${participant.name}`);

            // Get next in queue
            const waiting = Array.from(participants.values()).filter(p => p.status === 'waiting');
            const next = waiting.length > 0 ? waiting[0] : null;

            // Notify moderator
            socket.emit('queue:next', next);

            // Broadcast queue update
            moderators.forEach((modSocketId) => {
                io.to(modSocketId).emit('queue:update', Array.from(participants.values()));
            });
        }
    });

    // Cancel inspection
    socket.on('inspection:cancel', ({ participantId }) => {
        const participant = participants.get(participantId);
        if (participant) {
            participant.status = 'waiting';

            // Notify participant
            io.to(participant.socketId).emit('inspection:cancelled');

            console.log(`Inspection cancelled for: ${participant.name}`);

            // Broadcast queue update
            moderators.forEach((modSocketId) => {
                io.to(modSocketId).emit('queue:update', Array.from(participants.values()));
            });
        }
    });

    // Device suggestion
    socket.on('device:suggest', ({ participantId, deviceId, deviceLabel }) => {
        const participant = participants.get(participantId);
        if (participant) {
            io.to(participant.socketId).emit('device:suggestion', {
                deviceId,
                deviceLabel
            });
            console.log(`Device suggestion sent to: ${participant.name}`);
        }
    });

    // Mute synchronization
    socket.on('mute:status', ({ to, isMuted }) => {
        console.log(`Relaying mute status from ${socket.id} to ${to}: ${isMuted}`);
        io.to(to).emit('mute:status', {
            from: socket.id,
            isMuted
        });
    });

    socket.on('mute:request', ({ to, mute }) => {
        console.log(`Relaying mute request from ${socket.id} to ${to}: ${mute}`);
        io.to(to).emit('mute:request', {
            from: socket.id,
            mute
        });
    });

    // Participant Info
    socket.on('participant:info', ({ to, userInfo }) => {
        console.log(`Relaying participant info from ${socket.id} to ${to}`);
        io.to(to).emit('participant:info', {
            from: socket.id,
            userInfo
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // Remove from moderators
        moderators.delete(socket.id);

        // Remove from participants
        for (const [id, participant] of participants.entries()) {
            if (participant.socketId === socket.id) {
                participants.delete(id);
                console.log(`Participant left: ${participant.name}`);

                // Notify moderators
                moderators.forEach((modSocketId) => {
                    io.to(modSocketId).emit('queue:update', Array.from(participants.values()));
                });
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
});
