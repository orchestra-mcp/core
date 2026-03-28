<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;
use Saeedvir\Supabase\Facades\Supabase;

class LoginController extends Controller
{
    /**
     * Show the login form.
     */
    public function show(): View
    {
        return view('auth.login');
    }

    /**
     * Handle a login request.
     *
     * Authenticates via Supabase SDK first to validate credentials and
     * obtain the real Supabase JWT. Then logs in (or creates) the local
     * Laravel user with the correct Supabase UUID.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Auth via Supabase SDK
        $result = Supabase::auth()->signIn($validated['email'], $validated['password']);

        if (! $result || isset($result['error'])) {
            Log::debug('Supabase SDK sign-in failed', [
                'email' => $validated['email'],
                'error' => $result['message'] ?? $result['error'] ?? 'unknown',
            ]);

            return back()
                ->withInput($request->only('email', 'remember'))
                ->withErrors(['email' => __('These credentials do not match our records.')]);
        }

        // The SDK signIn response includes: access_token, refresh_token, user, etc.
        $supabaseUserId = $result['user']['id'] ?? null;
        $supabaseMetadata = $result['user']['user_metadata'] ?? [];

        if (! $supabaseUserId) {
            Log::debug('Supabase SDK sign-in returned no user ID', [
                'email' => $validated['email'],
                'response_keys' => array_keys($result),
            ]);

            return back()
                ->withInput($request->only('email', 'remember'))
                ->withErrors(['email' => __('These credentials do not match our records.')]);
        }

        // Store Supabase JWT in session for downstream API calls
        session(['supabase_access_token' => $result['access_token'] ?? null]);
        session(['supabase_refresh_token' => $result['refresh_token'] ?? null]);

        // Find or create local Laravel user, always syncing the Supabase UUID
        $user = User::where('email', $validated['email'])->first();

        if (! $user) {
            $user = User::create([
                'name' => $supabaseMetadata['full_name'] ?? $validated['email'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'supabase_user_id' => $supabaseUserId,
                'onboarding_completed' => false,
            ]);
        } elseif (! $user->supabase_user_id || $user->supabase_user_id !== $supabaseUserId) {
            // Backfill or correct the Supabase UUID for existing users
            $user->update(['supabase_user_id' => $supabaseUserId]);
        }

        Auth::login($user, $request->boolean('remember'));

        $request->session()->regenerate();

        if (! $user->onboarding_completed) {
            return redirect()->route('onboarding.company');
        }

        return redirect()->intended(route('dashboard'));
    }

    /**
     * Handle a logout request.
     */
    public function destroy(Request $request): RedirectResponse
    {
        // Sign out from Supabase if we have an access token
        $accessToken = session('supabase_access_token');
        if ($accessToken) {
            try {
                Supabase::auth()->signOut($accessToken);
            } catch (\Throwable $e) {
                Log::debug('Supabase SDK sign-out failed', ['error' => $e->getMessage()]);
            }
        }

        // Clear Supabase session data
        session()->forget(['supabase_access_token', 'supabase_refresh_token']);

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
