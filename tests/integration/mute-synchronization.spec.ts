import { test, expect } from '@playwright/test';
import {
    launchModeratorBrowser,
    launchParticipantBrowser,
    inspectParticipant,
    waitForWebRTCConnection,
    getMuteButtonState,
} from './helpers/test-utils';

test.describe('Mute Synchronization', () => {
    test('participant mutes themselves, moderator sees update', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Mute Test 1');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Mute Test 1');
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Wait for WebRTC connection
            await waitForWebRTCConnection(moderatorPage, 30000);
            await waitForWebRTCConnection(participantPage, 30000);

            // Participant mutes themselves
            await participantPage.click('button:has-text("Mute")');

            // Wait a bit for synchronization
            await moderatorPage.waitForTimeout(1000);

            // Verify moderator sees participant is muted
            const moderatorMuteButton = moderatorPage.locator('button:has-text("Unmute Participant")');
            await expect(moderatorMuteButton).toBeVisible({ timeout: 5000 });

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });

    test('moderator mutes participant, participant sees update', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Mute Test 2');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Mute Test 2');
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            await waitForWebRTCConnection(moderatorPage, 30000);
            await waitForWebRTCConnection(participantPage, 30000);

            // Moderator mutes participant
            await moderatorPage.click('button:has-text("Mute Participant")');

            // Wait for synchronization
            await participantPage.waitForTimeout(1000);

            // Verify participant's mute button shows "Unmute"
            const participantMuteButton = participantPage.locator('button:has-text("Unmute")');
            await expect(participantMuteButton).toBeVisible({ timeout: 5000 });

            // Verify audio track is disabled
            const audioEnabled = await participantPage.evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                if (video && video.srcObject) {
                    const stream = video.srcObject as MediaStream;
                    const audioTracks = stream.getAudioTracks();
                    return audioTracks.length > 0 && audioTracks[0].enabled;
                }
                return false;
            });
            expect(audioEnabled).toBe(false);

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });

    test('bidirectional mute/unmute cycle', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Mute Test 3');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Mute Test 3');
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            await waitForWebRTCConnection(moderatorPage, 30000);
            await waitForWebRTCConnection(participantPage, 30000);

            // Cycle 1: Participant mutes
            await participantPage.click('button:has-text("Mute")');
            await moderatorPage.waitForTimeout(1000);
            await expect(moderatorPage.locator('button:has-text("Unmute Participant")')).toBeVisible();

            // Cycle 2: Moderator unmutes
            await moderatorPage.click('button:has-text("Unmute Participant")');
            await participantPage.waitForTimeout(1000);
            await expect(participantPage.locator('button:has-text("Mute")')).toBeVisible();

            // Cycle 3: Moderator mutes
            await moderatorPage.click('button:has-text("Mute Participant")');
            await participantPage.waitForTimeout(1000);
            await expect(participantPage.locator('button:has-text("Unmute")')).toBeVisible();

            // Cycle 4: Participant unmutes
            await participantPage.click('button:has-text("Unmute")');
            await moderatorPage.waitForTimeout(1000);
            await expect(moderatorPage.locator('button:has-text("Mute Participant")')).toBeVisible();

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });
});
