<?php

namespace App\Livewire\Dashboard;

use Livewire\Component;

class Settings extends Component
{
    public string $name = '';

    public string $email = '';

    public string $timezone = 'UTC';

    public string $language = 'en';

    public string $orgName = '';

    public string $orgSlug = '';

    public bool $showDeleteConfirmation = false;

    public function mount(): void
    {
        $user = auth()->user();

        $this->name = $user->name ?? '';
        $this->email = $user->email ?? '';
        $this->timezone = $user->timezone ?? 'UTC';
        $this->language = $user->language ?? 'en';

        $org = $user->organization;
        $this->orgName = $org?->name ?? '';
        $this->orgSlug = $org?->slug ?? '';
    }

    public function save(): void
    {
        $this->validate([
            'name' => 'required|string|max:255',
            'timezone' => 'required|string|timezone',
            'language' => 'required|in:en,ar',
        ]);

        $user = auth()->user();
        $user->update([
            'name' => $this->name,
            'timezone' => $this->timezone,
            'language' => $this->language,
        ]);

        session()->flash('settings-saved', 'Settings saved successfully.');
    }

    public function confirmDelete(): void
    {
        $this->showDeleteConfirmation = true;
    }

    public function cancelDelete(): void
    {
        $this->showDeleteConfirmation = false;
    }

    public function deleteAccount(): void
    {
        $user = auth()->user();

        // Soft delete: mark as deleted but preserve data
        $user->delete();

        auth()->logout();
        session()->invalidate();
        session()->regenerateToken();

        $this->redirect(route('home'));
    }

    public function render()
    {
        return view('livewire.dashboard.settings');
    }
}
