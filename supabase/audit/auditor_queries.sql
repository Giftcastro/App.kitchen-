-- YKC AUDITOR QUERIES. Read only: nothing here changes data.
-- Run each query on its own in the Supabase SQL Editor or DataGrip.
-- Change the dates or order number between the quotes.

-- A. Monthly totals for a tax period, by delivery date.
SELECT TO_CHAR(target_delivery_date, 'YYYY-MM') AS month,
       COUNT(*) AS orders,
       SUM(item_subtotal) AS meals_before_discount,
       SUM(discount_zar) AS discounts,
       SUM(delivery_fee) AS delivery_fees,
       SUM(vat_amount) AS vat,
       SUM(total_amount) AS total
FROM public.orders
WHERE target_delivery_date BETWEEN '2026-03-01' AND '2027-02-28'
  AND status NOT IN ('pending_payment', 'cancelled')
GROUP BY 1
ORDER BY 1;

-- B. Every order in a period, including those of deleted customers.
SELECT order_number, tax_invoice_number, target_delivery_date, status,
       COALESCE(company_name_snapshot, 'Not recorded') AS company,
       company_location, item_subtotal, discount_zar, delivery_fee, vat_amount, total_amount,
       payment_method, payment_reference, itn_verified_at, created_at,
       CASE WHEN user_id IS NULL THEN 'Anonymised' ELSE 'Active customer' END AS customer_state,
       anonymised_at
FROM public.orders
WHERE target_delivery_date BETWEEN '2026-03-01' AND '2027-02-28'
  AND status NOT IN ('pending_payment', 'cancelled')
ORDER BY target_delivery_date, order_number;

-- C. One order: find it by order or invoice number.
SELECT o.order_number, o.tax_invoice_number, o.target_delivery_date, o.status, o.total_amount,
       i.dish_name, i.size, i.quantity, i.unit_price, i.total_price
FROM public.orders o
LEFT JOIN public.order_items i ON i.order_id = o.id
WHERE o.order_number = 'ORD-2026-XXXXXXXXXX-KCO' OR o.tax_invoice_number = 'INV-KC-XXXXXXXXXX';

-- D. The PayFast payment behind an order. Compare pf_payment_id with PayFast's own statement.
SELECT o.order_number, p.amount, p.status, p.pf_payment_id, p.created_at, p.completed_at
FROM public.orders o
JOIN public.payment_intents p ON p.id = o.payment_intent_id
WHERE o.order_number = 'ORD-2026-XXXXXXXXXX-KCO';

-- E. Only anonymised records, and the date each may be removed.
SELECT order_number, tax_invoice_number, target_delivery_date, company_name_snapshot, total_amount,
       anonymised_at,
       (target_delivery_date + INTERVAL '5 years')::DATE AS may_be_removed_after
FROM public.orders
WHERE user_id IS NULL AND anonymised_at IS NOT NULL
ORDER BY target_delivery_date;

-- F. The register of deletions: when, how many orders were kept, and until when.
SELECT anonymised_at, orders_retained, retain_until
FROM public.anonymisation_log
ORDER BY anonymised_at DESC;
