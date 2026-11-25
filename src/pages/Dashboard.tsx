
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const currencies = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "SGD", name: "Singapore Dollar" },
];

type Theme = "light" | "dark" | "system";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [currency, setCurrency] = useState("INR");
  const [theme, setTheme] = useState<Theme>("system");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  // Load saved preferences when the profile becomes available.
  useEffect(() => {
    if (profile) {
      setCurrency(profile.default_currency);
      setTheme(profile.theme as Theme);
    }
  }, [profile]);

  async function savePreferences() {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          default_currency: currency,
          theme,
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();

      setMessageType("success");
      setMessage("Your preferences have been saved.");
    } catch (err) {
      setMessageType("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Unable to save your preferences."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      navigate("/login", { replace: true });
    } catch (err) {
      setMessageType("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Unable to log out. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-indigo-600">
            SplitMate
          </h1>

          <div className="flex items-center gap-3">
            <Link
              to="/groups"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Manage Groups
            </Link>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="py-10">

          {/* Welcome section */}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome, {profile?.full_name || user?.email}
          </h2>

          <p className="mt-2 text-gray-500">
            Your expense-sharing workspace is ready.
          </p>

          {/* Main sections */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">

            {/* Account information */}
            <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Account information
              </h3>

              <div className="mt-5 space-y-4 text-sm">

                <div>
                  <p className="text-gray-500">Full name</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {profile?.full_name || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Email address</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {user?.email}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">User ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-gray-900 dark:text-white">
                    {user?.id}
                  </p>
                </div>

              </div>
            </div>

            {/* Preferences */}
            <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preferences
              </h3>

              <div className="mt-5 space-y-5">

                <div>
                  <label
                    htmlFor="default-currency"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Default currency
                  </label>

                  <select
                    id="default-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {currencies.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="appearance-theme"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Appearance preference
                  </label>

                  <select
                    id="appearance-theme"
                    value={theme}
                    onChange={(e) =>
                      setTheme(e.target.value as Theme)
                    }
                    className="w-full rounded-lg border bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="system">System default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <button
                  onClick={savePreferences}
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save preferences"}
                </button>

                {message && (
                  <p
                    role={messageType === "error" ? "alert" : "status"}
                    className={`text-sm ${
                      messageType === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {message}
                  </p>
                )}

              </div>
            </div>

          </div>

          {/* Groups shortcut */}
          <div className="mt-8 rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Expense-sharing groups
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Create groups, invite people and manage shared expenses.
                </p>
              </div>

              <Link
                to="/groups"
                className="rounded-lg border border-indigo-600 px-5 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-gray-800"
              >
                View Groups →
              </Link>
            </div>
          </div>

          {/* Future dashboard features */}
          <div className="mt-6 rounded-xl border border-dashed bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Expense dashboard coming soon
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Your balances, expenses, settlements and analytics will appear here.
            </p>
          </div>

        </main>
      </div>
    </div>
  );
}
