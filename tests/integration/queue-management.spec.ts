import { test, expect } from '@playwright/test';
import {
    launchModeratorBrowser,
    launchParticipantBrowser,
    inspectParticipant,
    waitForWebRTCConnection,
    isParticipantInQueue,
} from './helpers/test-utils';

test.describe('Queue Management', () => {
    test('auto-advance to next participant after admit', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participant1Context = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });
        const participant2Context = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participant1Page = await participant1Context.newPage();
        const participant2Page = await participant2Context.newPage();

        try {
            // Setup: Moderator and two participants
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participant1Page, 'Participant 1');
            await launchParticipantBrowser(participant2Page, 'Participant 2');

            // Wait for both to appear in queue
            await moderatorPage.waitForTimeout(2000);
            expect(await isParticipantInQueue(moderatorPage, 'Participant 1')).toBe(true);
            expect(await isParticipantInQueue(moderatorPage, 'Participant 2')).toBe(true);

            // Inspect first participant
            await inspectParticipant(moderatorPage, 'Participant 1');
            await expect(participant1Page.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Wait for connection
            await waitForWebRTCConnection(moderatorPage, 30000);

            // Admit first participant
            await moderatorPage.click('button:has-text("Admit")');

            // Verify first participant sees success
            await expect(participant1Page.locator('text=You have been admitted')).toBeVisible({ timeout: 5000 });

            // Verify auto-advance to second participant
            await expect(moderatorPage.locator('h1:has-text("Inspection Console")')).toBeVisible({ timeout: 5000 });
            await expect(participant2Page.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

        } finally {
            await moderatorContext.close();
            await participant1Context.close();
            await participant2Context.close();
        }
    });

    test('multiple participants in queue, inspect specific one', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participant1Context = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });
        const participant2Context = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participant1Page = await participant1Context.newPage();
        const participant2Page = await participant2Context.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participant1Page, 'Alice');
            await launchParticipantBrowser(participant2Page, 'Bob');

            await moderatorPage.waitForTimeout(2000);

            // Inspect second participant (Bob)
            await inspectParticipant(moderatorPage, 'Bob');

            // Verify only Bob is in inspection
            await expect(participant2Page.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });
            await expect(participant1Page.locator('text=Waiting for host')).toBeVisible();

        } finally {
            await moderatorContext.close();
            await participant1Context.close();
            await participant2Context.close();
        }
    });

    test('participant removed from queue after removal', async ({ browser }) => {
        const moderatorContext = await browser.newContext();
        const participantContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
        });

        const moderatorPage = await moderatorContext.newPage();
        const participantPage = await participantContext.newPage();

        try {
            await launchModeratorBrowser(moderatorPage);
            await launchParticipantBrowser(participantPage, 'Remove Test');

            await moderatorPage.waitForTimeout(1000);
            await inspectParticipant(moderatorPage, 'Remove Test');
            await expect(participantPage.locator('text=Inspection in progress')).toBeVisible({ timeout: 5000 });

            // Remove participant
            await moderatorPage.click('button:has-text("Remove")');

            // Verify participant sees removed state
            await expect(participantPage.locator('text=You have been removed')).toBeVisible({ timeout: 5000 });

            // Verify moderator returns to dashboard
            await expect(moderatorPage.locator('h1:has-text("Moderator Dashboard")')).toBeVisible();

            // Verify participant no longer in queue
            await moderatorPage.waitForTimeout(1000);
            expect(await isParticipantInQueue(moderatorPage, 'Remove Test')).toBe(false);

        } finally {
            await moderatorContext.close();
            await participantContext.close();
        }
    });
});
