ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_path TEXT;

COMMENT ON COLUMN customers.profile_image_url IS
  'Private/customer profile image reference exposed only through authenticated profile responses.';

COMMENT ON COLUMN customers.profile_image_path IS
  'Vercel Blob object path for the customer profile image.';
