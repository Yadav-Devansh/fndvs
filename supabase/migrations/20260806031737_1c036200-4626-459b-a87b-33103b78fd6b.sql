CREATE TYPE public.app_role AS ENUM ('USER','ADMIN');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_text text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submissions_user_id_idx ON public.submissions(user_id);
CREATE INDEX submissions_submitted_at_idx ON public.submissions(submitted_at DESC);
GRANT SELECT, INSERT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('FAKE','REAL')),
  confidence_score numeric(5,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
  predicted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN'::public.app_role);
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "submissions_select" ON public.submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "predictions_select" ON public.predictions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND (s.user_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "predictions_insert_own" ON public.predictions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid())
);

CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());

-- Called by the app right after sign-up to create the profile + default role.
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := (auth.jwt() ->> 'email');
  v_role public.app_role;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.profiles (id, name, email)
  VALUES (v_uid, COALESCE(NULLIF(trim(p_name), ''), split_part(v_email, '@', 1)), v_email)
  ON CONFLICT (id) DO NOTHING;
  v_role := CASE WHEN lower(v_email) = 'admin@fndvs.demo' THEN 'ADMIN'::public.app_role ELSE 'USER'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role) ON CONFLICT DO NOTHING;
END;
$$;

-- Admin-only account activation toggle, writes the audit log.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET is_active = p_is_active WHERE id = p_user_id;
  INSERT INTO public.audit_log (admin_id, action, target_user_id)
  VALUES (auth.uid(), CASE WHEN p_is_active THEN 'ACTIVATE_USER' ELSE 'DEACTIVATE_USER' END, p_user_id);
END;
$$;

-- Demo seed data (standalone demo profiles, not linked to login accounts)
INSERT INTO public.profiles (id, name, email, is_active, created_at) VALUES
 ('11111111-1111-4111-8111-111111111111','Ada Okonkwo','ada@fndvs.demo',true, now() - interval '40 days'),
 ('22222222-2222-4222-8222-222222222222','Bruno Silva','bruno@fndvs.demo',true, now() - interval '32 days'),
 ('33333333-3333-4333-8333-333333333333','Chen Wei','chen@fndvs.demo',false, now() - interval '25 days'),
 ('44444444-4444-4444-8444-444444444444','Divya Rao','divya@fndvs.demo',true, now() - interval '12 days');

INSERT INTO public.submissions (id, user_id, submitted_text, submitted_at) VALUES
 ('a0000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','SHOCKING: Scientists reveal miracle cure that doctors do not want you to know about, available only this week.', now() - interval '18 days'),
 ('a0000002-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','The central bank announced a quarter-point interest rate increase, according to a statement published on its official website.', now() - interval '17 days'),
 ('a0000003-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','You will not believe what this celebrity did at the airport, insiders claim the footage was hidden for years.', now() - interval '15 days'),
 ('a0000004-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Researchers at the university published a peer-reviewed study in a medical journal describing the trial results.', now() - interval '14 days'),
 ('a0000005-0000-4000-8000-000000000005','22222222-2222-4222-8222-222222222222','BREAKING: Government secretly plans to ban all private vehicles next month, leaked document allegedly confirms.', now() - interval '13 days'),
 ('a0000006-0000-4000-8000-000000000006','22222222-2222-4222-8222-222222222222','The transport ministry confirmed that the new rail line will open in March, officials said during a press briefing.', now() - interval '12 days'),
 ('a0000007-0000-4000-8000-000000000007','22222222-2222-4222-8222-222222222222','Local council approves budget for road repairs following a public consultation held earlier this year.', now() - interval '11 days'),
 ('a0000008-0000-4000-8000-000000000008','22222222-2222-4222-8222-222222222222','Miracle drink melts belly fat overnight, thousands of people are furious that this was kept secret.', now() - interval '10 days'),
 ('a0000009-0000-4000-8000-000000000009','33333333-3333-4333-8333-333333333333','Anonymous sources claim the election results were altered, though no evidence has been released publicly.', now() - interval '9 days'),
 ('a0000010-0000-4000-8000-000000000010','33333333-3333-4333-8333-333333333333','The weather agency issued a heavy rainfall advisory for coastal districts through the weekend.', now() - interval '8 days'),
 ('a0000011-0000-4000-8000-000000000011','33333333-3333-4333-8333-333333333333','EXPOSED: Hidden truth about the water supply that authorities refuse to comment on, share before it is deleted.', now() - interval '7 days'),
 ('a0000012-0000-4000-8000-000000000012','44444444-4444-4444-8444-444444444444','A new report from the statistics office shows unemployment fell slightly in the last quarter.', now() - interval '6 days'),
 ('a0000013-0000-4000-8000-000000000013','44444444-4444-4444-8444-444444444444','Viral post claims a famous actor died yesterday, but no major outlet has reported the story.', now() - interval '5 days'),
 ('a0000014-0000-4000-8000-000000000014','44444444-4444-4444-8444-444444444444','The company said in a regulatory filing that it expects revenue growth of about four percent this year.', now() - interval '4 days'),
 ('a0000015-0000-4000-8000-000000000015','44444444-4444-4444-8444-444444444444','Unbelievable footage allegedly shows a giant creature in the harbour, experts have not verified the clip.', now() - interval '3 days'),
 ('a0000016-0000-4000-8000-000000000016','11111111-1111-4111-8111-111111111111','City officials reported that the new hospital wing will begin admitting patients from next Monday.', now() - interval '2 days'),
 ('a0000017-0000-4000-8000-000000000017','22222222-2222-4222-8222-222222222222','Rumours spread online about a nationwide bank shutdown, no official confirmation exists at this time.', now() - interval '1 days'),
 ('a0000018-0000-4000-8000-000000000018','44444444-4444-4444-8444-444444444444','The education department published its annual examination schedule on its official portal today.', now() - interval '6 hours');

