create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- reference tables
create table public.contacts (id uuid primary key default gen_random_uuid(), name text not null, type text not null, helps_with text, use_when text, channel_type text check (channel_type in ('email','phone','web_form')), channel_value text, source_url text, last_verified_at timestamptz, notes text, created_at timestamptz default now());
create table public.rules (id uuid primary key default gen_random_uuid(), project_type text not null, use_category text not null, step_order int not null, approval_name text not null, office text, submit_where text, documents_needed jsonb default '[]', source_url text, last_verified_at timestamptz, notes text, is_sample boolean default false);
create table public.architecture_firms (id uuid primary key default gen_random_uuid(), name text not null, discipline text, documented_detroit_work text, likely_fit text, source_url text);
create table public.glossary (id uuid primary key default gen_random_uuid(), term text not null unique, definition text not null, learn_more_url text, status text not null default 'draft');
create table public.config (key text primary key, value jsonb not null);
create table public.data_sources (id uuid primary key default gen_random_uuid(), name text not null, url text, notes text);
do $$ declare t text; begin foreach t in array array['contacts','rules','architecture_firms','glossary','config','data_sources'] loop
 execute format('grant select on public.%I to anon, authenticated; grant all on public.%I to service_role; alter table public.%I enable row level security; create policy "public read" on public.%I for select to anon, authenticated using (true);', t,t,t,t);
end loop; end $$;
grant insert, update, delete on public.rules, public.contacts to authenticated;
create policy "admin write rules" on public.rules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin write contacts" on public.contacts for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- user tables
create table public.projects (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), address text, parcel_id text, project_type text not null, intended_use text not null, size text, created_at timestamptz default now());
create table public.project_checklists (project_id uuid primary key references public.projects(id) on delete cascade, user_id uuid not null default auth.uid(), step_state jsonb not null default '{}', updated_at timestamptz default now());
create table public.drafts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), project_id uuid references public.projects(id) on delete cascade, contact_id uuid references public.contacts(id), purpose text, subject text, body text, status text not null default 'draft' check (status in ('draft','approved','sent')), created_at timestamptz default now());
create table public.submission_log (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), project_id uuid references public.projects(id) on delete cascade, contact_id uuid references public.contacts(id), action text not null, occurred_at timestamptz not null default now(), reminder_date date, notes text);
do $$ declare t text; begin foreach t in array array['projects','project_checklists','drafts','submission_log'] loop
 execute format('grant select, insert, update, delete on public.%I to authenticated; grant all on public.%I to service_role; alter table public.%I enable row level security; create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());', t,t,t,t);
end loop; end $$;

create table public.feedback (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), message_id text not null, rating smallint not null check (rating in (-1,1)), comment text check (char_length(comment) <= 500));
grant insert on public.feedback to authenticated; grant all on public.feedback to service_role;
alter table public.feedback enable row level security;
create policy "signed in insert" on public.feedback for insert to authenticated with check (true);

create table public.tool_call_log (id uuid primary key default gen_random_uuid(), tool_name text not null, ran_at timestamptz default now(), success boolean not null);
create table public.daily_send_counts (user_id uuid not null, day date not null, count int not null default 0, primary key (user_id, day));
grant all on public.tool_call_log, public.daily_send_counts to service_role;
alter table public.tool_call_log enable row level security; alter table public.daily_send_counts enable row level security;

