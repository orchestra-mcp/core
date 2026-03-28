<?php

namespace App\Livewire\Dashboard;

use Livewire\Component;

class NotificationPreferences extends Component
{
    public array $channels = [
        'email' => true,
        'slack' => false,
        'discord' => false,
        'telegram' => false,
    ];

    public array $events = [
        'task_assigned' => true,
        'task_completed' => true,
        'agent_blocked' => true,
        'review_requested' => true,
        'sprint_started' => false,
    ];

    public function mount(): void
    {
        $prefs = auth()->user()->notification_preferences ?? [];

        if (! empty($prefs['channels'])) {
            $this->channels = array_merge($this->channels, $prefs['channels']);
        }

        if (! empty($prefs['events'])) {
            $this->events = array_merge($this->events, $prefs['events']);
        }
    }

    public function save(): void
    {
        auth()->user()->update([
            'notification_preferences' => [
                'channels' => $this->channels,
                'events' => $this->events,
            ],
        ]);

        session()->flash('preferences-saved', 'Notification preferences saved successfully.');
    }

    public function render()
    {
        return view('livewire.dashboard.notification-preferences');
    }
}
