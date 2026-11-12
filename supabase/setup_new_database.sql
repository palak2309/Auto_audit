-- ============================================================================
-- AutoAudit: Complete Database Schema & Migration Setup
-- Idempotent: Safe to execute on both fresh and existing Supabase databases
-- ============================================================================

-- 1. EXTENSIONS & SCHEMAS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin', 'cfo', 'finance_manager', 'accountant', 'procurement_manager', 'auditor', 'viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'view', 'create', 'edit', 'delete', 'approve', 'recover', 'manage_users', 'manage_roles', 'export', 'configure'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. COMMON FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. PROFILES & AUTH SYNCHRONIZATION
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  company text,
  department text,
  job_title text,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS t_profiles_updated ON public.profiles;
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, company, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'company', NEW.raw_user_meta_data ->> 'organisation'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    company = COALESCE(EXCLUDED.company, public.profiles.company);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "read role permissions" ON public.role_permissions;
CREATE POLICY "read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own user roles" ON public.user_roles;
CREATE POLICY "own user roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 6. ERP CONNECTIONS & OAUTH
CREATE TABLE IF NOT EXISTS public.erp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  account_name text,
  external_account_id text,
  status text NOT NULL DEFAULT 'pending',
  last_sync_at timestamptz,
  last_error text,
  credentials_ciphertext text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_connections TO authenticated;
GRANT ALL ON public.erp_connections TO service_role;
ALTER TABLE public.erp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own connections" ON public.erp_connections;
CREATE POLICY "own connections" ON public.erp_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE SELECT (credentials_ciphertext) ON public.erp_connections FROM authenticated;

