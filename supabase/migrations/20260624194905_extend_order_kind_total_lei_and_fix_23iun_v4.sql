ALTER TABLE shop_orders DROP CONSTRAINT shop_orders_order_kind_check;
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_order_kind_check
  CHECK (order_kind = ANY (ARRAY['standard','preorder','manual','cadou','consum_propriu']));

ALTER TABLE shop_orders DROP CONSTRAINT shop_orders_total_lei_check;
ALTER TABLE shop_orders ADD CONSTRAINT shop_orders_total_lei_check
  CHECK (total_lei >= 0);
