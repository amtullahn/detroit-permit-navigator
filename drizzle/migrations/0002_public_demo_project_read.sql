GRANT SELECT ON public.projects TO anon;
CREATE POLICY "public read demo project" ON public.projects FOR SELECT TO anon, authenticated USING (id = 'c4a5f81e-a83b-4b69-95ea-b091dd4b0a79'::uuid);