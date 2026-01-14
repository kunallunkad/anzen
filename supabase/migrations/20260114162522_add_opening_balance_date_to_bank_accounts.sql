/*
  # Add Opening Balance Date to Bank Accounts

  1. Changes
    - Add `opening_balance_date` column to `bank_accounts` table
    - Default to '2025-01-01' for existing accounts (can be updated)
    
  2. Purpose
    - Track when the opening balance was set
    - Enable correct opening balance calculation when filtering by date range
    - Opening balance for filtered dates = stored opening balance + sum of transactions between opening_balance_date and filter start date
*/

-- Add opening_balance_date column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT '2025-01-01' NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN bank_accounts.opening_balance_date IS 'The date on which the opening_balance amount is effective';
