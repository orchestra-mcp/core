<?php

use Illuminate\Support\Facades\Route;

// Public
Route::get('/', fn () => view('pages.home'))->name('home');
Route::get('/pricing', fn () => view('pages.pricing'))->name('pricing');
Route::get('/features', fn () => view('pages.features'))->name('features');
Route::get('/docs/{slug?}', fn () => view('pages.docs'))->name('docs');

// Auth (placeholder views)
Route::get('/login', fn () => view('auth.login'))->name('login');
Route::get('/register', fn () => view('auth.register'))->name('register');

// Dashboard (placeholder)
Route::middleware('auth')->prefix('dashboard')->group(function () {
    Route::get('/', fn () => view('dashboard.index'))->name('dashboard');
    Route::get('/tokens', fn () => view('dashboard.tokens'))->name('dashboard.tokens');
    Route::get('/team', fn () => view('dashboard.team'))->name('dashboard.team');
    Route::get('/billing', fn () => view('dashboard.billing'))->name('dashboard.billing');
});
