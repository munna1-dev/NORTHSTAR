import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.NORTHSTAR_CUSTOMER_PASSWORD;

if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
if (!password) throw new Error("NORTHSTAR_CUSTOMER_PASSWORD is not set.");

const client = new Client({ connectionString: databaseUrl });

const customer = {
  firstName: "Liu",
  lastName: "Hong Cheng",
  email: "liucheng0651@gmail.com",
  phone: "+1 (251) 202 - 4631",
  dateOfBirth: "1976-03-25",
  addressLine1: "3712 Bancroft St",
  city: "San Diego",
  stateCode: "CA",
  postalCode: "92104",
  countryCode: "US",
};

const accounts = [
  { type: "checking", balance: "67050.04", label: "Initial checking balance" },
  { type: "savings", balance: "367103.40", label: "Initial savings balance" },
  { type: "credit", balance: "197080.07", label: "Initial credit balance" },
];

const makeCustomerNumber = () =>
  `NSCUS${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

const makeAccountNumber = (used) => {
  for (;;) {
    const number = `40${Math.floor(Math.random() * 10_000_000_000)
      .toString()
      .padStart(10, "0")}`;

    if (!used.has(number)) {
      used.add(number);
      return number;
    }
  }
};

try {
  await client.connect();
  await client.query("BEGIN");

  const existing = await client.query(
    `SELECT id, customer_number
     FROM customers
     WHERE lower(email) = lower($1)
     FOR UPDATE`,
    [customer.email],
  );

  if (existing.rowCount > 0) {
    throw new Error(
      `Customer ${customer.email} already exists (${existing.rows[0].customer_number}). Nothing was changed.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const customerNumber = makeCustomerNumber();

  const customerResult = await client.query(
    `INSERT INTO customers
      (customer_number, first_name, last_name, email, phone, password_hash,
       status, role, two_factor_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'customer', false)
     RETURNING id, customer_number`,
    [
      customerNumber,
      customer.firstName,
      customer.lastName,
      customer.email,
      customer.phone,
      passwordHash,
    ],
  );

  const customerId = customerResult.rows[0].id;

  await client.query(
    `INSERT INTO customer_profiles
      (customer_id, date_of_birth, address_line1, city, state_code,
       postal_code, country_code, kyc_status, kyc_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified', CURRENT_TIMESTAMP)`,
    [
      customerId,
      customer.dateOfBirth,
      customer.addressLine1,
      customer.city,
      customer.stateCode,
      customer.postalCode,
      customer.countryCode,
    ],
  );

  await client.query(
    `INSERT INTO customer_preferences
      (customer_id, email_notifications, sms_notifications,
       transaction_alerts, marketing_emails, theme, language)
     VALUES ($1, true, true, true, false, 'system', 'en')`,
    [customerId],
  );

  const usedAccountNumbers = new Set();

  for (const account of accounts) {
    const accountNumber = makeAccountNumber(usedAccountNumbers);

    const accountResult = await client.query(
      `INSERT INTO accounts
        (customer_id, account_number, account_type, status, currency,
         available_balance, current_balance)
       VALUES ($1, $2, $3, 'active', 'USD', $4::numeric, $4::numeric)
       RETURNING id, account_number, account_type`,
      [customerId, accountNumber, account.type, account.balance],
    );

    await client.query(
      `INSERT INTO transactions
        (account_id, reference, transaction_type, status, description,
         amount, currency, metadata)
       VALUES ($1, $2, 'deposit', 'completed', $3, $4::numeric, 'USD', $5::jsonb)`,
      [
        accountResult.rows[0].id,
        `OPEN-${account.type.toUpperCase()}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)
          .toUpperCase()}`,
        account.label,
        account.balance,
        JSON.stringify({
          source: "customer-provisioning",
          customer_id: customerId,
          initial_balance: true,
        }),
      ],
    );
  }

  await client.query(
    `INSERT INTO notifications
      (customer_id, title, message, notification_type, is_read)
     VALUES ($1, $2, $3, 'general', false)`,
    [
      customerId,
      "Welcome to NorthStarBank",
      "Your customer profile and accounts have been successfully created.",
    ],
  );

  await client.query("COMMIT");

  const verification = await client.query(
    `SELECT
       c.customer_number,
       c.first_name,
       c.last_name,
       c.email,
       c.status,
       p.date_of_birth,
       p.city,
       p.state_code,
       p.postal_code,
       p.country_code,
       p.kyc_status,
       COUNT(a.id)::int AS account_count
     FROM customers c
     JOIN customer_profiles p ON p.customer_id = c.id
     LEFT JOIN accounts a ON a.customer_id = c.id
     WHERE c.id = $1
     GROUP BY
       c.customer_number, c.first_name, c.last_name, c.email, c.status,
       p.date_of_birth, p.city, p.state_code, p.postal_code,
       p.country_code, p.kyc_status`,
    [customerId],
  );

  console.log(JSON.stringify(verification.rows[0], null, 2));
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error("PROVISIONING FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
