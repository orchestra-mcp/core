{{-- Notification Bell Dropdown --}}
<div
    x-data="notificationBell()"
    x-init="init()"
    class="relative"
    @click.outside="open = false"
>
    {{-- Bell button --}}
    <button
        @click="toggle()"
        class="relative p-1.5 rounded-md transition-colors cursor-pointer"
        style="color: var(--color-text-muted);"
        onmouseover="this.style.color='var(--color-text-primary)'; this.style.background='var(--color-bg-card)';"
        onmouseout="this.style.color='var(--color-text-muted)'; this.style.background='';"
        title="Notifications"
    >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {{-- Unread badge --}}
        <span
            x-show="unreadCount > 0"
            x-text="unreadCount > 99 ? '99+' : unreadCount"
            x-transition
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none"
            x-cloak
        ></span>
    </button>

    {{-- Dropdown panel --}}
    <div
        x-show="open"
        x-transition:enter="transition ease-out duration-150"
        x-transition:enter-start="opacity-0 scale-95 translate-y-1"
        x-transition:enter-end="opacity-100 scale-100 translate-y-0"
        x-transition:leave="transition ease-in duration-100"
        x-transition:leave-start="opacity-100 scale-100 translate-y-0"
        x-transition:leave-end="opacity-0 scale-95 translate-y-1"
        class="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[480px] rounded-lg shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden"
        style="background: var(--color-bg-surface); border: 1px solid var(--color-border);"
        x-cloak
    >
        {{-- Header --}}
        <div class="flex items-center justify-between px-4 py-3 shrink-0" style="border-bottom: 1px solid var(--color-border);">
            <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">Notifications</h3>
            <button
                x-show="unreadCount > 0"
                @click="markAllRead()"
                class="text-xs hover:opacity-80 transition-opacity cursor-pointer"
                style="color: var(--color-brand-purple);"
            >
                Mark all as read
            </button>
        </div>

        {{-- Notification list --}}
        <div class="flex-1 overflow-y-auto overscroll-contain" style="max-height: 380px;">
            <template x-if="loading && notifications.length === 0">
                <div class="flex items-center justify-center py-12">
                    <svg class="animate-spin h-5 w-5" style="color: var(--color-text-muted);" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                </div>
            </template>

            <template x-if="!loading && notifications.length === 0">
                <div class="flex flex-col items-center justify-center py-12 px-4">
                    <svg class="w-10 h-10 mb-3" style="color: var(--color-border);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    <p class="text-sm" style="color: var(--color-text-muted);">No notifications yet</p>
                    <p class="text-xs mt-1" style="color: var(--color-text-faint);">You're all caught up!</p>
                </div>
            </template>

            <template x-for="notification in notifications" :key="notification.id">
                <a
                    :href="notification.action_url || '#'"
                    @click.prevent="handleNotificationClick(notification)"
                    class="flex gap-3 px-4 py-3 transition-colors cursor-pointer"
                    style="border-bottom: 1px solid var(--color-border-muted);"
                    onmouseover="this.style.background='var(--color-bg-card)';"
                    onmouseout="this.style.background='';"
                    :class="{ 'border-l-2 border-l-[--color-brand-purple]': !notification.read }"
                >
                    {{-- Type icon --}}
                    <div
                        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        :class="getTypeIconBg(notification.type_color)"
                    >
                        <svg class="w-4 h-4" :class="getTypeIconColor(notification.type_color)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="getTypeIconPath(notification.type)"></path>
                        </svg>
                    </div>

                    {{-- Content --}}
                    <div class="flex-1 min-w-0">
                        <p class="text-[13px] font-medium truncate" :class="notification.read ? 'text-[--color-text-secondary]' : 'text-[--color-text-primary]'" x-text="notification.title"></p>
                        <p x-show="notification.body" class="text-xs mt-0.5 line-clamp-2" style="color: var(--color-text-muted);" x-text="notification.body"></p>
                        <p class="text-[11px] mt-1" style="color: var(--color-text-faint);" x-text="notification.created_at"></p>
                    </div>

                    {{-- Unread dot --}}
                    <div x-show="!notification.read" class="w-2 h-2 rounded-full shrink-0 mt-2" style="background: var(--color-brand-purple);"></div>
                </a>
            </template>
        </div>

        {{-- Footer --}}
        <div class="px-4 py-2.5 shrink-0" style="border-top: 1px solid var(--color-border);">
            <a href="{{ route('dashboard.notifications') }}" wire:navigate class="text-xs font-medium hover:opacity-80 transition-opacity" style="color: var(--color-brand-purple);">
                View all notifications
            </a>
        </div>
    </div>
</div>
