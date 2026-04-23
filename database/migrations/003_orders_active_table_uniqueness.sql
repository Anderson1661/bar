USE fullgas_db;

ALTER TABLE orders
  ADD COLUMN is_open TINYINT
    AS (
      CASE
        WHEN status IN ('open', 'pending_payment') THEN 1
        ELSE NULL
      END
    ) STORED AFTER status,
  ADD UNIQUE KEY uq_orders_table_open (table_id, is_open);
