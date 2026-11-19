BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS username VARCHAR(40);

UPDATE customers
SET username =
  LEFT(
    COALESCE(
      NULLIF(
        TRIM(BOTH '_' FROM REGEXP_REPLACE(
          LOWER(SPLIT_PART(email, '@', 1)),
          '[^a-z0-9_]+',
          '_',
          'g'
        )),
        ''
      ),
      'customer'
    ),
    25
  ) || '_' || LEFT(REPLACE(id::TEXT, '-', ''), 10)
WHERE username IS NULL OR BTRIM(username) = '';

ALTER TABLE customers
  ALTER COLUMN username SET NOT NULL;

ALTER TABLE customers
  ADD CONSTRAINT customers_username_format_check
  CHECK (username ~ '^[a-z0-9_]{4,40}$');

CREATE UNIQUE INDEX IF NOT EXISTS customers_username_lower_uidx
  ON customers (LOWER(username));

COMMIT;
