# P2P Screening/Green Room Application

Real-time peer-to-peer video screening application with WebRTC and Socket.io signaling.

## Features

✅ Real WebRTC P2P video/audio connections  
✅ Cross-device support (works across different computers/networks)  
✅ Socket.io signaling server for WebRTC coordination  
✅ Participant name entry and queue management  
✅ Moderator inspection console with device suggestions  
✅ Auto-advance to next participant  
✅ STUN servers for NAT traversal  

## Quick Start

### 1. Start the Signaling Server

```bash
npm run dev:server
```

The signaling server will run on `http://localhost:3001`

### 2. Start the Frontend (in a new terminal)

```bash
npm run dev
```

The app will be available at:
- **Localhost**: `http://localhost:5173`
- **Network**: `http://YOUR_IP:5173` (for cross-device testing)

## Testing

### Same Device (Different Tabs)

1. Open `http://localhost:5173` in Tab 1
2. Click "Login as Participant", enter your name
3. Open `http://localhost:5173` in Tab 2
4. Click "Login as Moderator"
5. You should see the participant in the waiting room
6. Click to inspect and establish WebRTC connection

### Different Devices (Same Network)

1. Find your local IP address:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. On Device 1 (Participant):
   - Navigate to `http://YOUR_IP:5173`
   - Click "Login as Participant"
   - Enter your name

3. On Device 2 (Moderator):
   - Navigate to `http://YOUR_IP:5173`
   - Click "Login as Moderator"
   - Click on the participant to start inspection
   - WebRTC connection will establish

### Different Networks

For connections across different networks, the free Google STUN servers are used for NAT traversal. This should work in most cases, but some restrictive firewalls may block the connection.

## Architecture

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│ Participant │ ◄─────────────────────────► │ Signaling Server │
└─────────────┘                             │   (Socket.io)    │
      │                                      └──────────────────┘
      │                                               ▲
      │          WebRTC P2P Connection               │
      │          (Video/Audio Direct)                │
      │                                               │
      ▼                                               │
┌─────────────┐         WebSocket                    │
│  Moderator  │ ◄───────────────────────────────────┘
└─────────────┘
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **WebRTC**: RTCPeerConnection, getUserMedia
- **Signaling**: Socket.io (WebSocket)
- **STUN**: Google STUN servers
- **Styling**: CSS Modules with `ds-*` design system

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SIGNALING_SERVER_URL=http://localhost:3001
```

For production, update this to your deployed signaling server URL.

## Deployment

### Signaling Server

Deploy the `server/` directory to any Node.js hosting service:
- Heroku
- Railway
- Render
- DigitalOcean App Platform

### Frontend

Build and deploy the frontend:

```bash
npm run build
```

Deploy the `dist/` folder to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

**Important**: Update `VITE_SIGNALING_SERVER_URL` to point to your deployed signaling server.

## Troubleshooting

### WebRTC Connection Fails

1. **Check Console Logs**: Open browser DevTools and check for WebRTC errors
2. **Firewall**: Ensure ports 3001 (signaling) and 5173 (frontend) are accessible
3. **STUN/TURN**: For restrictive networks, you may need a TURN server
4. **HTTPS**: Some browsers require HTTPS for getUserMedia on non-localhost

### No Video/Audio

1. **Permissions**: Grant camera/microphone permissions in browser
2. **Device Check**: Ensure camera/mic are not in use by another application
3. **Browser Support**: Use modern browsers (Chrome, Firefox, Safari, Edge)

### Signaling Server Not Connecting

1. **Server Running**: Ensure `npm run dev:server` is running
2. **Port Conflict**: Check if port 3001 is already in use
3. **CORS**: Signaling server allows all origins in development

## Development

### Project Structure

```
p2p-call/
├── server/                    # Socket.io signaling server
│   ├── index.js              # Server implementation
│   └── package.json          # Server dependencies
├── src/
│   ├── components/
│   │   ├── Moderator/
│   │   │   ├── ModeratorDashboard.tsx
│   │   │   └── InspectionConsole.tsx
│   │   └── Participant/
│   │       └── ParticipantApp.tsx
│   ├── hooks/
│   │   ├── useMediaStream.ts
│   │   └── useWebRTC.ts      # WebRTC peer connection hook
│   ├── services/
│   │   └── SignalingService.ts  # WebSocket client
│   ├── types.ts
│   └── App.tsx
└── package.json
```

### Adding TURN Server (Optional)

For better connectivity across restrictive networks, add a TURN server to `src/hooks/useWebRTC.ts`:

```typescript
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ],
};
```

Free TURN servers:
- [Twilio STUN/TURN](https://www.twilio.com/stun-turn)
- [Metered TURN](https://www.metered.ca/tools/openrelay/)

## License

MIT
