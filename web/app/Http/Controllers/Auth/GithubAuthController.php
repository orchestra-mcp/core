<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

class GithubAuthController extends Controller
{
    /**
     * Redirect to GitHub for authentication.
     */
    public function redirect(): SymfonyRedirectResponse
    {
        return Socialite::driver('github')->redirect();
    }

    /**
     * Handle the GitHub callback.
     */
    public function callback(): RedirectResponse
    {
        $githubUser = Socialite::driver('github')->user();

        $user = User::updateOrCreate(
            ['email' => $githubUser->getEmail()],
            [
                'name' => $githubUser->getName() ?? $githubUser->getNickname(),
                'password' => Hash::make(Str::random(24)),
            ]
        );

        Auth::login($user, true);

        if (! $user->onboarding_completed) {
            return redirect()->route('onboarding.company');
        }

        return redirect()->route('dashboard');
    }
}
