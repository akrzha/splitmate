
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  role: string;
}

export default function Groups() {
  const { user } = useAuth();
  const userId = user?.id;

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchGroups() {
      if (!userId) return;

      setLoading(true);
      setError("");

      try {
        const { data: memberships, error: membershipError } =
          await supabase
            .from("group_members")
            .select("group_id, role")
            .eq("user_id", userId);

        if (membershipError) throw membershipError;

        const groupIds = (memberships ?? []).map(
          (membership) => membership.group_id
        );

        if (groupIds.length === 0) {
          setGroups([]);
          return;
        }

        const { data: groupData, error: groupError } =
          await supabase
            .from("groups")
            .select("id, name, description, currency, created_at")
            .in("id", groupIds)
            .order("created_at", { ascending: false });

        if (groupError) throw groupError;

        const roleMap = new Map(
          (memberships ?? []).map((membership) => [
            membership.group_id,
            membership.role,
          ])
        );

        setGroups(
          (groupData ?? []).map((group) => ({
            ...group,
            role: roleMap.get(group.id) ?? "member",
          }))
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your groups."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchGroups();
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Your Groups
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage your shared expense groups.
            </p>
          </div>

          <Link
            to="/groups/create"
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Create Group
          </Link>
        </div>

        {error && (
          <div role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-gray-500">Loading groups...</p>
        ) : groups.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              No groups yet
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Create your first group to start sharing expenses.
            </p>
            <Link
              to="/groups/create"
              className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create your first group
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-indigo-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </h2>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {group.role}
                  </span>
                </div>

                <p className="mt-3 min-h-10 text-sm text-gray-500">
                  {group.description || "No description added."}
                </p>

                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    {group.currency}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    View group →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link
            to="/dashboard"
            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
