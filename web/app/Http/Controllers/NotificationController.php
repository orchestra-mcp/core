<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get the unread notification count for the authenticated user (JSON).
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::forUser($request->user()->orchestraId())
            ->unread()
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Get recent notifications for the dropdown bell (JSON).
     */
    public function recent(Request $request): JsonResponse
    {
        $notifications = Notification::forUser($request->user()->orchestraId())
            ->orderByDesc('created_at')
            ->limit(10)
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

        return response()->json(['notifications' => $notifications]);
    }

    /**
     * Mark a single notification as read (JSON).
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = Notification::forUser($request->user()->orchestraId())
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read (JSON).
     */
    public function markAllRead(Request $request): JsonResponse
    {
        Notification::forUser($request->user()->orchestraId())
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Delete a single notification (JSON).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = Notification::forUser($request->user()->orchestraId())
            ->findOrFail($id);

        $notification->delete();

        return response()->json(['success' => true]);
    }
}
