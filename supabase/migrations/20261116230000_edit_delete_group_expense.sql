CREATE OR REPLACE FUNCTION public.update_group_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_by uuid,
  p_category text,
  p_expense_date date,
  p_splits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count bigint;
  v_existing_split_count bigint;
  v_deleted_split_count bigint;
  v_split_count bigint;
  v_unique_user_count bigint;
  v_split_type_count bigint;
  v_share_total numeric;
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
    RAISE EXCEPTION 'You must be a group member to edit this expense.'
      USING ERRCODE = '42501';
  END IF;

  IF p_description IS NULL
     OR length(btrim(p_description)) = 0
     OR p_amount_minor IS NULL
     OR p_amount_minor <= 0
     OR p_currency IS NULL
     OR p_paid_by IS NULL
     OR p_expense_date IS NULL THEN
    RAISE EXCEPTION 'Expense details are invalid.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_paid_by
  ) THEN
    RAISE EXCEPTION 'The payer must be a group member.'
      USING ERRCODE = '22023';
  END IF;

  IF p_splits IS NULL OR jsonb_typeof(p_splits) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expense splits must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_splits) AS s(
      user_id uuid,
      owed_amount_minor bigint,
      split_type text
    )
    WHERE s.user_id IS NULL
       OR s.owed_amount_minor IS NULL
       OR s.owed_amount_minor < 0
       OR s.split_type IS NULL
       OR s.split_type NOT IN ('equal', 'exact', 'percentage')
  ) THEN
    RAISE EXCEPTION 'Expense splits contain invalid values.'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    count(*),
    count(DISTINCT s.user_id),
    count(DISTINCT s.split_type),
    COALESCE(sum(s.owed_amount_minor), 0)
  INTO
    v_split_count,
    v_unique_user_count,
    v_split_type_count,
    v_share_total
  FROM jsonb_to_recordset(p_splits) AS s(
    user_id uuid,
    owed_amount_minor bigint,
    split_type text
  );

  IF v_split_count = 0
     OR v_split_count <> v_unique_user_count
     OR v_split_type_count <> 1
     OR v_share_total <> p_amount_minor THEN
    RAISE EXCEPTION 'Expense splits must be unique and add up to the expense total.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_splits) AS s(
      user_id uuid,
      owed_amount_minor bigint,
      split_type text
    )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = p_group_id
        AND gm.user_id = s.user_id
    )
  ) THEN
    RAISE EXCEPTION 'Every participant must be a group member.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.expenses
  SET description = btrim(p_description),
      amount_minor = p_amount_minor,
      currency = p_currency,
      paid_by = p_paid_by,
      category = p_category,
      expense_date = p_expense_date
  WHERE id = p_expense_id
    AND group_id = p_group_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Expense not found or editing is not permitted.'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)
  INTO v_existing_split_count
  FROM public.expense_splits
  WHERE expense_id = p_expense_id;

  DELETE FROM public.expense_splits
  WHERE expense_id = p_expense_id;

  GET DIAGNOSTICS v_deleted_split_count = ROW_COUNT;
  IF v_deleted_split_count <> v_existing_split_count THEN
    RAISE EXCEPTION 'You are not permitted to replace all expense splits.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.expense_splits (
    expense_id,
    user_id,
    owed_amount_minor,
    split_type
  )
  SELECT
    p_expense_id,
    s.user_id,
    s.owed_amount_minor,
    s.split_type
  FROM jsonb_to_recordset(p_splits) AS s(
    user_id uuid,
    owed_amount_minor bigint,
    split_type text
  );
END;
$$;

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
  v_deleted_count bigint;
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
  ) THEN
    RAISE EXCEPTION 'Expense not found or deletion is not permitted.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.expense_splits
  WHERE expense_id = p_expense_id;

  DELETE FROM public.expenses
  WHERE id = p_expense_id
    AND group_id = p_group_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION 'Expense deletion is not permitted.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_group_expense(
  uuid, uuid, text, bigint, text, uuid, text, date, jsonb
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_group_expense(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_expense(
  uuid, uuid, text, bigint, text, uuid, text, date, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group_expense(uuid, uuid)
  TO authenticated;
