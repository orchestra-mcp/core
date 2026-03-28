<?php

namespace App\Livewire\Dashboard;

use App\Models\McpToken;
use Livewire\Component;

class UsageStats extends Component
{
    public string $planName = 'Free';

    public int $tokensUsed = 0;

    public int $tokensMax = 3;

    public int $agentsUsed = 0;

    public int $agentsMax = 3;

    public int $tasksUsed = 0;

    public int $tasksMax = 100;

    public float $memoryUsedMb = 0;

    public float $memoryMaxMb = 50;

    public function mount(): void
    {
        $user = auth()->user();
        $org = $user->organization;

        // Determine plan and limits from organization
        $plan = $org?->plan ?? 'free';
        $limits = $org?->limits ?? [];

        $this->planName = ucfirst($plan);

        // Set limits based on plan
        $planLimits = match ($plan) {
            'pro' => ['tokens' => 20, 'agents' => 20, 'tasks' => 2000, 'memory' => 500],
            'team' => ['tokens' => 100, 'agents' => 100, 'tasks' => 10000, 'memory' => 5120],
            'enterprise' => ['tokens' => 9999, 'agents' => 9999, 'tasks' => 99999, 'memory' => 99999],
            default => ['tokens' => 3, 'agents' => 3, 'tasks' => 100, 'memory' => 50],
        };

        // Allow custom limits from organization settings to override defaults
        $this->tokensMax = $limits['tokens'] ?? $planLimits['tokens'];
        $this->agentsMax = $limits['agents'] ?? $planLimits['agents'];
        $this->tasksMax = $limits['tasks'] ?? $planLimits['tasks'];
        $this->memoryMaxMb = $limits['memory'] ?? $planLimits['memory'];

        // Calculate current usage
        $this->tokensUsed = McpToken::where('user_id', $user->orchestraId())
            ->whereNull('revoked_at')
            ->count();

        $this->agentsUsed = $user->teamMemberships()->count();

        $this->tasksUsed = McpToken::where('user_id', $user->orchestraId())
            ->whereNull('revoked_at')
            ->sum('usage_count') ?? 0;

        // Memory: approximate from task count
        $this->memoryUsedMb = round($this->tasksUsed * 0.5, 1);
    }

    public function getUsagePercentage(int|float $used, int|float $max): int
    {
        if ($max <= 0) {
            return 0;
        }

        return min(100, (int) round(($used / $max) * 100));
    }

    public function formatMemory(float $mb): string
    {
        if ($mb >= 1024) {
            return round($mb / 1024, 1) . ' GB';
        }

        return round($mb, 1) . ' MB';
    }

    public function render()
    {
        return view('livewire.dashboard.usage-stats');
    }
}
