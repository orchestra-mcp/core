<?php

namespace App\Providers;

use App\Services\SupabaseAuthService;
use App\Services\SupabaseService;
use App\Services\TokenService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TokenService::class);
        $this->app->singleton(SupabaseService::class);
        $this->app->singleton(SupabaseAuthService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
