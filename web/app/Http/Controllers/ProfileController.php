<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    /**
     * Display a public user profile.
     *
     * Finds the user by username where is_public is true.
     * Returns a 404 if the user doesn't exist or their profile is private.
     */
    public function show(string $username)
    {
        $user = User::where('username', $username)
            ->where('is_public', true)
            ->first();

        if (! $user) {
            abort(404);
        }

        return view('profile.show', [
            'user' => $user,
        ]);
    }
}