INSERT INTO public.predictions (submission_id, label, confidence_score, explanation, predicted_at) VALUES
 ('a0000001-0000-4000-8000-000000000001','FAKE',94.20,'["shocking","miracle","cure","doctors"]', now() - interval '18 days'),
 ('a0000002-0000-4000-8000-000000000002','REAL',88.60,'["announced","according","official","statement"]', now() - interval '17 days'),
 ('a0000003-0000-4000-8000-000000000003','FAKE',81.40,'["you will not believe","insiders","claim","hidden"]', now() - interval '15 days'),
 ('a0000004-0000-4000-8000-000000000004','REAL',91.10,'["researchers","peer-reviewed","study","journal"]', now() - interval '14 days'),
 ('a0000005-0000-4000-8000-000000000005','FAKE',87.30,'["breaking","secretly","leaked","allegedly"]', now() - interval '13 days'),
 ('a0000006-0000-4000-8000-000000000006','REAL',84.90,'["confirmed","ministry","officials","briefing"]', now() - interval '12 days'),
 ('a0000007-0000-4000-8000-000000000007','REAL',72.50,'["council","approves","consultation"]', now() - interval '11 days'),
 ('a0000008-0000-4000-8000-000000000008','FAKE',96.00,'["miracle","overnight","furious","secret"]', now() - interval '10 days'),
 ('a0000009-0000-4000-8000-000000000009','FAKE',58.30,'["anonymous","claim","no evidence"]', now() - interval '9 days'),
 ('a0000010-0000-4000-8000-000000000010','REAL',89.70,'["agency","issued","advisory"]', now() - interval '8 days'),
 ('a0000011-0000-4000-8000-000000000011','FAKE',92.80,'["exposed","hidden truth","refuse","share"]', now() - interval '7 days'),
 ('a0000012-0000-4000-8000-000000000012','REAL',76.40,'["report","statistics office","quarter"]', now() - interval '6 days'),
 ('a0000013-0000-4000-8000-000000000013','FAKE',68.90,'["viral","claims","no major outlet"]', now() - interval '5 days'),
 ('a0000014-0000-4000-8000-000000000014','REAL',85.20,'["regulatory filing","revenue","expects"]', now() - interval '4 days'),
 ('a0000015-0000-4000-8000-000000000015','FAKE',54.70,'["unbelievable","allegedly","unverified"]', now() - interval '3 days'),
 ('a0000016-0000-4000-8000-000000000016','REAL',79.80,'["officials","reported","hospital"]', now() - interval '2 days'),
 ('a0000017-0000-4000-8000-000000000017','FAKE',57.10,'["rumours","no official confirmation"]', now() - interval '1 days'),
 ('a0000018-0000-4000-8000-000000000018','REAL',90.30,'["published","official portal","department"]', now() - interval '6 hours');