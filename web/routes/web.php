<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
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
    Route::get('/billing', fn () => view('dashboard.billing'))->name('dashboard.billing');
});
