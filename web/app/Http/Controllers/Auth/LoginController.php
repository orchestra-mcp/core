<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SupabaseAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

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
     * Authenticates via Supabase GoTrue first to validate credentials and
     * obtain the real Supabase JWT. Then logs in (or creates) the local
     * Laravel user with the correct Supabase UUID.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Authenticate via Supabase GoTrue (primary auth provider)
        $authService = app(SupabaseAuthService::class);
        $gotrueResponse = $authService->signInWithPassword(
            $validated['email'],
            $validated['password'],
        );

        if (! $gotrueResponse || isset($gotrueResponse['error']) || ! isset($gotrueResponse['user']['id'])) {
            Log::debug('Supabase GoTrue sign-in failed', [
                'email' => $validated['email'],
                'error' => $gotrueResponse['error_description'] ?? $gotrueResponse['error'] ?? 'unknown',
            ]);

            return back()
                ->withInput($request->only('email', 'remember'))
                ->withErrors(['email' => __('These credentials do not match our records.')]);
        }

        $supabaseUserId = $gotrueResponse['user']['id'];
        $supabaseMetadata = $gotrueResponse['user']['user_metadata'] ?? [];

        // Store Supabase JWT in session for downstream API calls
        session(['supabase_access_token' => $gotrueResponse['access_token']]);
        session(['supabase_refresh_token' => $gotrueResponse['refresh_token'] ?? null]);

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
        // Clear Supabase session data
        session()->forget(['supabase_access_token', 'supabase_refresh_token']);

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
