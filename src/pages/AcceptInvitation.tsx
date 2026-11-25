
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

async function hashToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function AcceptInvitation() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!user || !token) return;

    setSubmitting(true);
    setError("");

    try {
      const tokenHash = await hashToken(token);

      const { data, error: rpcError } = await supabase.rpc(
        "accept_group_invitation",
        { p_token_hash: tokenHash }
      );

      if (rpcError) throw rpcError;

      if (typeof data !== "string") {
        throw new Error("The invitation could not be accepted.");
      }

      navigate(`/groups/${data}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to accept this invitation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const returnPath =
    `/accept-invitation?token=${encodeURIComponent(token)}`;

  if (authLoading) {
    return <div className="p-10 text-center">Checking your account...</div>;
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-10 text-center dark:bg-gray-950">
        <p className="text-red-600">This invitation link is invalid.</p>
        <Link to="/groups" className="mt-4 inline-block text-indigo-600">
          Go to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Join a SplitMate group
        </h1>

        <p className="mt-3 text-sm text-gray-500">
          Accept this invitation to join the group and start sharing expenses.
        </p>

        {!user ? (
          <div className="mt-6 space-y-3">
            <Link
              to={`/login?redirect=${encodeURIComponent(returnPath)}`}
              className="block rounded-lg bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-700"
            >
              Login to accept invitation
            </Link>

            <p className="text-sm text-gray-500">
              New to SplitMate? Create an account first, then open this invitation link again.
            </p>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Joining group..." : "Accept invitation"}
          </button>
        )}

        {error && (
          <p role="alert" className="mt-5 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
