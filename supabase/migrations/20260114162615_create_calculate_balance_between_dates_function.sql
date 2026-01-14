/*
  # Create Calculate Balance Between Dates Function

  1. Purpose
    - Calculate net balance change for a bank account between two dates
    - Used for computing effective opening balance when filtering by date range
    
  2. Logic
    - Sum all credits and debits from:
      - Bank statement lines
      - Receipt vouchers
      - Payment vouchers  
      - Finance expenses
    - Return net change (credits - debits)
*/

CREATE OR REPLACE FUNCTION calculate_balance_between_dates(
  p_bank_account_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (net_change NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_transactions AS (
    -- Bank statement lines
    SELECT
      COALESCE(credit_amount, 0) AS credit,
      COALESCE(debit_amount, 0) AS debit
    FROM bank_statement_lines
    WHERE bank_account_id = p_bank_account_id
      AND transaction_date >= p_start_date
      AND transaction_date < p_end_date

    UNION ALL

    -- Receipt vouchers (customer payments - credits)
    SELECT
      amount AS credit,
      0 AS debit
    FROM receipt_vouchers
    WHERE bank_account_id = p_bank_account_id
      AND voucher_date >= p_start_date
      AND voucher_date < p_end_date

    UNION ALL

    -- Payment vouchers (supplier payments - debits)
    SELECT
      0 AS credit,
      amount AS debit
    FROM payment_vouchers
    WHERE bank_account_id = p_bank_account_id
      AND voucher_date >= p_start_date
      AND voucher_date < p_end_date

    UNION ALL

    -- Finance expenses (debits)
    SELECT
      0 AS credit,
      amount AS debit
    FROM finance_expenses
    WHERE bank_account_id = p_bank_account_id
      AND expense_date >= p_start_date
      AND expense_date < p_end_date
  )
  SELECT
    SUM(credit) - SUM(debit) AS net_change
  FROM all_transactions;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_balance_between_dates(UUID, DATE, DATE) TO authenticated;
