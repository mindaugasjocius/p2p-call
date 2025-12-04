# WebRTC P2P Screening Module

A production-ready, drop-in React module for peer-to-peer video screening and inspection. Designed to be integrated into existing administrative dashboards or participant flows.

## 🚀 Features

*   **True P2P WebRTC**: Direct peer-to-peer video/audio with low latency.
*   **Cross-Device Support**: Works across mobile, desktop, and different networks (STUN included).
*   **Real-Time Signaling**: Socket.io-based signaling for connection coordination.
*   **Device Management**: Remote device switching suggestions and local controls.
*   **Queue System**: Automatic participant queueing with real-time updates.
*   **Modular Architecture**: Separated concerns (Signaling, WebRTC hook, UI components).

## 🏗 Architecture

The system consists of three main parts:

1.  **Signaling Server (`/server`)**: A lightweight Node.js/Socket.io server that coordinates connections. It does **not** handle media traffic, only connection metadata.
2.  **Frontend Services**:
    *   `SignalingService`: Singleton handling WebSocket connections.
    *   `useWebRTC`: Custom hook managing the complex WebRTC state machine.
3.  **UI Components**:
    *   `ParticipantApp`: The user-facing video interface.
    *   `InspectionConsole`: The admin/moderator interface.

## 📦 Integration Guide

### 1. Backend Integration

The signaling server is required to exchange connection details between peers.

**Option A: Run Standalone**
Deploy the provided server code (`/server`) to any Node.js host (Heroku, Railway, AWS).
```bash
cd server
npm install
PORT=3001 npm start
```

**Option B: Integrate into Existing Express App**
If you have an existing Express/Socket.io server, merge the logic from `server/index.js`.
Key events to handle: `participant:join`, `inspection:start`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`.

### 2. Frontend Integration

**Prerequisites:**
*   React 18+
*   Socket.io Client (`npm install socket.io-client`)

**Step 1: Copy Core Files**
Copy the following directories to your project:
*   `src/services/` (Signaling logic)
*   `src/hooks/` (WebRTC logic)
*   `src/components/` (UI Components)
*   `src/types.ts` (Type definitions)

**Step 2: Configure Environment**
Set the signaling server URL in your `.env` file:
```env
VITE_SIGNALING_SERVER_URL=https://your-signaling-server.com
```

**Step 3: Render Components**

**For the Participant Page:**
```tsx
import { ParticipantApp } from './components/Participant/ParticipantApp';

function JoinPage() {
  // Generate or fetch a unique ID for the user
  const userId = "user-123"; 
  return <ParticipantApp participantId={userId} />;
}
```

**For the Admin/Moderator Dashboard:**
```tsx
import { ModeratorDashboard } from './components/Moderator/ModeratorDashboard';
import { InspectionConsole } from './components/Moderator/InspectionConsole';

function AdminPanel() {
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  if (selectedParticipantId) {
    return (
      <InspectionConsole 
        participantId={selectedParticipantId}
        onBack={() => setSelectedParticipantId(null)}
        onAutoAdvance={(nextId) => setSelectedParticipantId(nextId)}
      />
    );
  }

  return <ModeratorDashboard onSelectParticipant={setSelectedParticipantId} />;
}
```

## 🔧 Customization

### Authentication
Modify `src/services/SignalingService.ts` to include your auth tokens in the socket connection:
```typescript
this.socket = io(SERVER_URL, {
    auth: { token: 'YOUR_AUTH_TOKEN' }
});
```

### STUN/TURN Servers
For production use behind restrictive firewalls, configure TURN servers in `src/hooks/useWebRTC.ts`:
```typescript
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { 
            urls: 'turn:your-turn-server.com',
            username: 'user',
            credential: 'password'
        }
    ],
};
```

### Styling
All styles are modular CSS (`*.module.css`). You can easily replace them with Tailwind classes or your own design system.

## 🛠 Troubleshooting

*   **Black Screen?** Ensure you are not trying to access the same camera from two tabs on the same browser. Use different devices or a virtual camera.
*   **Connection Failed?** Check if the signaling server is reachable.
    *   **Vercel Error**: If you see `WebSocket connection to 'wss://...vercel.app/...' failed`, it means you haven't deployed the backend separately. Vercel only hosts the frontend. You must deploy the `/server` folder to Render/Railway and update `VITE_SIGNALING_SERVER_URL`.
*   **Permissions Error?** Browsers require HTTPS for camera access on non-localhost domains. Use a tunneling service (like ngrok) or setup local HTTPS for testing on mobile.

## 📄 License

MIT
