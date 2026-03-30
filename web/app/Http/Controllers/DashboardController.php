<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\McpToken;
use App\Models\Notification;
use App\Models\TeamMember;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Dashboard overview page.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $orchestraId = $user->orchestraId();

        $totalTokens = McpToken::where('user_id', $orchestraId)
            ->whereNull('revoked_at')
            ->count();

        $totalAgents = $user->organization_id
            ? Agent::where('organization_id', $user->organization_id)->count()
            : 0;

        $totalTeamMembers = TeamMember::where('user_id', $orchestraId)->count();

        $totalTasks = McpToken::where('user_id', $orchestraId)
            ->whereNull('revoked_at')
            ->sum('usage_count') ?? 0;

        $recentActivity = McpToken::where('user_id', $orchestraId)
            ->whereNotNull('last_used_at')
            ->orderByDesc('last_used_at')
            ->limit(10)
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'description' => "Token \"{$token->name}\" was used",
                'time' => $token->last_used_at->diffForHumans(),
                'prefix' => $token->token_prefix,
            ]);

        return Inertia::render('Dashboard/Index', [
            'stats' => [
                'totalTokens' => $totalTokens,
                'totalAgents' => $totalAgents,
                'totalTeamMembers' => $totalTeamMembers,
                'totalTasks' => (int) $totalTasks,
            ],
            'recentActivity' => $recentActivity,
        ]);
    }

    /**
     * Agents list page.
     */
    public function agents(Request $request): Response
    {
        $user = $request->user();

        $agents = $user->organization_id
            ? Agent::where('organization_id', $user->organization_id)
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (Agent $agent) => [
                    'id' => $agent->id,
                    'name' => $agent->name,
                    'slug' => $agent->slug,
                    'role' => $agent->role,
                    'type' => $agent->type,
                    'status' => $agent->status,
                    'avatar_color' => $agent->avatar_color,
                    'skills' => $agent->skills,
                    'created_at' => $agent->created_at?->toISOString(),
                ])
            : collect([]);

        return Inertia::render('Dashboard/Agents', [
            'agents' => $agents,
        ]);
    }

    /**
     * MCP Tokens page.
     */
    public function tokens(Request $request): Response
    {
        $user = $request->user();
        $orchestraId = $user->orchestraId();

        $tokens = McpToken::where('user_id', $orchestraId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (McpToken $token) => [
                'id' => $token->id,
                'name' => $token->name,
                'token_prefix' => $token->token_prefix,
                'scopes' => $token->scopes,
                'last_used_at' => $token->last_used_at?->diffForHumans(),
                'expires_at' => $token->expires_at?->toISOString(),
                'revoked_at' => $token->revoked_at?->toISOString(),
                'created_at' => $token->created_at?->toISOString(),
                'is_valid' => $token->isValid(),
            ]);

        return Inertia::render('Dashboard/Tokens', [
            'tokens' => $tokens,
        ]);
    }

    /**
     * Settings page.
     */
    public function settings(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard/Settings', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'timezone' => $user->timezone ?? 'UTC',
                'language' => $user->language ?? 'en',
                'notification_preferences' => $user->notification_preferences ?? [],
            ],
        ]);
    }

    /**
     * Billing page.
     */
    public function billing(Request $request): Response
    {
        $user = $request->user();
        $org = $user->organization;

        return Inertia::render('Dashboard/Billing', [
            'plan' => $org?->plan ?? 'free',
            'organization' => $org ? [
                'name' => $org->name,
                'stripe_customer_id' => $org->stripe_customer_id,
                'stripe_subscription_id' => $org->stripe_subscription_id,
            ] : null,
        ]);
    }

    /**
     * Notifications page.
     */
    public function notifications(Request $request): Response
    {
        $user = $request->user();
        $orchestraId = $user->orchestraId();

        $notifications = Notification::forUser($orchestraId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (Notification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'title' => $n->title,
                'body' => $n->body,
                'action_url' => $n->action_url,
                'read' => $n->isRead(),
                'type_color' => $n->getTypeColor(),
                'created_at' => $n->created_at->diffForHumans(),
            ]);

        return Inertia::render('Dashboard/Notifications', [
            'notifications' => $notifications,
        ]);
    }

    /**
     * Connections page.
     */
    public function connections(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard/Connections', [
            'connectedAccounts' => $user->connected_accounts ?? [],
        ]);
    }
}
