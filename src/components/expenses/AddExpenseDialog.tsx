import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
  calculateSplits,
  type CalculatedSplit,
  derivePercentageValues,
  type SplitInput,
} from "../../features/expenses/expenseCalculations";
import {
  createExpense,
  updateExpense,
} from "../../features/expenses/expenseService";
import type {
  ExpenseParticipant,
  ExpenseWithSplits,
  SplitType,
} from "../../features/expenses/expenseTypes";
import {
  formatMinorUnits,
  formatMinorUnitsForInput,
  getCurrencyMinorDigits,
  parseAmountToMinor,
  parseDecimalToInteger,
} from "../../features/expenses/money";
import { supabase } from "../../lib/supabase";
import SplitBreakdown from "./SplitBreakdown";
import SplitTypeSelector from "./SplitTypeSelector";

interface GroupMember extends ExpenseParticipant {
  role: string;
}

interface AddExpenseDialogProps {
  groupId: string;
  groupCurrency: string;
  isOpen: boolean;
  expense: ExpenseWithSplits | null;
  onClose: () => void;
  onSaved: () => void;
}

const currencies = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"];
const categories = [
  "Food",
  "Transport",
  "Accommodation",
  "Groceries",
  "Entertainment",
  "Utilities",
  "Shopping",
  "Other",
];
const inputClassName =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-indigo-950";
const labelClassName =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function todayAsDateInput(): string {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000
  );
  return localDate.toISOString().slice(0, 10);
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatBasisPoints(value: number): string {
  const basisPoints = BigInt(value);
  return `${basisPoints / 100n}.${(basisPoints % 100n)
    .toString()
    .padStart(2, "0")}`;
}

