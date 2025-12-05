import { useEffect, useRef } from 'react';

/**
 * Hook to announce messages to screen readers using ARIA live regions
 * @returns announce function to trigger screen reader announcements
 */
export function useAnnouncer() {
    const announcerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create live region on mount
        const announcer = document.createElement('div');
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
        announcerRef.current = announcer;

        return () => {
            // Cleanup on unmount
            if (announcerRef.current && document.body.contains(announcerRef.current)) {
                document.body.removeChild(announcerRef.current);
            }
        };
    }, []);

    const announce = (message: string) => {
        if (announcerRef.current) {
            // Clear and set message to ensure it's announced
            announcerRef.current.textContent = '';
            setTimeout(() => {
                if (announcerRef.current) {
                    announcerRef.current.textContent = message;
                }
            }, 100);
        }
    };

    return { announce };
}
