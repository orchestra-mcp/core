<?php

namespace App\Livewire\Dashboard;

use App\Models\Agent;
use Livewire\Component;

class AgentProfile extends Component
{
    public string $agentId;

    public array $agent = [];

    public int $tasksCompleted = 0;

    public int $activeSessions = 0;

    public int $memoriesCount = 0;

    public int $decisionsCount = 0;

    public array $recentActivity = [];

    public array $assignedTasks = [];

    public array $skills = [];

    public function mount(string $agentId): void
    {
        $user = auth()->user();

        $agentModel = Agent::where('id', $agentId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();

        $this->agent = [
            'id' => $agentModel->id,
            'name' => $agentModel->name,
            'slug' => $agentModel->slug,
            'role' => $agentModel->role,
            'type' => $agentModel->type,
            'status' => $agentModel->status,
            'status_label' => $agentModel->statusLabel(),
            'status_classes' => $agentModel->statusClasses(),
            'initial' => $agentModel->initial(),
            'avatar_color' => $agentModel->avatar_color,
            'persona' => $agentModel->persona,
            'system_prompt' => $agentModel->system_prompt,
            'created_at' => $agentModel->created_at->format('M d, Y'),
            'updated_at' => $agentModel->updated_at->diffForHumans(),
        ];

        $this->skills = $agentModel->skills ?? [];

        // Stats — these will be populated from real tables when available.
        // For now, derive from metadata or use sensible defaults.
        $meta = $agentModel->metadata ?? [];
        $this->tasksCompleted = $meta['tasks_completed'] ?? 0;
        $this->activeSessions = $meta['active_sessions'] ?? 0;
        $this->memoriesCount = $meta['memories'] ?? 0;
        $this->decisionsCount = $meta['decisions'] ?? 0;

        // Recent activity — placeholder entries from metadata
        $this->recentActivity = $meta['recent_activity'] ?? [];

        // Assigned tasks — placeholder entries from metadata
        $this->assignedTasks = $meta['assigned_tasks'] ?? [];
    }

    public function toggleStatus(): void
    {
        $user = auth()->user();

        $agentModel = Agent::where('id', $this->agentId)
            ->where('organization_id', $user->organization_id)
            ->firstOrFail();

        $newStatus = $agentModel->status === 'active' ? 'inactive' : 'active';
        $agentModel->update(['status' => $newStatus]);

        $this->agent['status'] = $newStatus;
        $this->agent['status_label'] = $agentModel->statusLabel();
        $this->agent['status_classes'] = $agentModel->statusClasses();
    }

    public function archiveAgent(): void
    {
        $user = auth()->user();

        Agent::where('id', $this->agentId)
            ->where('organization_id', $user->organization_id)
            ->update(['status' => 'archived']);

        $this->redirect(route('dashboard.agents'));
    }

    public function render()
    {
        return view('livewire.dashboard.agent-profile');
    }
}
