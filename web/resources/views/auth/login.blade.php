<x-layouts.guest>
    <h2 class="text-xl font-semibold text-brand-text text-center mb-6">Sign in to your account</h2>

    @if (session('status'))
        <div class="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
            {{ session('status') }}
        </div>
    @endif

    <form method="POST" action="{{ route('login') }}" class="space-y-5">
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

        {{-- Password --}}
        <div>
            <label for="password" class="block text-sm font-medium text-brand-text-secondary mb-1">Password</label>
            <input type="password" id="password" name="password" required
                   class="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan"
                   placeholder="Password">
            @error('password')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Remember + Forgot --}}
        <div class="flex items-center justify-between">
            <label class="flex items-center gap-2">
                <input type="checkbox" name="remember" class="rounded border-brand-border bg-brand-dark text-brand-cyan focus:ring-brand-cyan/50">
                <span class="text-sm text-brand-text-secondary">Remember me</span>
            </label>
            <a href="{{ route('password.request') }}" class="text-sm text-brand-cyan hover:text-brand-purple transition-colors">Forgot password?</a>
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2.5 gradient-bg text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
            Login
        </button>

        {{-- Divider --}}
        <div class="relative">
            <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-brand-border"></div>
            </div>
            <div class="relative flex justify-center text-xs">
                <span class="bg-brand-card px-2 text-brand-text-secondary">or</span>
            </div>
        </div>

        {{-- GitHub OAuth --}}
        <a href="{{ route('auth.github') }}"
           class="w-full py-2.5 bg-transparent border border-brand-border text-brand-text text-sm font-medium rounded-lg hover:border-brand-cyan/50 hover:text-brand-cyan transition-colors inline-flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            Login with GitHub
        </a>
    </form>

    <p class="mt-6 text-center text-sm text-brand-text-secondary">
        Don't have an account?
        <a href="{{ route('register') }}" class="text-brand-cyan hover:text-brand-purple font-medium transition-colors">Register</a>
    </p>
</x-layouts.guest>
