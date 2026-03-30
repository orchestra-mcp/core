<x-layouts.app title="Team Members">
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-[14px] font-semibold" style="color: var(--color-text-primary);">Team</h1>
            <p class="mt-1 text-[13px]" style="color: var(--color-text-muted);">Manage team members and their access.</p>
        </div>
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-[12px] font-medium cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Invite Member
        </button>
    </div>

    <div class="rounded-lg p-12 text-center" style="border: 1px solid var(--color-border); background: var(--color-bg-sidebar);">
        <div class="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style="background: var(--color-bg-surface);">
            <svg class="w-6 h-6" style="color: var(--color-text-faint);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
        </div>
        <p class="text-[13px]" style="color: var(--color-text-muted);">No team members yet. Invite your first team member to get started.</p>
    </div>
</x-layouts.app>
