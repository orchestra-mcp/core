<x-layouts.guest title="Forgot Password">
    <h2 class="text-lg font-medium text-[--color-text-primary] text-center mb-2">Forgot your password?</h2>
    <p class="text-sm text-[--color-text-secondary] text-center mb-6">Enter your email and we'll send you a reset link.</p>

    @if (session('status'))
        <div class="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-sm text-emerald-400">
            {{ session('status') }}
        </div>
    @endif

    <form method="POST" action="{{ route('password.email') }}" class="space-y-4">
        @csrf

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-normal text-[--color-text-secondary] mb-1.5">Email address</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required autofocus
                   class="w-full px-3 py-2 bg-[--color-bg-input] border border-[--color-border] rounded-md text-sm text-[--color-text-primary] placeholder-[--color-text-faint] focus:outline-none focus:ring-1 focus:ring-brand-purple/40 focus:border-brand-purple transition-colors"
                   placeholder="you@example.com">
            @error('email')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
            Send Reset Link
        </button>
    </form>

    <p class="mt-6 text-center text-sm text-[--color-text-faint]">
        Remember your password?
        <a href="{{ route('login') }}" wire:navigate class="text-[--color-text-primary] hover:text-brand-purple font-medium transition-colors">Back to sign in</a>
    </p>
</x-layouts.guest>
