<?php

namespace App\Livewire\Onboarding;

use App\Services\TokenService;
use Livewire\Component;

class ConnectClaude extends Component
{
    public string $plainToken = '';

    public bool $tokenGenerated = false;

    public function mount(TokenService $tokenService): void
    {
        $user = auth()->user();
        $userId = $user->supabase_user_id ?? (string) \Illuminate\Support\Str::uuid();

        $result = $tokenService->generate(
            userId: $userId,
            organizationId: $user->organization_id,
            name: 'Onboarding Token',
            scopes: ['read', 'write'],
        );

        $this->plainToken = $result['plain_token'];
        $this->tokenGenerated = true;
    }

    public function complete()
    {
        auth()->user()->update(['onboarding_completed' => true]);

        return redirect()->route('dashboard');
    }

    public function render()
    {
        return view('livewire.onboarding.connect-claude')
            ->layout('components.layouts.guest', ['title' => 'Connect Claude']);
    }
}
