{{-- Toast Notification System (Alpine.js) --}}
<div
    x-data="toastNotifications()"
    x-on:show-toast.window="addToast($event.detail)"
    class="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    style="max-width: 380px; width: auto;"
>
    <template x-for="toast in toasts" :key="toast.id">
        <div
            x-show="toast.visible"
            x-transition:enter="transition ease-out duration-300"
            x-transition:enter-start="opacity-0 translate-x-8"
            x-transition:enter-end="opacity-100 translate-x-0"
            x-transition:leave="transition ease-in duration-200"
            x-transition:leave-start="opacity-100 translate-x-0"
            x-transition:leave-end="opacity-0 translate-x-8"
            class="pointer-events-auto bg-[--color-bg-surface] border border-[--color-border] rounded-lg shadow-2xl shadow-black/60 overflow-hidden cursor-pointer"
            @click="handleToastClick(toast)"
        >
            <div class="flex gap-3 p-4">
                {{-- Type icon --}}
                <div
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    :class="getToastIconBg(toast.type_color || 'gray')"
                >
                    <svg class="w-4 h-4" :class="getToastIconColor(toast.type_color || 'gray')" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="getToastIconPath(toast.type || 'info')"></path>
                    </svg>
                </div>

                {{-- Content --}}
                <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-medium text-[--color-text-primary] truncate" x-text="toast.title"></p>
                    <p x-show="toast.body" class="text-xs text-[--color-text-secondary] mt-0.5 line-clamp-2" x-text="toast.body"></p>
                </div>

                {{-- Close button --}}
                <button
                    @click.stop="removeToast(toast.id)"
                    class="text-[--color-text-faint] hover:text-[--color-text-secondary] transition-colors shrink-0 mt-0.5"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            {{-- Auto-dismiss progress bar --}}
            <div class="h-0.5 bg-[--color-bg-card]">
                <div
                    class="h-full transition-all ease-linear"
                    :class="getToastProgressColor(toast.type_color || 'gray')"
                    :style="`width: ${toast.progress}%; transition-duration: 100ms;`"
                ></div>
            </div>
        </div>
    </template>
</div>
