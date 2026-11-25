
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const currencies = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "JPY",
  "SGD",
];

export default function CreateGroup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setError("Please log in before creating a group.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const groupId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from("groups")
        .insert({
          id: groupId,
          name: name.trim(),
          description: description.trim() || null,
          currency,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the group."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-xl">
        <Link
          to="/groups"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to groups
        </Link>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create a group
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Create a space to track shared expenses with others.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="group-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Group name
              </label>
              <input
                id="group-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Goa Trip, Flatmates"
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="group-description" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (optional)
              </label>
              <textarea
                id="group-description"
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group for?"
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="group-currency" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Default currency
              </label>
              <select
                id="group-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating group..." : "Create group"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
