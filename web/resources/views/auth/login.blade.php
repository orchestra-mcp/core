<x-layouts.guest>
    <h2 class="text-xl font-semibold text-gray-900 text-center mb-6">Sign in to your account</h2>

    <form method="POST" action="#" class="space-y-4">
        @csrf
        <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" id="email" name="email" required
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                   placeholder="you@example.com">
        </div>
        <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" id="password" name="password" required
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                   placeholder="Password">
        </div>
        <button type="submit"
                class="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            Sign In
        </button>
    </form>

    <p class="mt-4 text-center text-sm text-gray-600">
        Don't have an account?
        <a href="{{ route('register') }}" class="text-indigo-600 hover:text-indigo-500 font-medium">Register</a>
    </p>
</x-layouts.guest>
