<?php

use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\GithubAuthController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ShareController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/', fn () => view('pages.home'))->name('home');
Route::get('/pricing', fn () => view('pages.pricing'))->name('pricing');
Route::get('/features', fn () => view('pages.features'))->name('features');
Route::get('/docs', [DocsController::class, 'index'])->name('docs.index');
Route::get('/docs/{slug}', [DocsController::class, 'show'])->name('docs.show');
// Keep legacy named route for backward compatibility (redirects to index)
Route::get('/docs-legacy', fn () => redirect()->route('docs.index'))->name('docs');

// SEO
Route::get('/sitemap.xml', function () {
    $urls = [
        ['loc' => url('/'), 'priority' => '1.0', 'changefreq' => 'weekly'],
        ['loc' => url('/features'), 'priority' => '0.8', 'changefreq' => 'monthly'],
        ['loc' => url('/pricing'), 'priority' => '0.8', 'changefreq' => 'monthly'],
        ['loc' => url('/docs'), 'priority' => '0.7', 'changefreq' => 'weekly'],
        ['loc' => url('/login'), 'priority' => '0.5', 'changefreq' => 'yearly'],
        ['loc' => url('/register'), 'priority' => '0.6', 'changefreq' => 'yearly'],
    ];
    $xml = '<?xml version="1.0" encoding="UTF-8"?>';
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    foreach ($urls as $url) {
        $xml .= '<url>';
        $xml .= '<loc>' . $url['loc'] . '</loc>';
        $xml .= '<changefreq>' . $url['changefreq'] . '</changefreq>';
        $xml .= '<priority>' . $url['priority'] . '</priority>';
        $xml .= '</url>';
    }
    $xml .= '</urlset>';
    return response($xml, 200, ['Content-Type' => 'application/xml']);
})->name('sitemap');

Route::get('/robots.txt', function () {
    $content = "User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /onboarding\nSitemap: " . url('/sitemap.xml');
    return response($content, 200, ['Content-Type' => 'text/plain']);
})->name('robots');

// Public user profiles
Route::get('/@{username}', [ProfileController::class, 'show'])->name('profile.show');

// Shared documents (public, no auth required for public/private visibility)
Route::get('/share/{token}', [ShareController::class, 'show'])->name('share.show');
Route::post('/share/{token}', [ShareController::class, 'show'])->name('share.password');

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

// Dashboard (auth + onboarded) — Inertia/React
Route::middleware(['auth', 'onboarded'])->prefix('dashboard')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/tokens', [DashboardController::class, 'tokens'])->name('dashboard.tokens');
    Route::get('/agents', [DashboardController::class, 'agents'])->name('dashboard.agents');
    Route::get('/connections', [DashboardController::class, 'connections'])->name('dashboard.connections');
    Route::get('/settings', [DashboardController::class, 'settings'])->name('dashboard.settings');
    Route::get('/billing', [DashboardController::class, 'billing'])->name('dashboard.billing');

    // Notification API routes (JSON) — must be registered before the catch-all /notifications view
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
    Route::get('/notifications/recent', [NotificationController::class, 'recent'])->name('notifications.recent');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.mark-read');
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead'])->name('notifications.mark-all-read');
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy'])->name('notifications.destroy');

    // Notification center page (view)
    Route::get('/notifications', [DashboardController::class, 'notifications'])->name('dashboard.notifications');
});
