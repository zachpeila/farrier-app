-- 1. Wrap auth.uid() in (select auth.uid()) in every public RLS policy so it is evaluated once per query, not per row
do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for r in
    select pol.polname, c.relname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) as qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as wcheck
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
  loop
    new_qual  := regexp_replace(r.qual,   '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    new_check := regexp_replace(r.wcheck, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    if new_qual is distinct from r.qual or new_check is distinct from r.wcheck then
      stmt := format('alter policy %I on public.%I', r.polname, r.relname);
      if new_qual is not null then
        stmt := stmt || format(' using (%s)', new_qual);
      end if;
      if new_check is not null then
        stmt := stmt || format(' with check (%s)', new_check);
      end if;
      execute stmt;
    end if;
  end loop;
end $$;

-- 2. Add a covering index for every public foreign key that lacks one
do $$
declare
  r record;
  cols text;
begin
  for r in
    select con.conname, con.conrelid, con.conkey, cl.relname
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where con.contype = 'f' and n.nspname = 'public'
       and not exists (
         select 1 from pg_index i
          where i.indrelid = con.conrelid
            and (i.indkey::int2[])[0:array_length(con.conkey,1)-1] = con.conkey
       )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord)
      into cols
      from unnest(r.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;
    execute format('create index if not exists %I on public.%I (%s)',
                   left(r.conname, 59) || '_idx', r.relname, cols);
  end loop;
end $$;
