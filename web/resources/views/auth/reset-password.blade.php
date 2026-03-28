<x-layouts.guest>
    <h2 class="text-lg font-medium text-[#ededed] text-center mb-6">Reset your password</h2>

    <form method="POST" action="{{ route('password.update') }}" class="space-y-4">
        @csrf

        {{-- Token --}}
        <input type="hidden" name="token" value="{{ $token }}">

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-normal text-[#999999] mb-1.5">Email address</label>
            <input type="email" id="email" name="email" value="{{ old('email', $email) }}" required autofocus
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="you@example.com">
            @error('email')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Password --}}
        <div>
            <label for="password" class="block text-sm font-normal text-[#999999] mb-1.5">New Password</label>
            <input type="password" id="password" name="password" required
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="New password">
            @error('password')
                <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Confirm Password --}}
        <div>
            <label for="password_confirmation" class="block text-sm font-normal text-[#999999] mb-1.5">Confirm Password</label>
            <input type="password" id="password_confirmation" name="password_confirmation" required
                   class="w-full px-3 py-2 bg-[#202020] border border-[#333333] rounded-md text-sm text-[#ededed] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF] transition-colors"
                   placeholder="Confirm new password">
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2 gradient-bg text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity cursor-pointer">
            Reset Password
        </button>
    </form>

    <p class="mt-6 text-center text-sm text-[#555555]">
        Remember your password?
        <a href="{{ route('login') }}" class="text-[#ededed] hover:text-[#00E5FF] font-medium transition-colors">Back to sign in</a>
    </p>
</x-layouts.guest>
