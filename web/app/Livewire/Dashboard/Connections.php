<?php

namespace App\Livewire\Dashboard;

use Livewire\Component;

class Connections extends Component
{
    public bool $githubConnected = false;

    public bool $slackConnected = false;

    public bool $discordConnected = false;

    public bool $telegramConnected = false;

    public ?string $githubUsername = null;

    public ?string $slackWorkspace = null;

    public ?string $discordServer = null;

    public ?string $telegramBotLink = null;

    public function mount(): void
    {
        $accounts = auth()->user()->connected_accounts ?? [];

        $this->githubConnected = ! empty($accounts['github']['connected']);
        $this->githubUsername = $accounts['github']['username'] ?? null;

        $this->slackConnected = ! empty($accounts['slack']['connected']);
        $this->slackWorkspace = $accounts['slack']['workspace'] ?? null;

        $this->discordConnected = ! empty($accounts['discord']['connected']);
        $this->discordServer = $accounts['discord']['server'] ?? null;

        $this->telegramConnected = ! empty($accounts['telegram']['connected']);
        $this->telegramBotLink = $accounts['telegram']['bot_link'] ?? null;
    }

    public function connectGitHub(): void
    {
        $this->redirect(route('auth.github'));
    }

    public function disconnectGitHub(): void
    {
        $this->updateAccount('github', null);
        $this->githubConnected = false;
        $this->githubUsername = null;
    }

    public function connectSlack(): void
    {
        // Redirect to Slack OAuth — the actual OAuth route should be configured
        // in routes/web.php when Slack integration is fully wired up.
        session()->flash('connection-info', 'Slack OAuth integration is being set up. Please check back soon.');
    }

    public function disconnectSlack(): void
    {
        $this->updateAccount('slack', null);
        $this->slackConnected = false;
        $this->slackWorkspace = null;
    }

    public function connectDiscord(): void
    {
        session()->flash('connection-info', 'Join our Discord bot: https://discord.com/invite/orchestra-mcp');
    }

    public function disconnectDiscord(): void
    {
        $this->updateAccount('discord', null);
        $this->discordConnected = false;
        $this->discordServer = null;
    }

    public function connectTelegram(): void
    {
        $userId = auth()->user()->orchestraId();
        $this->telegramBotLink = "https://t.me/OrchestraMCPBot?start={$userId}";
        session()->flash('connection-info', "Open this link to connect Telegram: {$this->telegramBotLink}");
    }

    public function disconnectTelegram(): void
    {
        $this->updateAccount('telegram', null);
        $this->telegramConnected = false;
        $this->telegramBotLink = null;
    }

    private function updateAccount(string $provider, ?array $data): void
    {
        $user = auth()->user();
        $accounts = $user->connected_accounts ?? [];

        if ($data === null) {
            unset($accounts[$provider]);
        } else {
            $accounts[$provider] = $data;
        }

        $user->update(['connected_accounts' => $accounts]);
    }

    public function render()
    {
        return view('livewire.dashboard.connections');
    }
}
