import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeviceInfo } from '../types';

interface UseMediaStreamResult {
    stream: MediaStream | null;
    devices: DeviceInfo[];
    error: string | null;
    isLoading: boolean;
    requestMedia: (constraints?: MediaStreamConstraints) => Promise<void>;
    switchDevice: (deviceId: string, kind: 'videoinput' | 'audioinput') => Promise<void>;
    stopStream: () => void;
}

export function useMediaStream(): UseMediaStreamResult {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);

    // Enumerate devices
    const enumerateDevices = useCallback(async () => {
        try {
            const deviceList = await navigator.mediaDevices.enumerateDevices();
            const mediaDevices: DeviceInfo[] = deviceList
                .filter((device) => device.kind === 'videoinput' || device.kind === 'audioinput')
                .map((device) => ({
                    deviceId: device.deviceId,
                    label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
                    kind: device.kind as 'videoinput' | 'audioinput',
                }));
            setDevices(mediaDevices);
        } catch (err) {
            console.error('Error enumerating devices:', err);
        }
    }, []);

    // Request media stream
    const requestMedia = useCallback(
        async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
            setIsLoading(true);
            setError(null);

            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = mediaStream;
                setStream(mediaStream);

                // Enumerate devices after getting permission
                await enumerateDevices();
            } catch (err) {
                const error = err as Error;
                console.error('Error accessing media devices:', error);

                if (error.name === 'NotAllowedError') {
                    setError('Camera/microphone access denied. Please grant permissions.');
                } else if (error.name === 'NotFoundError') {
                    setError('No camera or microphone found.');
                } else {
                    setError(`Error: ${error.message}`);
                }
            } finally {
                setIsLoading(false);
            }
        },
        [enumerateDevices]
    );

    // Switch to a different device
    const switchDevice = useCallback(
        async (deviceId: string, kind: 'videoinput' | 'audioinput') => {
            if (!streamRef.current) return;

            setIsLoading(true);
            setError(null);

            try {
                const constraints: MediaStreamConstraints = {
                    video: kind === 'videoinput' ? { deviceId: { exact: deviceId } } : true,
                    audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : true,
                };

                // Stop current stream
                streamRef.current.getTracks().forEach((track) => track.stop());

                // Get new stream with specified device
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = newStream;
                setStream(newStream);
            } catch (err) {
                const error = err as Error;
                console.error('Error switching device:', error);
                setError(`Failed to switch device: ${error.message}`);

                // Try to restore previous stream
                try {
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    streamRef.current = fallbackStream;
                    setStream(fallbackStream);
                } catch (fallbackErr) {
                    console.error('Failed to restore stream:', fallbackErr);
                }
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    // Stop stream
    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    return {
        stream,
        devices,
        error,
        isLoading,
        requestMedia,
        switchDevice,
        stopStream,
    };
}
