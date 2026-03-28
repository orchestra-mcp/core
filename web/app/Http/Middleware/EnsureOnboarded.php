<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboarded
{
    /**
     * Handle an incoming request.
     *
     * Redirect to onboarding if the user has not completed it.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->onboarding_completed) {
            return redirect()->route('onboarding.company');
        }

        return $next($request);
    }
}
