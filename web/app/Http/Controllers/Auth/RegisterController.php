<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;
use Saeedvir\Supabase\Facades\Supabase;

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
     * Creates the user in Supabase GoTrue first via the SDK, then creates
     * the local Laravel user with the real Supabase UUID.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        // Register via Supabase SDK
        $supabaseResult = Supabase::auth()->signUp(
            $validated['email'],
            $validated['password'],
            ['data' => ['full_name' => $validated['name']]],
        );

        if (! $supabaseResult || isset($supabaseResult['error'])) {
            $errorMessage = $supabaseResult['message']
                ?? $supabaseResult['error']['message']
                ?? 'Unknown error';

            Log::warning('Supabase SDK user registration failed', [
                'email' => $validated['email'],
                'response' => $supabaseResult,
            ]);

            return back()
                ->withInput($request->only('name', 'email'))
                ->withErrors(['email' => 'Registration failed: '.$errorMessage]);
        }

        $supabaseUserId = $supabaseResult['user']['id']
            ?? $supabaseResult['id']
            ?? null;

        if (! $supabaseUserId) {
            Log::warning('Supabase SDK returned no user ID', [
                'email' => $validated['email'],
                'response' => $supabaseResult,
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
            'supabase_user_id' => $supabaseUserId,
            'onboarding_completed' => false,
        ]);

        Auth::login($user);

        return redirect()->route('onboarding.company');
    }
}
