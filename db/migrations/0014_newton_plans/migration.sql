-- Newton product and plan assignment per EcoAccount.
-- Stored on the accounts table so admin can assign a Newton plan
-- to any customer and top up their monthly allowance.

alter table accounts add column if not exists newton_product text;
alter table accounts add column if not exists newton_plan text;

create index if not exists accounts_newton_plan_idx
  on accounts (newton_plan)
  where newton_plan is not null;
