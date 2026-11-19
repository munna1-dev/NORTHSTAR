-- Restrict staff records to the official NorthStarBank email domain.
ALTER TABLE public.staff
ADD CONSTRAINT staff_email_northstarbank_domain_check
CHECK (
  email = LOWER(BTRIM(email))
  AND email ~ '^[^[:space:]@]+@northstarbank[.]site$'
);
