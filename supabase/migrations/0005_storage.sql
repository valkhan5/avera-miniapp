-- Supabase-only: photo bucket and realtime (not run in local tests)
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "managers upload images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "managers update images" on storage.objects for update to authenticated using (bucket_id = 'product-images');
create policy "managers delete images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');
alter publication supabase_realtime add table public.orders;
