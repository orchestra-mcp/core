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
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class RegisterController extends Controller
{
    /**
     * Show the registration form.
     */
    public function show(): View
    {
        return view('auth.register');
    }

    /**
     * Handle a registration request.
     *
     * Creates the user in Supabase GoTrue first, then creates the local
     * Laravel user with the real Supabase UUID — eliminating the dual-auth
     * UUID/integer mismatch.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        // Create user in Supabase GoTrue as the primary auth provider
        $authService = app(SupabaseAuthService::class);
        $supabaseUser = $authService->createUser(
            $validated['email'],
            $validated['password'],
            ['full_name' => $validated['name']],
        );

        if (! $supabaseUser || ! isset($supabaseUser['id'])) {
            Log::warning('Supabase GoTrue user creation failed', [
                'email' => $validated['email'],
                'response' => $supabaseUser,
            ]);

            return back()
                ->withInput($request->only('name', 'email'))
                ->withErrors(['email' => 'Failed to create account. Please try again.']);
        }

        // Create local user with the real Supabase UUID
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'supabase_user_id' => $supabaseUser['id'],
            'onboarding_completed' => false,
        ]);

        Auth::login($user);

        return redirect()->route('onboarding.company');
    }
}
