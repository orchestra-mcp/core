<x-layouts.guest>
    <h2 class="text-lg font-medium text-[#ededed] text-center mb-6">Create your account</h2>

    <form method="POST" action="{{ route('register') }}" class="space-y-4">
        @csrf

        {{-- Full Name --}}
        <div>
            <label for="name" class="block text-sm font-normal text-[#999999] mb-1.5">Full Name</label>
            <input type="text" id="name" name="name" value="{{ old('name') }}" required autofocus
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="Your full name">
            @error('name')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-normal text-[#999999] mb-1.5">Email address</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="you@example.com">
            @error('email')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Password --}}
        <div>
            <label for="password" class="block text-sm font-normal text-[#999999] mb-1.5">Password</label>
            <input type="password" id="password" name="password" required
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="Create a password">
            @error('password')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Confirm Password --}}
        <div>
            <label for="password_confirmation" class="block text-sm font-normal text-[#999999] mb-1.5">Confirm Password</label>
            <input type="password" id="password_confirmation" name="password_confirmation" required
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="Confirm your password">
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
            Create Account
        </button>

        {{-- Divider --}}
        <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-[#333333]"></div>
            </div>
            <div class="relative flex justify-center text-xs">
                <span class="bg-[#252525] px-3 text-[#555555] uppercase tracking-wider text-[10px] font-medium">or continue with</span>
            </div>
        </div>

        {{-- GitHub OAuth --}}
        <a href="{{ route('auth.github') }}"
           class="w-full py-2 bg-[#202020] border border-[#333333] text-[#ededed] text-sm font-medium rounded-md hover:bg-[#2a2a2a] hover:border-[#444444] transition-colors inline-flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            GitHub
        </a>
    </form>

    <p class="mt-6 text-center text-sm text-[#555555]">
        Already have an account?
        <a href="{{ route('login') }}" class="text-[#ededed] hover:text-[#00E5FF] font-medium transition-colors">Sign In</a>
    </p>
</x-layouts.guest>
