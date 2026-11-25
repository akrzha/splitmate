
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import AddExpenseDialog from "../components/expenses/AddExpenseDialog";
import ExpenseList from "../components/expenses/ExpenseList";
import type { ExpenseWithSplits } from "../features/expenses/expenseTypes";

interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function GroupDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseWithSplits | null>(null);
  const loadedGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function fetchGroupDetails() {
      if (!id || !userId) return;

      setLoading(loadedGroupIdRef.current !== id);
      setError("");

      try {
        const { data: groupData, error: groupError } =
          await supabase
            .from("groups")
            .select("id, name, description, currency, created_at")
            .eq("id", id)
            .single();

        if (groupError) throw groupError;

        setGroup(groupData);

        const { data: memberData, error: memberError } =
          await supabase
            .from("group_members")
            .select("user_id, role, joined_at")
            .eq("group_id", id)
            .order("joined_at", { ascending: true });

        if (memberError) throw memberError;

        const userIds = (memberData ?? []).map(
          (member) => member.user_id
        );

        const { data: profiles, error: profileError } =
          userIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds)
            : { data: [], error: null };

        if (profileError) throw profileError;

        const profileMap = new Map(
          (profiles ?? []).map((profile) => [
            profile.id,
            profile.full_name,
          ])
        );

        setMembers(
          (memberData ?? []).map((member) => ({
            ...member,
            full_name: profileMap.get(member.user_id) ?? null,
          }))
        );

        setRole(
          memberData?.find((member) => member.user_id === userId)
            ?.role ?? ""
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load group details."
        );
      } finally {
        loadedGroupIdRef.current = id;
        setLoading(false);
      }
    }

    fetchGroupDetails();
  }, [groupRefreshKey, id, userId]);

  async function createInvitation() {
    if (!id || !user) return;

    setInviteLoading(true);
    setError("");
    setMessage("");
    setInviteLink("");

    try {
      const token = generateToken();
      const tokenHash = await hashToken(token);

      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: insertError } = await supabase
        .from("group_invitations")
        .insert({
          group_id: id,
          token_hash: tokenHash,
          invited_by: user.id,
          expires_at: expiresAt,
        });

      if (insertError) throw insertError;

      const link =
        `${window.location.origin}/accept-invitation?token=${token}`;

      setInviteLink(link);
      setMessage("Invitation link created. It expires in 7 days.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create an invitation."
      );
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Invitation link copied.");
    } catch {
      setError("Unable to copy the link. Please copy it manually.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-10 text-center dark:bg-gray-950">
        Loading group...
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-gray-50 p-10 dark:bg-gray-950">
        <p role="alert" className="text-red-600">{error}</p>
        <Link to="/groups" className="mt-4 inline-block text-indigo-600">
          Back to groups
        </Link>
      </div>
    );
  }

  if (!group) return null;

  const canInvite = role === "owner" || role === "admin";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/groups"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to groups
        </Link>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {group.description || "No description added."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {group.currency}
              </span>
              <button
                type="button"
                onClick={() => setAddExpenseOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={17} aria-hidden="true" />
                Add expense
              </button>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Members ({members.length})
              </h2>
            </div>

            <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.full_name || "Unnamed member"}
                      {member.user_id === user?.id && " (You)"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {canInvite && (
            <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Invite members
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Create a secure invitation link that expires after 7 days.
              </p>

              <button
                onClick={createInvitation}
                disabled={inviteLoading}
                className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {inviteLoading ? "Generating..." : "Generate invitation link"}
              </button>

              {inviteLink && (
                <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="break-all text-sm text-gray-700 dark:text-gray-300">
                    {inviteLink}
                  </p>
                  <button
                    onClick={copyInvitation}
                    className="mt-3 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Copy invitation link
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <p role="status" className="mt-4 text-sm text-green-600 dark:text-green-400">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Group expenses
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Shared costs and participant breakdowns.
              </p>
            </div>
          </div>
          {id && (
            <ExpenseList
              groupId={id}
              refreshKey={expenseRefreshKey}
              onEdit={setEditingExpense}
              onChanged={() => {
                setExpenseRefreshKey((key) => key + 1);
                setGroupRefreshKey((key) => key + 1);
              }}
            />
          )}
        </section>
      </div>
      <AddExpenseDialog
        groupId={group.id}
        groupCurrency={group.currency}
        isOpen={addExpenseOpen || editingExpense !== null}
        expense={editingExpense}
        onClose={() => {
          setAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        onSaved={() => setExpenseRefreshKey((key) => key + 1)}
      />
    </div>
  );
}
