<x-layouts.guest>
    <h2 class="text-xl font-semibold text-brand-text text-center mb-6">Reset your password</h2>

    <form method="POST" action="{{ route('password.update') }}" class="space-y-5">
        @csrf

        {{-- Token --}}
        <input type="hidden" name="token" value="{{ $token }}">

        {{-- Email --}}
        <div>
            <label for="email" class="block text-sm font-medium text-brand-text-secondary mb-1">Email</label>
            <input type="email" id="email" name="email" value="{{ old('email', $email) }}" required autofocus
                   class="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan"
                   placeholder="you@example.com">
            @error('email')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Password --}}
        <div>
            <label for="password" class="block text-sm font-medium text-brand-text-secondary mb-1">New Password</label>
            <input type="password" id="password" name="password" required
                   class="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan"
                   placeholder="New password">
            @error('password')
                <p class="mt-1 text-sm text-red-400">{{ $message }}</p>
            @enderror
        </div>

        {{-- Confirm Password --}}
        <div>
            <label for="password_confirmation" class="block text-sm font-medium text-brand-text-secondary mb-1">Confirm Password</label>
            <input type="password" id="password_confirmation" name="password_confirmation" required
                   class="w-full px-3 py-2.5 bg-brand-dark border border-brand-border rounded-lg text-sm text-brand-text placeholder-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan"
                   placeholder="Confirm new password">
        </div>

        {{-- Submit --}}
        <button type="submit"
                class="w-full py-2.5 gradient-bg text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
            Reset Password
        </button>
    </form>

    <p class="mt-6 text-center text-sm text-brand-text-secondary">
        Remember your password?
        <a href="{{ route('login') }}" class="text-brand-cyan hover:text-brand-purple font-medium transition-colors">Back to login</a>
    </p>
</x-layouts.guest>