export default function AddExpenseDialog({
  groupId,
  groupCurrency,
  isOpen,
  expense,
  onClose,
  onSaved,
}: AddExpenseDialogProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(groupCurrency);
  const [paidBy, setPaidBy] = useState("");
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayAsDateInput);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function loadMembers() {
      setMembersLoading(true);
      setMembersError("");
      setFormError("");
      setMembers([]);
      setPaidBy("");
      setSelectedIds([]);
      setDescription(expense?.description ?? "");
      setAmount(
        expense
          ? formatMinorUnitsForInput(expense.amount_minor, expense.currency)
          : ""
      );
      setCurrency(expense?.currency ?? groupCurrency);
      setCategory(expense?.category?.toLowerCase() ?? "");
      setExpenseDate(expense?.expense_date ?? todayAsDateInput());
      setSplitType(expense?.expense_splits[0]?.split_type ?? "equal");
      setSplitValues({});

      try {
        const { data: memberData, error: memberError } = await supabase
          .from("group_members")
          .select("user_id, role")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true });

        if (memberError) throw memberError;

        const userIds = (memberData ?? []).map((member) => member.user_id);
        const { data: profiles, error: profileError } =
          userIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds)
            : { data: [], error: null };

        if (profileError) throw profileError;
        if (!active) return;

        const names = new Map(
          (profiles ?? []).map((profile) => [profile.id, profile.full_name])
        );
        const loadedMembers = (memberData ?? []).map((member) => ({
          user_id: member.user_id,
          role: member.role,
          full_name: names.get(member.user_id) || "Unnamed member",
        }));
        setMembers(loadedMembers);
        const existingSplits = expense?.expense_splits ?? [];
        setSelectedIds(
          expense
            ? existingSplits.map((split) => split.user_id)
            : loadedMembers.map((member) => member.user_id)
        );
        setPaidBy(
          expense &&
            loadedMembers.some((member) => member.user_id === expense.paid_by)
            ? expense.paid_by
            : loadedMembers.some((member) => member.user_id === user?.id)
              ? user?.id ?? ""
              : loadedMembers[0]?.user_id ?? ""
        );
        if (expense?.expense_splits[0]?.split_type === "exact") {
          setSplitValues(
            Object.fromEntries(
              existingSplits.map((split) => [
                split.user_id,
                formatMinorUnitsForInput(
                  split.owed_amount_minor,
                  expense.currency
                ),
              ])
            )
          );
        } else if (
          expense?.expense_splits[0]?.split_type === "percentage"
        ) {
          const percentages = derivePercentageValues(
            expense.amount_minor,
            existingSplits.map((split) => split.owed_amount_minor)
          );
          setSplitValues(
            Object.fromEntries(
              existingSplits.map((split, index) => [
                split.user_id,
                formatBasisPoints(percentages[index]),
              ])
            )
          );
        }
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load group members.";
        setMembersError(message);
        toast.error("Unable to load group members", {
          description: message,
        });
      } finally {
        if (active) setMembersLoading(false);
      }
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [expense, groupCurrency, groupId, isOpen, user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const amountMinor = useMemo(
    () => parseAmountToMinor(amount, currency),
    [amount, currency]
  );

  const preview = useMemo(() => {
    if (amountMinor === null || amountMinor <= 0 || selectedIds.length === 0) {
      return { splits: null, error: "" };
    }

    const participants: SplitInput[] = selectedIds.map((userId) => {
      if (splitType === "equal") return { user_id: userId };
      const value = splitValues[userId] ?? "";
      return {
        user_id: userId,
        value:
          splitType === "exact"
            ? parseAmountToMinor(value, currency) ?? undefined
            : parseDecimalToInteger(value, 2) ?? undefined,
      };
    });

    try {
      return {
        splits: calculateSplits(amountMinor, participants, splitType),
        error: "",
      };
    } catch (error) {
      return {
        splits: null,
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate the split.",
      };
    }
  }, [amountMinor, currency, selectedIds, splitType, splitValues]);

  function updateSplitValue(userId: string, value: string) {
    setSplitValues((current) => ({ ...current, [userId]: value }));
  }

  function toggleParticipant(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId]
    );
  }

  function buildSplits(totalMinor: number): CalculatedSplit[] {
    const savedSplits = expense?.expense_splits ?? [];
    const sameParticipants =
      savedSplits.length === selectedIds.length &&
      savedSplits.every((split) => selectedIds.includes(split.user_id));
    const sameType =
      savedSplits.length > 0 &&
      savedSplits.every((split) => split.split_type === splitType);

    if (
      expense &&
      totalMinor === expense.amount_minor &&
      currency === expense.currency &&
      sameParticipants &&
      sameType
    ) {
      let valuesUnchanged = splitType === "equal";

      if (splitType === "exact") {
        valuesUnchanged = savedSplits.every(
          (split) =>
            parseAmountToMinor(
              splitValues[split.user_id] ?? "",
              currency
            ) === split.owed_amount_minor
        );
      } else if (splitType === "percentage") {
        const percentages = derivePercentageValues(
          totalMinor,
          savedSplits.map((split) => split.owed_amount_minor)
        );
        valuesUnchanged = savedSplits.every(
          (split, index) =>
            parseDecimalToInteger(
              splitValues[split.user_id] ?? "",
              2
            ) === percentages[index]
        );
      }

      if (valuesUnchanged) {
        return savedSplits.map((split) => ({
          user_id: split.user_id,
          owed_amount_minor: split.owed_amount_minor,
          split_type: split.split_type,
        }));
      }
    }

    const participants: SplitInput[] = selectedIds.map((userId) => {
      if (splitType === "equal") return { user_id: userId };
      const value = splitValues[userId] ?? "";
      return {
        user_id: userId,
        value:
          splitType === "exact"
            ? parseAmountToMinor(value, currency) ?? undefined
            : parseDecimalToInteger(value, 2) ?? undefined,
      };
    });
    return calculateSplits(totalMinor, participants, splitType);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const cleanDescription = description.trim();
    if (!cleanDescription) {
      setFormError("Enter an expense description.");
      return;
    }
    const totalMinor = parseAmountToMinor(amount, currency);
    if (totalMinor === null || totalMinor <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }
    if (!currencies.includes(currency)) {
      setFormError("Select a supported currency.");
      return;
    }
    if (!members.some((member) => member.user_id === paidBy)) {
      setFormError("Select a group member who paid for this expense.");
      return;
    }
    const memberIds = new Set(members.map((member) => member.user_id));
    if (
      selectedIds.length === 0 ||
      new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some((userId) => !memberIds.has(userId))
    ) {
      setFormError("Select at least one valid group member.");
      return;
    }
    if (
      category &&
      !categories.some((item) => item.toLowerCase() === category)
    ) {
      setFormError("Select an expense category.");
      return;
    }
    if (!isValidDateInput(expenseDate)) {
      setFormError("Select a valid expense date.");
      return;
    }

    let splits: CalculatedSplit[];
    try {
      splits = buildSplits(totalMinor);
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Check the amount and split details.";
      setFormError(message);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    const notificationId = toast.loading(
      expense ? "Updating expense..." : "Saving expense..."
    );

    try {
      const input = {
        groupId,
        description: cleanDescription,
        amountMinor: totalMinor,
        currency,
        paidBy,
        category: category || "other",
        expenseDate,
        splits,
      };
      if (expense) {
        await updateExpense(expense.id, input);
      } else {
        await createExpense(input);
      }
      toast.success(expense ? "Expense updated" : "Expense added", {
        id: notificationId,
        description: "The group expense list has been updated.",
      });
      onSaved();
      onClose();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : `Unable to ${expense ? "update" : "save"} this expense.`;
      setFormError(message);
      toast.error(`Unable to ${expense ? "update" : "save"} expense`, {
        id: notificationId,
        description: message,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const minorDigits = getCurrencyMinorDigits(currency);
  const amountStep = minorDigits === 0 ? "1" : "0.01";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/60 p-0 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-7">
          <div>
            <h2
              id="add-expense-title"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              {expense ? "Edit expense" : "Add an expense"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {expense
                ? "Update the expense details and participant shares."
                : "Add a shared cost and choose how to split it."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {membersLoading ? (
          <div className="p-8 text-center text-sm text-gray-500" role="status">
            Loading group members...
          </div>
        ) : membersError ? (
          <div className="p-6">
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {membersError}
            </p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-6">
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Add members to this group before recording an expense.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="expense-description" className={labelClassName}>
                  Description
                </label>
                <input
                  id="expense-description"
                  autoFocus
                  required
                  maxLength={120}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="e.g. Dinner at the lake"
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="expense-amount" className={labelClassName}>
                  Amount
                </label>
                <input
                  id="expense-amount"
                  required
                  type="number"
                  min="0"
                  step={amountStep}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={minorDigits === 0 ? "0" : "0.00"}
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="expense-currency" className={labelClassName}>
                  Currency
                </label>
                <select
                  id="expense-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={inputClassName}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="expense-paid-by" className={labelClassName}>
                  Paid by
                </label>
                <select
                  id="expense-paid-by"
                  required
                  value={paidBy}
                  onChange={(event) => setPaidBy(event.target.value)}
                  className={inputClassName}
                >
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name}
                      {member.user_id === user?.id ? " (You)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="expense-category" className={labelClassName}>
                  Category (optional)
                </label>
                <select
                  id="expense-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">No category</option>
                  {categories.map((item) => (
                    <option key={item} value={item.toLowerCase()}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="expense-date" className={labelClassName}>
                  Expense date
                </label>
                <input
                  id="expense-date"
                  required
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <section aria-labelledby="participants-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3
                    id="participants-heading"
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    Participants
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Choose who shares this expense.
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {selectedIds.length} selected
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {members.map((member) => {
                  const selected = selectedIds.includes(member.user_id);
                  return (
                    <div
                      key={member.user_id}
                      className={`flex min-w-0 items-center gap-3 rounded-lg border p-3 ${
                        selected
                          ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      <input
                        id={`participant-${member.user_id}`}
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleParticipant(member.user_id)}
                        className="h-4 w-4 shrink-0 accent-indigo-600"
                      />
                      <label
                        htmlFor={`participant-${member.user_id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200"
                      >
                        {member.full_name}
                        {member.user_id === user?.id ? " (You)" : ""}
                      </label>
                      {selected && splitType !== "equal" && (
                        <div className="w-28 shrink-0">
                          <label
                            className="sr-only"
                            htmlFor={`split-${member.user_id}`}
                          >
                            {splitType === "exact"
                              ? `${member.full_name}'s share`
                              : `${member.full_name}'s percentage`}
                          </label>
                          <div className="relative">
                            <input
                              id={`split-${member.user_id}`}
                              type="number"
                              min="0"
                              step={
                                splitType === "exact" ? amountStep : "0.01"
                              }
                              inputMode="decimal"
                              value={splitValues[member.user_id] ?? ""}
                              onChange={(event) =>
                                updateSplitValue(
                                  member.user_id,
                                  event.target.value
                                )
                              }
                              placeholder="0.00"
                              className={`${inputClassName} pr-7`}
                            />
                            {splitType === "percentage" && (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                %
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Split type
                </h3>
              </div>
              <SplitTypeSelector value={splitType} onChange={setSplitType} />
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Share breakdown
                  </h4>
                  {amountMinor !== null && amountMinor > 0 && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatMinorUnits(amountMinor, currency)}
                    </span>
                  )}
                </div>
                {preview.splits ? (
                  <SplitBreakdown
                    splits={preview.splits}
                    members={members}
                    currency={currency}
                  />
                ) : (
                  <p className="py-2 text-sm text-gray-500" aria-live="polite">
                    {preview.error ||
                      "Enter an amount and select participants to preview shares."}
                  </p>
                )}
              </div>
            </section>

            {formError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {formError}
              </p>
            )}

            <footer className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || membersLoading}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? expense
                    ? "Updating..."
                    : "Saving..."
                  : expense
                    ? "Save changes"
                    : "Save expense"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}