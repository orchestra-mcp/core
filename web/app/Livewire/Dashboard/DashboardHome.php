<?php

namespace App\Livewire\Dashboard;

use App\Models\McpToken;
use Livewire\Component;

class DashboardHome extends Component
{
    public int $totalTokens = 0;

    public int $totalAgents = 0;

    public int $totalTasks = 0;

    public string $memoryUsed = '0 MB';

    public array $recentActivity = [];

    public function mount(): void
    {
        $user = auth()->user();

        // Token count (active, non-revoked)
        $this->totalTokens = McpToken::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->count();

        // Agent count — count team members as proxy for agents
        $this->totalAgents = $user->teamMemberships()->count();

        // Tasks this month — use token usage as proxy
        $this->totalTasks = McpToken::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->sum('usage_count') ?? 0;

        // Memory used — placeholder calculation
        $this->memoryUsed = $this->formatMemory($this->totalTasks * 0.5);

        // Recent activity from tokens (last used)
        $this->recentActivity = McpToken::where('user_id', $user->id)
            ->whereNotNull('last_used_at')
            ->orderByDesc('last_used_at')
            ->limit(10)
            ->get()
            ->map(fn ($token) => [
                'description' => "Token \"{$token->name}\" was used",
                'time' => $token->last_used_at->diffForHumans(),
                'prefix' => $token->token_prefix,
            ])
            ->toArray();
    }

    private function formatMemory(float $mb): string
    {
        if ($mb >= 1024) {
            return round($mb / 1024, 1) . ' GB';
        }

        return round($mb, 1) . ' MB';
    }

    public function render()
    {
        return view('livewire.dashboard.dashboard-home');
    }
}
