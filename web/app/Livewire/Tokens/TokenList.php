<?php

namespace App\Livewire\Tokens;

use App\Services\TokenService;
use Livewire\Component;

class TokenList extends Component
{
    public $tokens;

    public bool $showCreateModal = false;

    public string $newTokenName = '';

    public ?string $generatedToken = null;

    public function mount(): void
    {
        $this->loadTokens();
    }

    public function loadTokens(): void
    {
        $tokenService = app(TokenService::class);
        $this->tokens = $tokenService->listForUser(auth()->id());
    }

    public function createToken(): void
    {
        $this->validate([
            'newTokenName' => 'required|min:2|max:100',
        ]);

        $tokenService = app(TokenService::class);
        $result = $tokenService->generate(
            userId: auth()->id(),
            organizationId: auth()->user()->organization_id ?? '',
            name: $this->newTokenName,
        );

        $this->generatedToken = $result['plain_token'];
        $this->newTokenName = '';
        $this->loadTokens();
    }

    public function revokeToken(string $tokenId): void
    {
        $tokenService = app(TokenService::class);
        $tokenService->revoke($tokenId, auth()->id());
        $this->loadTokens();
    }

    public function closeModal(): void
    {
        $this->generatedToken = null;
        $this->showCreateModal = false;
    }

    public function render()
    {
        return view('livewire.tokens.token-list');
    }
}
