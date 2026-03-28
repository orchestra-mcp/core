<x-layouts.guest>
    <h2 class="text-lg font-medium text-[#ededed] text-center mb-2">Forgot your password?</h2>
    <p class="text-sm text-[#999999] text-center mb-6">Enter your email and we'll send you a reset link.</p>

    @if (session('status'))
        <div class="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-sm text-emerald-400">
            {{ session('status') }}
        </div>
    @endif

    <form method="POST" action="{{ route('password.email') }}" class="space-y-4">
        @csrf

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-normal text-[#999999] mb-1.5">Email address</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required autofocus
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
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

    <p class="mt-6 text-center text-sm text-[#555555]">
        Remember your password?
        <a href="{{ route('login') }}" class="text-[#ededed] hover:text-[#00E5FF] font-medium transition-colors">Back to sign in</a>
    </p>
</x-layouts.guest>
