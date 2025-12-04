import { useState, useEffect } from 'react';
import { ParticipantApp } from './components/Participant/ParticipantApp';
import { ModeratorDashboard } from './components/Moderator/ModeratorDashboard';
import { InspectionConsole } from './components/Moderator/InspectionConsole';
import signalingService from './services/SignalingService';
import { UAParser } from 'ua-parser-js';
import './App.css';

type Role = 'none' | 'moderator' | 'participant';
type ModeratorView = 'dashboard' | 'inspection';

function App() {
  const [role, setRole] = useState<Role>('none');
  const [moderatorView, setModeratorView] = useState<ModeratorView>('dashboard');
  const [currentParticipantId, setCurrentParticipantId] = useState<string>('');
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Connect to signaling server on mount
  useEffect(() => {
    const connect = async () => {
      setIsConnecting(true);
      await signalingService.connect();
      setIsConnecting(false);
    };
    connect();

    return () => {
      signalingService.disconnect();
    };
  }, []);

  // Register participant when they submit their name
  const handleParticipantLogin = async (name: string) => {
    // Generate unique ID
    const participantId = `participant-${Date.now()}`;

    // Parse user agent
    const parser = new UAParser();
    const result = parser.getResult();

    // Join as participant via WebSocket
    signalingService.joinAsParticipant({
      id: participantId,
      name: name || 'Anonymous',
      browser: `${result.browser.name} ${result.browser.version}`,
      os: `${result.os.name} ${result.os.version}`,
      deviceType: result.device.type || 'Desktop',
    });

    setMyParticipantId(participantId);
    setRole('participant');
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (participantName.trim()) {
      handleParticipantLogin(participantName.trim());
    }
  };

  const handleSelectParticipant = (participantId: string) => {
    setCurrentParticipantId(participantId);
    setModeratorView('inspection');
  };

  const handleBackToDashboard = () => {
    setModeratorView('dashboard');
  };

  const handleAutoAdvance = (nextParticipantId: string) => {
    setCurrentParticipantId(nextParticipantId);
    // Stay in inspection view, just update the participant
  };

  // Landing page
  if (role === 'none') {
    return (
      <div className="ds-landing">
        <div className="ds-landing-content">
          <h1 className="ds-heading">P2P Screening Room</h1>

          {!showNameInput ? (
            <>
              <p className="ds-text">Select your role to continue</p>
              <div className="ds-button-group">
                <button
                  className="ds-button ds-button-primary ds-button-large"
                  onClick={() => setRole('moderator')}
                >
                  Login as Moderator
                </button>
                <button
                  className="ds-button ds-button-primary ds-button-large"
                  onClick={() => setShowNameInput(true)}
                >
                  Login as Participant
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="ds-text">Enter your name to join the waiting room</p>
              <form onSubmit={handleNameSubmit} className="ds-name-form">
                <input
                  type="text"
                  className="ds-input"
                  placeholder="Your name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  autoFocus
                  required
                />
                <div className="ds-button-group">
                  <button
                    type="submit"
                    className="ds-button ds-button-primary ds-button-large"
                    disabled={!participantName.trim()}
                  >
                    Join Waiting Room
                  </button>
                  <button
                    type="button"
                    className="ds-button ds-button-secondary"
                    onClick={() => {
                      setShowNameInput(false);
                      setParticipantName('');
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // Participant view
  if (role === 'participant') {
    return <ParticipantApp participantId={myParticipantId} />;
  }

  // Moderator view
  if (role === 'moderator') {
    if (moderatorView === 'dashboard') {
      return <ModeratorDashboard onSelectParticipant={handleSelectParticipant} />;
    }

    return (
      <InspectionConsole
        participantId={currentParticipantId}
        onBack={handleBackToDashboard}
        onAutoAdvance={handleAutoAdvance}
      />
    );
  }

  return null;
}

export default App;

