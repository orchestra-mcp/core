import { useState, type FC, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

const LoginScreen: FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success, AuthProvider will update state and App will show the main UI
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/logo.svg"
            alt="Orchestra"
            className="h-14 w-14"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">
              Orchestra Desktop
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Sign in to your Orchestra account
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-zinc-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-zinc-400"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600">
          Connecting to local Supabase at localhost:8000
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
