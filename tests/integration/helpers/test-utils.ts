import { Page, expect } from '@playwright/test';

/**
 * Launches a browser page and logs in as moderator
 */
export async function launchModeratorBrowser(page: Page): Promise<void> {
    await page.goto('/');
    await page.click('text=Login as Moderator');
    await expect(page.locator('h1:has-text("Moderator Dashboard")')).toBeVisible();
}

/**
 * Launches a browser page and logs in as participant with given name
 */
export async function launchParticipantBrowser(page: Page, name: string): Promise<void> {
    await page.goto('/');
    await page.click('text=Login as Participant');
    await page.fill('input[placeholder="Your name"]', name);
    await page.click('button:has-text("Join Waiting Room")');
    await expect(page.locator('text=Waiting for host')).toBeVisible();
}

/**
 * Waits for WebRTC connection to be established by checking video element has srcObject
 */
export async function waitForWebRTCConnection(page: Page, timeout = 30000): Promise<void> {
    await page.waitForFunction(
        () => {
            const video = document.querySelector('video');
            return video && video.srcObject !== null;
        },
        { timeout }
    );
}

/**
 * Gets the MediaStream ID from the video element
 */
export async function getVideoStreamId(page: Page): Promise<string | null> {
    return await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video && video.srcObject) {
            return (video.srcObject as MediaStream).id;
        }
        return null;
    });
}

/**
 * Waits for a specific signaling event to be emitted
 * This requires exposing signaling events to window for testing
 */
export async function waitForSignalingEvent(page: Page, eventType: string, timeout = 10000): Promise<any> {
    return await page.evaluate(
        ({ eventType, timeout }) => {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventType}`)), timeout);

                // Listen for custom event
                window.addEventListener(`signaling:${eventType}`, (e: any) => {
                    clearTimeout(timer);
                    resolve(e.detail);
                }, { once: true });
            });
        },
        { eventType, timeout }
    );
}

/**
 * Checks if participant is in the moderator's queue
 */
export async function isParticipantInQueue(moderatorPage: Page, participantName: string): Promise<boolean> {
    const participantCard = moderatorPage.locator(`.ds-participant-card:has-text("${participantName}")`);
    return await participantCard.isVisible();
}

/**
 * Moderator inspects a participant by name
 */
export async function inspectParticipant(moderatorPage: Page, participantName: string): Promise<void> {
    const participantCard = moderatorPage.locator(`.ds-participant-card:has-text("${participantName}")`);
    await participantCard.locator('button:has-text("Inspect")').click();
    await expect(moderatorPage.locator('h1:has-text("Inspection Console")')).toBeVisible();
}

/**
 * Gets the mute button state (muted or unmuted)
 */
export async function getMuteButtonState(page: Page): Promise<'muted' | 'unmuted'> {
    const muteButton = page.locator('button:has-text("Mute"), button:has-text("Unmute")');
    const text = await muteButton.textContent();
    return text?.includes('Unmute') ? 'muted' : 'unmuted';
}

/**
 * Waits for video element to update (stream ID changes)
 */
export async function waitForVideoStreamChange(page: Page, previousStreamId: string, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        (prevId) => {
            const video = document.querySelector('video') as HTMLVideoElement;
            if (video && video.srcObject) {
                const currentId = (video.srcObject as MediaStream).id;
                return currentId !== prevId;
            }
            return false;
        },
        previousStreamId,
        { timeout }
    );
}
