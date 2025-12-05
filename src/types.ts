export interface Participant {
  id: string;
  name: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  status: 'waiting' | 'inspecting' | 'admitted' | 'removed';
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

export type SignalingEventType =
  | 'participantJoined'
  | 'inspectionStarted'
  | 'inspectionReady'
  | 'deviceSuggestion'
  | 'devicesReceived'
  | 'admitted'
  | 'removed'
  | 'cancelled'
  | 'queueUpdated'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'muteStatus'
  | 'muteRequest'
  | 'participantInfo';

export interface SignalingEvent {
  type: SignalingEventType;
  participantId?: string;
  participantSocketId?: string;
  moderatorSocketId?: string;
  deviceId?: string;
  deviceLabel?: string;
  nextParticipantId?: string;
  devices?: any[];
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
  from?: string;
  isMuted?: boolean;
  mute?: boolean;
  userAgent?: string;
}
