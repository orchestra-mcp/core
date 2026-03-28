<?php

namespace App\Livewire\Onboarding;

use Livewire\Component;

class TeamSetup extends Component
{
    public string $email = '';

    public string $role = 'member';

    public array $invites = [];

    public function addEmail(): void
    {
        $this->validate([
            'email' => 'required|email',
        ]);

        // Prevent duplicates
        foreach ($this->invites as $invite) {
            if ($invite['email'] === $this->email) {
                $this->addError('email', 'This email has already been added.');

                return;
            }
        }

        $this->invites[] = [
            'email' => $this->email,
            'role' => $this->role,
        ];

        $this->reset('email');
        $this->role = 'member';
    }

    public function removeEmail(int $index): void
    {
        unset($this->invites[$index]);
        $this->invites = array_values($this->invites);
    }

    public function save()
    {
        // Store invites in session for later processing
        session()->put('onboarding_invites', $this->invites);

        return redirect()->route('onboarding.connect');
    }

    public function skip()
    {
        return redirect()->route('onboarding.connect');
    }

    public function render()
    {
        return view('livewire.onboarding.team-setup')
            ->layout('components.layouts.guest', ['title' => 'Invite Your Team']);
    }
}
