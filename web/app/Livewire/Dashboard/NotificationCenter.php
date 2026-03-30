<?php

namespace App\Livewire\Dashboard;

use App\Models\Notification;
use Livewire\Component;
use Livewire\WithPagination;

class NotificationCenter extends Component
{
    use WithPagination;

    public string $filter = 'all'; // all, unread, read

    public string $typeFilter = ''; // empty = all types

    public function updatingFilter(): void
    {
        $this->resetPage();
    }

    public function updatingTypeFilter(): void
    {
        $this->resetPage();
    }

    public function markAsRead(string $id): void
    {
        $notification = Notification::forUser(auth()->user()->orchestraId())
            ->find($id);

        if ($notification) {
            $notification->markAsRead();
        }
    }

    public function markAsUnread(string $id): void
    {
        $notification = Notification::forUser(auth()->user()->orchestraId())
            ->find($id);

        if ($notification) {
            $notification->markAsUnread();
        }
    }

    public function markAllRead(): void
    {
        Notification::forUser(auth()->user()->orchestraId())
            ->unread()
            ->update(['read_at' => now()]);
    }

    public function deleteNotification(string $id): void
    {
        Notification::forUser(auth()->user()->orchestraId())
            ->where('id', $id)
            ->delete();
    }

    public function render()
    {
        $query = Notification::forUser(auth()->user()->orchestraId())
            ->orderByDesc('created_at');

        // Apply read/unread filter
        if ($this->filter === 'unread') {
            $query->unread();
        } elseif ($this->filter === 'read') {
            $query->read();
        }

        // Apply type filter
        if ($this->typeFilter !== '') {
            $query->ofType($this->typeFilter);
        }

        $notifications = $query->paginate(20);

        $unreadCount = Notification::forUser(auth()->user()->orchestraId())
            ->unread()
            ->count();

        return view('livewire.dashboard.notification-center', [
            'notifications' => $notifications,
            'unreadCount' => $unreadCount,
            'types' => Notification::TYPES,
        ]);
    }
}
