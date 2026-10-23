-- When each order was delivered.
--
-- The delivery report and the per-person delivery note print the time a
-- meal was marked Delivered, which nothing recorded: update_order_status
-- only swapped the status. delivered_at is stamped the first time an order
-- reaches 'delivered' (re-marking it keeps the original time) and cleared if
-- the batch is moved back to an earlier status. Orders delivered before this
-- migration keep a null time — the documents print "time not recorded".

alter table orders add column if not exists delivered_at timestamptz;

create or replace function update_order_status(p_order_id uuid, p_new_status order_status)
returns setof orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_key text;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select batch_key into v_batch_key from orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return query
  update orders
  set status = p_new_status,
      delivered_at = case when p_new_status = 'delivered' then coalesce(delivered_at, now()) else null end
  where batch_key = v_batch_key and status <> 'cancelled'
  returning *;
end;
$$;
