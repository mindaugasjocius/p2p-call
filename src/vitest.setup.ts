import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});

// Mock MediaStream
window.MediaStream = class {
    id: string;
    active: boolean;
    onaddtrack: any;
    onremovetrack: any;

    constructor() {
        this.id = 'mock-stream-id';
        this.active = true;
    }

    getTracks() { return []; }
    getAudioTracks() { return []; }
    getVideoTracks() { return []; }
    addTrack() { }
    removeTrack() { }
    clone() { return this; }
    getElementById() { return null; }
} as any;

// Mock HTMLMediaElement properties
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
});
