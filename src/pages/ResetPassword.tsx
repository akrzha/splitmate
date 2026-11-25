
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      setReady(Boolean(data.session) && !error);

      if (error) {
        setError("Your reset link is invalid or has expired.");
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.auth.signOut();
    navigate("/login?password_reset=1", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 dark:border-gray-800 dark:bg-gray-900">

        <Link to="/login" className="text-2xl font-bold text-indigo-600">
          SplitMate
        </Link>

        <h1 className="mt-8 text-2xl font-bold dark:text-white">
          Reset your password
        </h1>

        {!ready ? (
          <p className="mt-4 text-sm text-gray-500">
            {error || "Checking your password reset link..."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">

            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-lg border p-3 dark:border-gray-700 dark:bg-gray-800"
            />

            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border p-3 dark:border-gray-700 dark:bg-gray-800"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>

          </form>
        )}

      </div>
    </div>
  );
}