-- seeds
insert into public.config values ('stale_days','90'),('daily_email_cap','5'),('max_agent_iterations','6');
insert into public.contacts (name,type,helps_with,use_when,channel_type,channel_value,source_url,notes) values
('BSEED Development Resource Center','city','Project questions, Preliminary Plan Review meetings, pre-plan consultations.','Before anything is submitted.','phone','(313) 224-2372','https://detroitmi.gov/drc','Coleman A. Young Municipal Center, 4th floor.'),
('BSEED Plan Review Division','city','Building and trade code questions via Pre-Plan Consultation; coordinates Health, Water and Sewerage, Fire Marshal reviews.','Code questions before plan submittal.','web_form','Request form on city page','https://detroitmi.gov/departments/buildings-safety-engineering-and-environmental-department-bseed/bseed-divisions/permits-plan-review',null),
('BSEED Zoning Division','city','Use verification, site plan review, conditional use hearings.','Checking whether your use is allowed.','phone','Reached through the Development Resource Center',null,'Reached through the Development Resource Center.'),
('BSEED Construction Inspection','city','Certificates of Occupancy and Acceptance, after inspections pass.','After inspections pass.','email','bseed-construction@detroitmi.gov','https://detroitmi.gov/departments/buildings-safety-engineering-and-environmental-department/construction',null),
('DEGC District Business Liaisons','nonprofit','Free help with permitting, licensing, plan review, zoning variances, inspections; one liaison per council district.','First call for a small business.','web_form','Find your liaison on the web page','https://www.degc.org/?p=10055',null),
('DEGC Business Retention Program','nonprofit','Navigating city departments for industrial firms, corporate offices, and high-growth startups.','Industrial or high-growth projects.','web_form','Web form','https://www.degc.org/business-retention',null),
('Motor City Match','program','Space matching, funding, planning, and permitting help for small businesses.','Small business looking for space or funding.','web_form','Program page','https://playbook.detroitmi.gov/node/301',null),
('DWSD permits','city','Water and sewer service permits and taps, after plan review approval.','After plan review approval.','web_form','Online application','https://detroitmi.gov/DWSDpermits',null),
('City Planning Commission','city','Rezonings, zoning text amendments, Zone Detroit.','When the use is not allowed as of right.','email','cpc@detroitmi.gov','https://training.detroitmi.gov/government/commissions/city-planning-commission','Phone (313) 224-6225.'),
('Detroit Health Department plan review','city','Food service plan review.','Food service projects.','phone','Reached through the Development Resource Center',null,'Reached through the Development Resource Center.'),
('Detroit Land Bank Authority','authority','Buying land bank properties.','Buying a land bank property.','web_form','buildingdetroit.org','https://buildingdetroit.org',null),
('EGLE Environmental Assistance Center','state','Which state environmental permits a new facility needs.','New or reused industrial facility.','email','EGLE-Assist@Michigan.gov','https://www.michigan.gov/egle/regulatory-assistance/permits','Phone 800-662-9278.'),
('Michigan Manufacturing Technology Center','nonprofit','Consulting and regulatory help for manufacturers.','Manufacturing projects.','email','inquiry@the-center.org',null,'Phone (734) 451-4200.'),
('City Ombudsman','city','Remit not verified.','Escalation (unverified).','phone','Not specified in source',null,'Confirm what this office handles before using for escalation.');
insert into public.rules (project_type,use_category,step_order,approval_name,office,submit_where,documents_needed,source_url,notes,is_sample) values
('change_of_use','small_business',1,'SAMPLE STEP A — [placeholder approval name]','SAMPLE — [placeholder office]','SAMPLE — [placeholder location]','["SAMPLE document 1","SAMPLE document 2"]','https://detroitmi.gov/drc','SAMPLE CONTENT. Not a real requirement.',true),
('change_of_use','small_business',2,'SAMPLE STEP B — [placeholder approval name]','SAMPLE — [placeholder office]',null,'["SAMPLE document 3"]','https://detroitmi.gov/drc','SAMPLE CONTENT. Not a real requirement.',true),
('change_of_use','small_business',3,'SAMPLE STEP C — [placeholder approval name]',null,null,'[]',null,'SAMPLE CONTENT. Not a real requirement.',true);
insert into public.architecture_firms (name,discipline,documented_detroit_work,likely_fit,source_url) values
('Quinn Evans','Architecture, preservation','Pending: evidence to be added',null,null),('McIntosh Poris Architects','Architecture','Pending: evidence to be added',null,null),('M1DTW Architects','Architecture','Pending: evidence to be added',null,null),('PLY+ Architecture','Architecture','Pending: evidence to be added',null,null),('Gensler (Detroit office)','Architecture, interiors','Pending: evidence to be added',null,null),('VolumeOne Design Studio','Architecture','Pending: evidence to be added',null,null),('Kraemer Design Group','Architecture','Pending: evidence to be added',null,null),('Giffels Webster','Civil engineering, planning','Pending: evidence to be added',null,null),('Buro Happold','Engineering','Pending: evidence to be added',null,null),('TYLin','Engineering','Pending: evidence to be added',null,null);
insert into public.glossary (term,definition) values
('BSEED','Buildings, Safety Engineering and Environmental Department — the city office that reviews plans, issues building permits, and inspects work.'),
('DEGC','Detroit Economic Growth Corporation — a nonprofit that helps businesses grow in Detroit, including free permitting help.'),
('DWSD','Detroit Water and Sewerage Department — handles water and sewer connections and permits.'),
('EGLE','Michigan Department of Environment, Great Lakes, and Energy — the state agency for environmental permits.'),
('Zoning','City rules that say what kinds of uses (shops, homes, factories) are allowed on each piece of land.'),
('Conditional use','A use that may be allowed in a zoning district only after a review or hearing, often with conditions attached.'),
('Site plan review','A city review of how a project is laid out on its lot — buildings, parking, landscaping, access.'),
('Certificate of Occupancy','An official document saying a building can be legally used for its intended purpose.'),
('Certificate of Compliance','A city certificate showing a property meets code requirements, often needed before leasing or operating.'),
('Change of use','Switching how a space is used (for example, from a store to a restaurant), which can trigger new reviews.'),
('Variance','Permission to break a specific zoning rule because of a hardship particular to your property.'),
('Preliminary Plan Review','An early meeting with the city to talk through your plans before you formally submit.'),
('Blight ticket','A fine issued for property conditions that break city maintenance rules; open tickets can block permits.'),
('Land bank','A public authority that owns and sells vacant or abandoned properties — in Detroit, the Detroit Land Bank Authority.');
insert into public.data_sources (name,url,notes) values
('Parcels (Assessor)','https://data.detroitmi.gov','Includes zoning field; prefer over older zoning layer.'),('Base Units: Buildings','https://data.detroitmi.gov',null),('Building Permits (BSEED)','https://data.detroitmi.gov',null),('Building Permit Plan Reviews','https://data.detroitmi.gov',null),('Certificate of Occupancy','https://data.detroitmi.gov',null),('Blight Tickets','https://apis.detroitmi.gov/data/blight_violations.zip','Portal download sometimes unavailable.'),('Active Commercial Certificates of Compliance','https://data.detroitmi.gov',null),('Active Residential Certificates of Compliance and Rental Registrations','https://data.detroitmi.gov',null),('DLBA Owned Properties','https://data.detroitmi.gov',null),('Designated and Eligible Historic Districts','https://data.detroitmi.gov','2013 compilation: possible historic review, confirm with the commission.');