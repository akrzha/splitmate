ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.expenses
SET is_deleted = false
WHERE is_deleted IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN is_deleted SET DEFAULT false,
  ALTER COLUMN is_deleted SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_soft_delete_timestamp_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_soft_delete_timestamp_check
      CHECK (
        (is_deleted = false AND deleted_at IS NULL)
        OR (is_deleted = true AND deleted_at IS NOT NULL)
      );
  END IF;
END;
$$;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_soft_delete_guard
  ON public.expenses;

CREATE POLICY expenses_soft_delete_guard
  ON public.expenses
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = expenses.group_id
        AND gm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = expenses.group_id
        AND gm.user_id = auth.uid()
    )
    AND (
      (is_deleted = false AND deleted_at IS NULL)
      OR (
        is_deleted = true
        AND deleted_at IS NOT NULL
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.group_members gm
            WHERE gm.group_id = expenses.group_id
              AND gm.user_id = auth.uid()
              AND gm.role IN ('owner', 'admin')
          )
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_expense_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_deleted THEN
    RAISE EXCEPTION 'A deleted expense cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_deleted THEN
    IF auth.uid() IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.group_members gm
         WHERE gm.group_id = OLD.group_id
           AND gm.user_id = auth.uid()
       ) THEN
      RAISE EXCEPTION 'You must be a group member to delete this expense.'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.created_by IS DISTINCT FROM auth.uid()
       AND NOT EXISTS (
         SELECT 1
         FROM public.group_members gm
         WHERE gm.group_id = OLD.group_id
           AND gm.user_id = auth.uid()
           AND gm.role IN ('owner', 'admin')
       ) THEN
      RAISE EXCEPTION 'Only the expense creator, a group owner, or an admin can delete this expense.'
        USING ERRCODE = '42501';
    END IF;

    NEW.deleted_at := NOW();
  ELSIF NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Active expenses cannot have a deletion timestamp.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_soft_delete_guard
  ON public.expenses;

CREATE TRIGGER expenses_soft_delete_guard
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_expense_soft_delete();

REVOKE DELETE ON TABLE public.expenses
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_group_expense(
  p_group_id uuid,
  p_expense_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You must be a group member to delete this expense.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.expenses e
    WHERE e.id = p_expense_id
      AND e.group_id = p_group_id
      AND e.is_deleted = false
      AND (
        e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.group_members gm
          WHERE gm.group_id = p_group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Expense not found or deletion is not permitted.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.expenses
  SET is_deleted = true,
      deleted_at = NOW()
  WHERE id = p_expense_id
    AND group_id = p_group_id
    AND is_deleted = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Expense not found or deletion is not permitted.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_group_expense(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_group_expense(uuid, uuid)
  TO authenticated;
