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
  | 'queueUpdated';

export interface SignalingEvent {
  type: SignalingEventType;
  participantId?: string;
  participantSocketId?: string;
  moderatorSocketId?: string;
  deviceId?: string;
  deviceLabel?: string;
  nextParticipantId?: string;
  devices?: any[];
}
