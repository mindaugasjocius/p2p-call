import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

vi.mock('./services/SignalingService', () => ({
    default: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        joinAsParticipant: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    }
}));

vi.mock('./components/Participant/ParticipantApp', () => ({
    ParticipantApp: () => <div>Participant App Mock</div>
}));

vi.mock('./components/Moderator/ModeratorDashboard', () => ({
    ModeratorDashboard: () => <div>Moderator Dashboard Mock</div>
}));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render landing page initially', () => {
        render(<App />);
        expect(screen.getByText(/P2P Screening Room/i)).toBeInTheDocument();
        expect(screen.getByText(/Login as Moderator/i)).toBeInTheDocument();
        expect(screen.getByText(/Login as Participant/i)).toBeInTheDocument();
    });

    it('should switch to participant name input', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByText(/Login as Participant/i));
        expect(screen.getByPlaceholderText(/Your name/i)).toBeInTheDocument();
    });

    it('should switch to participant app on login', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByText(/Login as Participant/i));

        const input = screen.getByPlaceholderText(/Your name/i);
        await user.type(input, 'Test User');

        await user.click(screen.getByRole('button', { name: /Join/i }));

        expect(screen.getByText(/Participant App Mock/i)).toBeInTheDocument();
    });

    it('should switch to moderator dashboard on login', async () => {
        const user = userEvent.setup();
        render(<App />);
        await user.click(screen.getByText(/Login as Moderator/i));
        expect(screen.getByText(/Moderator Dashboard Mock/i)).toBeInTheDocument();
    });
});
