-- Supabase-only: photo uploads limited to listed managers (not run in local tests)
drop policy "managers upload images" on storage.objects;
drop policy "managers update images" on storage.objects;
drop policy "managers delete images" on storage.objects;
create policy "managers upload images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_manager());
create policy "managers update images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_manager());
create policy "managers delete images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_manager());
