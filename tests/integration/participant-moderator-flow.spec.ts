import { test, expect } from '@playwright/test';
import {
    launchModeratorBrowser,
    launchParticipantBrowser,
    isParticipantInQueue,
    inspectParticipant,
    waitForWebRTCConnection,
} from './helpers/test-utils';

test.describe('Participant-Moderator Flow', () => {
    test('complete inspection workflow: join, inspect, admit', async ({ browser }) => {
        // Create two browser contexts (one for moderator, one for participant)
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            // Step 1: Moderator logs in
            await launchModeratorBrowser(moderatorPage);

            // Step 2: Participant logs in and joins queue
            await launchParticipantBrowser(participantPage, 'Test Participant');

            // Step 3: Verify participant appears in moderator's queue
            await moderatorPage.waitForTimeout(1000); // Wait for queue to update
            const inQueue = await isParticipantInQueue(moderatorPage, 'Test Participant');
            expect(inQueue).toBe(true);

            // Step 4: Moderator inspects participant
            await inspectParticipant(moderatorPage, 'Test Participant');

            // Step 5: Verify participant sees inspection state
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Step 6: Wait for WebRTC connection to establish
            await waitForWebRTCConnection(moderatorPage, 30000);
            await waitForWebRTCConnection(participantPage, 30000);

            // Step 7: Verify video elements have streams
            const moderatorHasVideo = await moderatorPage.evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                return video && video.srcObject !== null;
            });
            expect(moderatorHasVideo).toBe(true);

            const participantHasVideo = await participantPage.evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                return video && video.srcObject !== null;
            });
            expect(participantHasVideo).toBe(true);

            // Step 8: Moderator admits participant
            await moderatorPage.click('button:has-text("Admit")');

            // Step 9: Verify participant sees success state
            await expect(participantPage.locator('text=You have been admitted')).toBeVisible({ timeout: 5000 });

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });

    test('moderator can cancel inspection', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Test Participant 2');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Test Participant 2');

            // Wait for inspection to start
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Moderator cancels
            await moderatorPage.click('button:has-text("Cancel")');

            // Verify moderator returns to dashboard
            await expect(moderatorPage.locator('h1:has-text("Moderator Dashboard")')).toBeVisible();

            // Verify participant returns to waiting
            await expect(participantPage.locator('text=Waiting for host')).toBeVisible({ timeout: 5000 });

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });

    test('moderator can remove participant', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Test Participant 3');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Test Participant 3');

            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Moderator removes participant
            await moderatorPage.click('button:has-text("Remove")');

            // Verify participant sees removed state
            await expect(participantPage.locator('text=You have been removed')).toBeVisible({ timeout: 5000 });

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });
});
