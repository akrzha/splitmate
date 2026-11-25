
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      "If an account exists for this email, a password reset link will be sent."
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 dark:border-gray-800 dark:bg-gray-900">

        <Link to="/login" className="text-2xl font-bold text-indigo-600">
          SplitMate
        </Link>

        <h1 className="mt-8 text-2xl font-bold dark:text-white">
          Forgot password?
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Enter your email address to receive a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border p-3 dark:border-gray-700 dark:bg-gray-800"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

        </form>

        <Link
          to="/login"
          className="mt-6 block text-center text-sm text-indigo-600"
        >
          Back to login
        </Link>

      </div>
    </div>
  );
}
