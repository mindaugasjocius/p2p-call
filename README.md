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

The system is designed with clear separation of concerns, making it easy to integrate or migrate to different UI frameworks:

### Backend Layer
1.  **Signaling Server (`/server`)**: A lightweight Node.js/Socket.io server that coordinates WebRTC connections. It does **not** handle media traffic, only connection metadata and signaling events.

### Service Layer (Framework-Agnostic)
2.  **`SignalingService`** (`src/services/SignalingService.ts`): Singleton managing WebSocket connections and event handling. Pure TypeScript with no UI dependencies.
3.  **`useWebRTC`** (`src/hooks/useWebRTC.ts`): Custom hook encapsulating the complex WebRTC state machine (peer connections, ICE candidates, SDP negotiation). Can be ported to Vue Composition API or other frameworks.
4.  **`useUserAgent`** (`src/hooks/useUserAgent.ts`): Hook for parsing user agent information. Demonstrates the pattern of extracting business logic from UI components.

### UI Layer (React-Specific)
5.  **`ParticipantApp`** (`src/components/Participant/ParticipantApp.tsx`): User-facing video interface with state management and device controls.
6.  **`InspectionConsole`** (`src/components/Moderator/InspectionConsole.tsx`): Admin/moderator interface for inspecting participants.
7.  **`ModeratorDashboard`** (`src/components/Moderator/ModeratorDashboard.tsx`): Queue management interface.

### Modularity Notes
- **Services and hooks** contain all business logic and can be reused in any UI framework
- **Components** are thin presentation layers that consume hooks and services
- **Types** (`src/types.ts`) are shared across all layers
- **Styling** uses CSS modules for easy replacement with any styling system

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

## 🔄 Migrating to Other UI Frameworks

The codebase is designed to make UI framework migration straightforward. Here's how to port to other frameworks:

### Vue 3 Example
The service layer and hooks can be reused with minimal changes:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import signalingService from '@/services/SignalingService';
import { useWebRTC } from '@/hooks/useWebRTC'; // Port to Composition API
import { useUserAgent } from '@/hooks/useUserAgent';

const participantId = ref('participant-123');
const userAgentInfo = useUserAgent();
const { localStream, remoteStream, cleanup } = useWebRTC();

onMounted(async () => {
  await signalingService.connect();
  // ... rest of logic
});

onUnmounted(() => {
  cleanup();
  signalingService.disconnect();
});
</script>

<template>
  <div class="participant-container">
    <video ref="videoRef" autoplay playsinline></video>
  </div>
</template>
```

### Svelte Example
```svelte
<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import signalingService from './services/SignalingService';
import { useWebRTC } from './hooks/useWebRTC'; // Adapt to Svelte stores

let videoElement: HTMLVideoElement;
const { localStream, remoteStream, cleanup } = useWebRTC();

onMount(async () => {
  await signalingService.connect();
});

onDestroy(() => {
  cleanup();
  signalingService.disconnect();
});
</script>

<video bind:this={videoElement} autoplay playsinline></video>
```

### Key Migration Steps
1. **Keep Services As-Is**: `SignalingService` is pure TypeScript - copy directly
2. **Adapt Hooks**: Convert React hooks to your framework's reactive primitives (Vue Composition API, Svelte stores, Angular services)
3. **Rebuild UI**: Use the same state and methods, just different templates/JSX
4. **Reuse Types**: `src/types.ts` works across all frameworks

## 🛠 Troubleshooting

*   **Black Screen?** Ensure you are not trying to access the same camera from two tabs on the same browser. Use different devices or a virtual camera.
*   **Connection Failed?** Check if the signaling server is reachable.
    *   **Vercel Error**: If you see `WebSocket connection to 'wss://...vercel.app/...' failed`, it means you haven't deployed the backend separately. Vercel only hosts the frontend. You must deploy the `/server` folder to Render/Railway and update `VITE_SIGNALING_SERVER_URL`.
*   **Permissions Error?** Browsers require HTTPS for camera access on non-localhost domains. Use a tunneling service (like ngrok) or setup local HTTPS for testing on mobile.

## 🧪 Testing

The project includes comprehensive test coverage:

### Unit Tests (Vitest + React Testing Library)
```bash
npm test
```

Tests cover:
- `SignalingService` - Connection, event handling, mute status
- `useWebRTC` - Peer connection, offer/answer, ICE candidates
- `ParticipantApp` - State transitions, queue joining
- `App` - Role selection, navigation

### Integration Tests (Playwright)
```bash
# Start dev servers first
npm run dev          # Terminal 1
npm run dev:server   # Terminal 2

# Run integration tests
npm run test:integration
```

Tests cover:
- Complete participant-moderator workflow
- WebRTC connection establishment
- Mute synchronization (bidirectional)
- Queue management and auto-advance
- Device switching (planned)

### Test Architecture
- **Unit tests** mock WebRTC and Socket.io for fast, isolated testing
- **Integration tests** use real browsers and WebRTC connections for end-to-end validation
- All tests run in CI/CD pipeline

## 📄 License

MIT
