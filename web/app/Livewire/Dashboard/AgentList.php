<?php

namespace App\Livewire\Dashboard;

use App\Models\Agent;
use Livewire\Component;

class AgentList extends Component
{
    public string $search = '';

    public string $statusFilter = 'all';

    public array $agents = [];

    public bool $showCreateModal = false;

    // Create form fields
    public string $newName = '';

    public string $newSlug = '';

    public string $newRole = '';

    public string $newType = 'general';

    public string $newPersona = '';

    public string $newSystemPrompt = '';

    public function mount(): void
    {
        $this->loadAgents();
    }

    public function loadAgents(): void
    {
        $user = auth()->user();
        $orgId = $user->organization_id;

        $query = Agent::where('organization_id', $orgId)
            ->orderByDesc('created_at');

        if ($this->search) {
            $query->where(function ($q) {
                $q->where('name', 'ilike', "%{$this->search}%")
                    ->orWhere('role', 'ilike', "%{$this->search}%")
                    ->orWhere('type', 'ilike', "%{$this->search}%");
            });
        }

        if ($this->statusFilter !== 'all') {
            $query->where('status', $this->statusFilter);
        }

        $this->agents = $query->get()->map(fn (Agent $agent) => [
            'id' => $agent->id,
            'name' => $agent->name,
            'slug' => $agent->slug,
            'role' => $agent->role,
            'type' => $agent->type,
            'status' => $agent->status,
            'status_label' => $agent->statusLabel(),
            'status_classes' => $agent->statusClasses(),
            'initial' => $agent->initial(),
            'avatar_color' => $agent->avatar_color,
            'skills' => $agent->skills ?? [],
            'created_at' => $agent->created_at->diffForHumans(),
        ])->toArray();
    }

    public function updatedSearch(): void
    {
        $this->loadAgents();
    }

    public function updatedStatusFilter(): void
    {
        $this->loadAgents();
    }

    public function updatedNewName(): void
    {
        $this->newSlug = \Illuminate\Support\Str::slug($this->newName);
    }

    public function openCreateModal(): void
    {
        $this->resetCreateForm();
        $this->showCreateModal = true;
    }

    public function closeCreateModal(): void
    {
        $this->showCreateModal = false;
        $this->resetCreateForm();
    }

    public function createAgent(): void
    {
        $this->validate([
            'newName' => 'required|string|max:255',
            'newSlug' => 'required|string|max:255|alpha_dash',
            'newRole' => 'nullable|string|max:255',
            'newType' => 'required|in:general,backend,frontend,qa,devops,data,ai,design,mobile',
            'newPersona' => 'nullable|string|max:2000',
            'newSystemPrompt' => 'nullable|string|max:5000',
        ]);

        $user = auth()->user();

        // Pick a random gradient color for the avatar
        $colors = [
            'from-cyan-500 to-purple-500',
            'from-emerald-500 to-cyan-500',
            'from-purple-500 to-pink-500',
            'from-amber-500 to-red-500',
            'from-blue-500 to-indigo-500',
            'from-teal-500 to-emerald-500',
            'from-rose-500 to-orange-500',
            'from-violet-500 to-fuchsia-500',
        ];

        Agent::create([
            'name' => $this->newName,
            'slug' => $this->newSlug,
            'role' => $this->newRole ?: null,
            'type' => $this->newType,
            'status' => 'active',
            'persona' => $this->newPersona ?: null,
            'system_prompt' => $this->newSystemPrompt ?: null,
            'avatar_color' => $colors[array_rand($colors)],
            'organization_id' => $user->organization_id,
            'created_by' => $user->orchestraId(),
        ]);

        $this->closeCreateModal();
        $this->loadAgents();

        session()->flash('agent-created', 'Agent created successfully.');
    }

    private function resetCreateForm(): void
    {
        $this->newName = '';
        $this->newSlug = '';
        $this->newRole = '';
        $this->newType = 'general';
        $this->newPersona = '';
        $this->newSystemPrompt = '';
    }

    public function render()
    {
        return view('livewire.dashboard.agent-list');
    }
}
