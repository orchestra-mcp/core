<x-layouts.app title="Team Members">
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-semibold text-[#ededed]">Team</h1>
            <p class="mt-1 text-sm text-[#999999]">Manage team members and their access.</p>
        </div>
        <button class="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Invite Member
        </button>
    </div>

    <div class="bg-[#252525] rounded-lg border border-[#333333] p-12 text-center">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-[#2a2a2a] mx-auto mb-4">
            <svg class="w-6 h-6 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
        </div>
        <p class="text-sm text-[#999999]">No team members yet. Invite your first team member to get started.</p>
    </div>
</x-layouts.app>
