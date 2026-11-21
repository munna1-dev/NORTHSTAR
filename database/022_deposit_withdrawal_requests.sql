-- Funding requests use the existing public.financial_requests table.
-- Do not create a second deposit/withdrawal request table.

INSERT INTO management_permissions
  (permission_key, permission_name, permission_group, description)
VALUES
  ('deposits.view', 'View deposits', 'operations', 'View deposit requests.'),
  ('deposits.approve', 'Approve deposits', 'operations', 'Approve deposit requests.'),
  ('deposits.reject', 'Reject deposits', 'operations', 'Reject deposit requests.'),
  ('withdrawals.view', 'View withdrawals', 'operations', 'View withdrawal requests.'),
  ('withdrawals.approve', 'Approve withdrawals', 'operations', 'Approve withdrawal requests.'),
  ('withdrawals.reject', 'Reject withdrawals', 'operations', 'Reject withdrawal requests.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
CROSS JOIN management_permissions p
WHERE r.role_key = 'super_manager'
  AND p.permission_key IN (
    'deposits.view', 'deposits.approve', 'deposits.reject',
    'withdrawals.view', 'withdrawals.approve', 'withdrawals.reject'
  )
ON CONFLICT DO NOTHING;
