CREATE TABLE public.building_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id TEXT NOT NULL UNIQUE,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('dlba_available','sold','pending','active','retired','for_sale_private','unknown')),
  status_detail TEXT,
  owner_name TEXT,
  source TEXT,
  source_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  manual_override BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX building_status_lat_lng_idx ON public.building_status (lat, lng);
CREATE INDEX building_status_status_idx ON public.building_status (status);

GRANT SELECT ON public.building_status TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_status TO authenticated;
GRANT ALL ON public.building_status TO service_role;

ALTER TABLE public.building_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read building_status"
  ON public.building_status FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin write building_status"
  ON public.building_status FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));