DROP TRIGGER IF EXISTS t_connections_updated ON public.erp_connections;
CREATE TRIGGER t_connections_updated BEFORE UPDATE ON public.erp_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.erp_provider_config (
  provider text PRIMARY KEY,
  client_id text NOT NULL,
  client_secret_ciphertext text NOT NULL,
  extra_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.erp_provider_config TO service_role;
ALTER TABLE public.erp_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server only provider config" ON public.erp_provider_config;
CREATE POLICY "server only provider config" ON public.erp_provider_config FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS t_provider_config_updated ON public.erp_provider_config;
CREATE TRIGGER t_provider_config_updated BEFORE UPDATE ON public.erp_provider_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.erp_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.erp_oauth_states TO service_role;
ALTER TABLE public.erp_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server only oauth state" ON public.erp_oauth_states;
CREATE POLICY "server only oauth state" ON public.erp_oauth_states FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 7. FINANCIAL DATA TABLES
CREATE TABLE IF NOT EXISTS public.erp_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  status text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_vendors TO authenticated;
GRANT ALL ON public.erp_vendors TO service_role;
ALTER TABLE public.erp_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own vendors" ON public.erp_vendors;
CREATE POLICY "own vendors" ON public.erp_vendors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  invoice_number text,
  type text NOT NULL,
  vendor_name text,
  customer_name text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_invoices TO authenticated;
GRANT ALL ON public.erp_invoices TO service_role;
ALTER TABLE public.erp_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own invoices" ON public.erp_invoices;
CREATE POLICY "own invoices" ON public.erp_invoices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  type text NOT NULL,
  contact_name text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_date timestamptz,
  reference text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_payments TO authenticated;
GRANT ALL ON public.erp_payments TO service_role;
ALTER TABLE public.erp_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own payments" ON public.erp_payments;
CREATE POLICY "own payments" ON public.erp_payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  rate numeric(18,2),
  effective_date date,
  expiration_date date,
  auto_renew boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_contracts TO authenticated;
GRANT ALL ON public.erp_contracts TO service_role;
ALTER TABLE public.erp_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own contracts" ON public.erp_contracts;
CREATE POLICY "own contracts" ON public.erp_contracts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  date timestamptz NOT NULL,
  description text,
  vendor_name text,
  category text,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_transactions TO authenticated;
GRANT ALL ON public.erp_transactions TO service_role;
ALTER TABLE public.erp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own transactions" ON public.erp_transactions;
CREATE POLICY "own transactions" ON public.erp_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sync_logs TO authenticated;
GRANT ALL ON public.erp_sync_logs TO service_role;
ALTER TABLE public.erp_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sync logs" ON public.erp_sync_logs;
CREATE POLICY "own sync logs" ON public.erp_sync_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. DURABLE FINANCIAL LEAKS, AUDIT & RECOVERY CASES
CREATE TABLE IF NOT EXISTS public.erp_leaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.erp_connections(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  vendor_name text NOT NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'USD',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'recovering', 'recovered', 'dismissed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'rule_engine',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_notes text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_erp_leaks_user_fingerprint UNIQUE (user_id, fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_leaks TO authenticated;
GRANT ALL ON public.erp_leaks TO service_role;
ALTER TABLE public.erp_leaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leaks" ON public.erp_leaks;
CREATE POLICY "own leaks" ON public.erp_leaks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS t_erp_leaks_updated ON public.erp_leaks;
CREATE TRIGGER t_erp_leaks_updated BEFORE UPDATE ON public.erp_leaks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.erp_leak_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leak_id uuid NOT NULL REFERENCES public.erp_leaks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.erp_leak_activity TO authenticated;
GRANT ALL ON public.erp_leak_activity TO service_role;
ALTER TABLE public.erp_leak_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leak activity" ON public.erp_leak_activity;
CREATE POLICY "own leak activity" ON public.erp_leak_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erp_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leak_id uuid NOT NULL REFERENCES public.erp_leaks(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'identified' CHECK (stage IN ('identified', 'vendor_contacted', 'claim_filed', 'credit_issued', 'recovered')),
  target_amount numeric(18,2) NOT NULL DEFAULT 0.00,
  recovered_amount numeric(18,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'USD',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claim_reference text,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_recovery_cases TO authenticated;
GRANT ALL ON public.erp_recovery_cases TO service_role;
ALTER TABLE public.erp_recovery_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own recovery cases" ON public.erp_recovery_cases;
CREATE POLICY "own recovery cases" ON public.erp_recovery_cases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS t_recovery_cases_updated ON public.erp_recovery_cases;
CREATE TRIGGER t_recovery_cases_updated BEFORE UPDATE ON public.erp_recovery_cases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_erp_leaks_user_status ON public.erp_leaks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_erp_leaks_user_severity ON public.erp_leaks (user_id, severity);
CREATE INDEX IF NOT EXISTS idx_erp_leaks_connection ON public.erp_leaks (connection_id);
CREATE INDEX IF NOT EXISTS idx_erp_leak_activity_leak ON public.erp_leak_activity (leak_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_erp_recovery_cases_leak ON public.erp_recovery_cases (leak_id);
CREATE INDEX IF NOT EXISTS idx_erp_recovery_cases_user_stage ON public.erp_recovery_cases (user_id, stage);

DROP INDEX IF EXISTS public.uq_recovery_active_leak;
CREATE UNIQUE INDEX uq_recovery_active_leak ON public.erp_recovery_cases (leak_id)
WHERE (stage != 'recovered' AND closed_at IS NULL);

-- 9. WORKFLOW ATOMICITY PROCEDURES
CREATE OR REPLACE FUNCTION public.prevent_leak_activity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit activity log records are immutable and cannot be updated or deleted' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS t_leak_activity_immutable ON public.erp_leak_activity;
CREATE TRIGGER t_leak_activity_immutable
BEFORE UPDATE OR DELETE ON public.erp_leak_activity
FOR EACH ROW EXECUTE FUNCTION public.prevent_leak_activity_mutation();

CREATE OR REPLACE FUNCTION public.workflow_update_leak_status(
  p_leak_id uuid,
  p_actor_id uuid,
  p_next_status text,
  p_expected_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_leak public.erp_leaks%ROWTYPE;
  v_prev_status text;
  v_activity_id uuid;
  v_now timestamptz := now();
  v_is_terminal boolean;
  v_resolution_notes text;
  v_resolved_at timestamptz;
BEGIN
  SELECT * INTO v_leak FROM public.erp_leaks WHERE id = p_leak_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leak finding not found' USING ERRCODE = 'P0002';
  END IF;

  v_prev_status := v_leak.status;
  IF p_expected_status IS NOT NULL AND v_prev_status <> p_expected_status THEN
    RAISE EXCEPTION 'Concurrency conflict: Leak status was modified from % to % by another transaction',
      p_expected_status, v_prev_status USING ERRCODE = '40001';
  END IF;

  IF v_prev_status = p_next_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'no_op', true,
      'leak_id', p_leak_id,
      'previous_status', v_prev_status,
      'current_status', v_prev_status
    );
  END IF;

  v_is_terminal := p_next_status IN ('recovered', 'dismissed');
  v_resolved_at := CASE WHEN v_is_terminal THEN v_now ELSE NULL END;
  v_resolution_notes := CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN trim(p_notes) ELSE v_leak.resolution_notes END;

  UPDATE public.erp_leaks
  SET status = p_next_status,
      resolved_at = v_resolved_at,
      resolution_notes = v_resolution_notes,
      updated_at = v_now
  WHERE id = p_leak_id;

  INSERT INTO public.erp_leak_activity (leak_id, user_id, actor_id, action, metadata, created_at)
  VALUES (
    p_leak_id,
    v_leak.user_id,
    p_actor_id,
    'status_changed',
    jsonb_build_object(
      'from_status', v_prev_status,
      'to_status', p_next_status,
      'notes', p_notes,
      'transitioned_at', v_now
    ),
    v_now
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'leak_id', p_leak_id,
    'previous_status', v_prev_status,
    'current_status', p_next_status,
    'activity_id', v_activity_id,
    'resolved_at', v_resolved_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.workflow_assign_leak(
  p_leak_id uuid,
  p_actor_id uuid,
  p_assignee_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_leak public.erp_leaks%ROWTYPE;
  v_prev_assignee uuid;
  v_activity_id uuid;
  v_now timestamptz := now();
  v_assignee_name text := NULL;
BEGIN
  SELECT * INTO v_leak FROM public.erp_leaks WHERE id = p_leak_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leak finding not found' USING ERRCODE = 'P0002';
  END IF;

  v_prev_assignee := v_leak.assigned_to;
  IF v_prev_assignee IS NOT DISTINCT FROM p_assignee_id THEN
    RETURN jsonb_build_object('success', true, 'no_op', true, 'leak_id', p_leak_id, 'assigned_to', p_assignee_id);
  END IF;

  IF p_assignee_id IS NOT NULL THEN
    SELECT COALESCE(full_name, 'Team Member') INTO v_assignee_name FROM public.profiles WHERE id = p_assignee_id;
  END IF;

  UPDATE public.erp_leaks SET assigned_to = p_assignee_id, updated_at = v_now WHERE id = p_leak_id;

  INSERT INTO public.erp_leak_activity (leak_id, user_id, actor_id, action, metadata, created_at)
  VALUES (
    p_leak_id,
    v_leak.user_id,
    p_actor_id,
    CASE WHEN p_assignee_id IS NULL THEN 'unassigned' ELSE 'assigned' END,
    jsonb_build_object(
      'previous_assignee', v_prev_assignee,
      'assigned_to', p_assignee_id,
      'assignee_name', v_assignee_name,
      'assigned_at', v_now
    ),
    v_now
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('success', true, 'leak_id', p_leak_id, 'assigned_to', p_assignee_id, 'activity_id', v_activity_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.workflow_add_leak_note(
  p_leak_id uuid,
  p_actor_id uuid,
  p_note text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_leak public.erp_leaks%ROWTYPE;
  v_activity_id uuid;
  v_now timestamptz := now();
  v_trimmed text;
BEGIN
  v_trimmed := trim(COALESCE(p_note, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'Note content cannot be empty' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_leak FROM public.erp_leaks WHERE id = p_leak_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leak finding not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.erp_leak_activity (leak_id, user_id, actor_id, action, metadata, created_at)
  VALUES (
    p_leak_id,
    v_leak.user_id,
    p_actor_id,
    'investigation_note',
    jsonb_build_object('note', v_trimmed, 'created_at', v_now),
    v_now
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('success', true, 'leak_id', p_leak_id, 'activity_id', v_activity_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.workflow_open_recovery_case(
  p_leak_id uuid,
  p_actor_id uuid,
  p_target_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_claim_reference text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_leak public.erp_leaks%ROWTYPE;
  v_existing_case public.erp_recovery_cases%ROWTYPE;
  v_case_id uuid;
  v_activity_id uuid;
  v_now timestamptz := now();
  v_target numeric(18,2);
BEGIN
  SELECT * INTO v_leak FROM public.erp_leaks WHERE id = p_leak_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leak finding not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing_case FROM public.erp_recovery_cases
  WHERE leak_id = p_leak_id AND stage <> 'recovered' AND closed_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_open', true, 'recovery_case_id', v_existing_case.id, 'leak_id', p_leak_id);
  END IF;

  v_target := COALESCE(p_target_amount, v_leak.amount);

  INSERT INTO public.erp_recovery_cases (
    leak_id, user_id, stage, target_amount, recovered_amount, currency, owner_id, claim_reference, notes, opened_at, created_at, updated_at
  )
  VALUES (
    p_leak_id, v_leak.user_id, 'identified', v_target, 0.00, v_leak.currency, p_actor_id, p_claim_reference, p_notes, v_now, v_now, v_now
  )
  RETURNING id INTO v_case_id;

  IF v_leak.status <> 'recovering' THEN
    UPDATE public.erp_leaks SET status = 'recovering', updated_at = v_now WHERE id = p_leak_id;
  END IF;

  INSERT INTO public.erp_leak_activity (leak_id, user_id, actor_id, action, metadata, created_at)
  VALUES (
    p_leak_id, v_leak.user_id, p_actor_id, 'recovery_opened',
    jsonb_build_object('recovery_case_id', v_case_id, 'target_amount', v_target, 'currency', v_leak.currency, 'claim_reference', p_claim_reference, 'opened_at', v_now),
    v_now
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('success', true, 'recovery_case_id', v_case_id, 'leak_id', p_leak_id, 'activity_id', v_activity_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.workflow_update_recovery_case(
  p_recovery_case_id uuid,
  p_actor_id uuid,
  p_stage text DEFAULT NULL,
  p_recovered_amount numeric DEFAULT NULL,
  p_claim_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_case public.erp_recovery_cases%ROWTYPE;
  v_leak public.erp_leaks%ROWTYPE;
  v_prev_stage text;
  v_next_stage text;
  v_activity_id uuid;
  v_now timestamptz := now();
  v_closed_at timestamptz;
BEGIN
  SELECT * INTO v_case FROM public.erp_recovery_cases WHERE id = p_recovery_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recovery case not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_leak FROM public.erp_leaks WHERE id = v_case.leak_id FOR UPDATE;

  v_prev_stage := v_case.stage;
  v_next_stage := COALESCE(p_stage, v_prev_stage);
  v_closed_at := CASE WHEN v_next_stage = 'recovered' THEN v_now ELSE v_case.closed_at END;

  UPDATE public.erp_recovery_cases
  SET stage = v_next_stage,
      recovered_amount = COALESCE(p_recovered_amount, recovered_amount),
      claim_reference = COALESCE(p_claim_reference, claim_reference),
      notes = COALESCE(p_notes, notes),
      owner_id = COALESCE(p_owner_id, owner_id),
      closed_at = v_closed_at,
      updated_at = v_now
  WHERE id = p_recovery_case_id;

  IF v_next_stage = 'recovered' AND v_leak.status <> 'recovered' THEN
    UPDATE public.erp_leaks SET status = 'recovered', resolved_at = v_now, updated_at = v_now WHERE id = v_case.leak_id;
  END IF;

  INSERT INTO public.erp_leak_activity (leak_id, user_id, actor_id, action, metadata, created_at)
  VALUES (
    v_case.leak_id, v_case.user_id, p_actor_id, 'recovery_updated',
    jsonb_build_object(
      'recovery_case_id', p_recovery_case_id,
      'from_stage', v_prev_stage,
      'to_stage', v_next_stage,
      'recovered_amount', COALESCE(p_recovered_amount, v_case.recovered_amount),
      'claim_reference', COALESCE(p_claim_reference, v_case.claim_reference),
      'updated_at', v_now
    ),
    v_now
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('success', true, 'recovery_case_id', p_recovery_case_id, 'stage', v_next_stage, 'activity_id', v_activity_id);
END;
$$;

-- 10. DEFAULT ROLE PERMISSIONS SEED
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('admin', 'view'), ('admin', 'create'), ('admin', 'edit'), ('admin', 'delete'),
  ('admin', 'approve'), ('admin', 'recover'), ('admin', 'manage_users'), ('admin', 'manage_roles'),
  ('admin', 'export'), ('admin', 'configure'),
  ('cfo', 'view'), ('cfo', 'create'), ('cfo', 'edit'), ('cfo', 'approve'),
  ('cfo', 'recover'), ('cfo', 'export'),
  ('finance_manager', 'view'), ('finance_manager', 'create'), ('finance_manager', 'edit'),
  ('finance_manager', 'recover'), ('finance_manager', 'export'),
  ('accountant', 'view'), ('accountant', 'create'), ('accountant', 'edit'), ('accountant', 'export'),
  ('procurement_manager', 'view'), ('procurement_manager', 'create'), ('procurement_manager', 'edit'),
  ('auditor', 'view'), ('auditor', 'export'),
  ('viewer', 'view')
ON CONFLICT (role, permission) DO NOTHING;
