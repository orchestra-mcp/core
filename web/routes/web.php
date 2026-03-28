<?php

use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\GithubAuthController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/', fn () => view('pages.home'))->name('home');
Route::get('/pricing', fn () => view('pages.pricing'))->name('pricing');
Route::get('/features', fn () => view('pages.features'))->name('features');
Route::get('/docs/{slug?}', fn () => view('pages.docs'))->name('docs');

// Auth (guest only)
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
    Route::get('/register', [RegisterController::class, 'show'])->name('register');
    Route::post('/register', [RegisterController::class, 'store']);

    // Password Reset
    Route::get('/forgot-password', [ForgotPasswordController::class, 'show'])->name('password.request');
    Route::post('/forgot-password', [ForgotPasswordController::class, 'store'])->name('password.email');
    Route::get('/reset-password/{token}', [ResetPasswordController::class, 'show'])->name('password.reset');
    Route::post('/reset-password', [ResetPasswordController::class, 'store'])->name('password.update');

    // GitHub OAuth
    Route::get('/auth/github', [GithubAuthController::class, 'redirect'])->name('auth.github');
    Route::get('/auth/callback/github', [GithubAuthController::class, 'callback']);
});

// Logout (auth only)
Route::post('/logout', [LoginController::class, 'destroy'])->name('logout')->middleware('auth');

// Onboarding (auth only, not yet onboarded)
Route::middleware(['auth'])->prefix('onboarding')->group(function () {
    Route::get('/company', \App\Livewire\Onboarding\CompanySetup::class)->name('onboarding.company');
    Route::get('/team', \App\Livewire\Onboarding\TeamSetup::class)->name('onboarding.team');
    Route::get('/connect', \App\Livewire\Onboarding\ConnectClaude::class)->name('onboarding.connect');
});

// Dashboard (auth + onboarded)
Route::middleware(['auth', 'onboarded'])->prefix('dashboard')->group(function () {
    Route::get('/', fn () => view('dashboard.index'))->name('dashboard');
    Route::get('/tokens', fn () => view('dashboard.tokens'))->name('dashboard.tokens');
    Route::get('/team', fn () => view('dashboard.team'))->name('dashboard.team');
    Route::get('/usage', fn () => view('dashboard.usage'))->name('dashboard.usage');
    Route::get('/connections', fn () => view('dashboard.connections'))->name('dashboard.connections');
    Route::get('/notifications', fn () => view('dashboard.notifications'))->name('dashboard.notifications');
    Route::get('/settings', fn () => view('dashboard.settings'))->name('dashboard.settings');
    Route::get('/billing', fn () => view('dashboard.billing'))->name('dashboard.billing');
});
