<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SupabaseAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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
     *
     * After GitHub OAuth completes, ensure the user exists in Supabase GoTrue
     * so the Supabase UUID is always the primary identifier.
     */
    public function callback(): RedirectResponse
    {
        $githubUser = Socialite::driver('github')->user();
        $email = $githubUser->getEmail();
        $name = $githubUser->getName() ?? $githubUser->getNickname();
        $randomPassword = Str::random(32);

        // Ensure the user exists in Supabase GoTrue
        $authService = app(SupabaseAuthService::class);
        $supabaseUserId = null;

        // First check if user already exists in Supabase
        $existingSupabaseUser = $authService->findUserByEmail($email);

        if ($existingSupabaseUser) {
            $supabaseUserId = $existingSupabaseUser['id'];
        } else {
            // Create user in Supabase GoTrue
            $supabaseUser = $authService->createUser($email, $randomPassword, [
                'full_name' => $name,
                'provider' => 'github',
            ]);

            if ($supabaseUser && isset($supabaseUser['id'])) {
                $supabaseUserId = $supabaseUser['id'];
            } else {
                Log::warning('Supabase GoTrue user creation failed during GitHub OAuth', [
                    'email' => $email,
                    'response' => $supabaseUser,
                ]);
            }
        }

        // Create or update local Laravel user
        $user = User::updateOrCreate(
            ['email' => $email],
            array_filter([
                'name' => $name,
                'password' => Hash::make($randomPassword),
                'supabase_user_id' => $supabaseUserId,
            ]),
        );

        // If local user existed but had no supabase_user_id, backfill it
        if ($supabaseUserId && ! $user->supabase_user_id) {
            $user->update(['supabase_user_id' => $supabaseUserId]);
        }

        Auth::login($user, true);

        if (! $user->onboarding_completed) {
            return redirect()->route('onboarding.company');
        }

        return redirect()->route('dashboard');
    }
}
