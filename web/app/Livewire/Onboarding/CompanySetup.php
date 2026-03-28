<?php

namespace App\Livewire\Onboarding;

use App\Models\Organization;
use App\Models\Team;
use App\Models\TeamMember;
use Illuminate\Support\Str;
use Livewire\Component;

class CompanySetup extends Component
{
    public string $name = '';

    public string $slug = '';

    public string $description = '';

    public function updatedName($value): void
    {
        $this->slug = Str::slug($value);
    }

    public function save()
    {
        $this->validate([
            'name' => 'required|min:2|max:100',
            'slug' => 'required|min:2|max:50|alpha_dash',
        ]);

        // Create organization
        $org = Organization::create([
            'name' => $this->name,
            'slug' => $this->slug,
            'owner_id' => auth()->id(),
            'description' => $this->description,
            'plan' => 'free',
            'limits' => [
                'max_users' => 1,
                'max_projects' => 1,
                'max_tokens' => 2,
                'max_agents' => 3,
                'max_tasks_per_month' => 100,
                'max_memory_mb' => 50,
            ],
        ]);

        // Create default team
        $team = Team::create([
            'organization_id' => $org->id,
            'name' => 'Default',
            'slug' => 'default',
        ]);

        // Add owner as team member
        TeamMember::create([
            'team_id' => $team->id,
            'user_id' => auth()->id(),
            'role' => 'owner',
        ]);

        // Store org_id on user
        auth()->user()->update(['organization_id' => $org->id]);

        return redirect()->route('onboarding.team');
    }

    public function render()
    {
        return view('livewire.onboarding.company-setup')
            ->layout('components.layouts.guest', ['title' => 'Create Your Company']);
    }
}
