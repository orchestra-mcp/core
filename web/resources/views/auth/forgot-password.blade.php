<x-layouts.guest>
    <h2 class="text-xl font-semibold text-brand-text text-center mb-2">Forgot your password?</h2>
    <p class="text-sm text-brand-text-secondary text-center mb-6">Enter your email and we'll send you a reset link.</p>

    @if (session('status'))
        <div class="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
            {{ session('status') }}
        </div>
    @endif

    <form method="POST" action="{{ route('password.email') }}" class="space-y-5">
        @csrf

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-medium text-brand-text-secondary mb-1">Email</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required autofocus
                   class="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan"
                   placeholder="you@example.com">
            @error('email')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2.5 gradient-bg text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
            Send Reset Link
        </button>
    </form>

    <p class="mt-6 text-center text-sm text-brand-text-secondary">
        Remember your password?
        <a href="{{ route('login') }}" class="text-brand-cyan hover:text-brand-purple font-medium transition-colors">Back to login</a>
    </p>
</x-layouts.guest>
