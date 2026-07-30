-- A derived measure that no longer equals its parts means the model is internally
-- inconsistent, and every SUM downstream inherits the inconsistency.
select order_id, line_no, gross_amount, discount_amount, net_amount
from {{ ref('fct_order_items') }}
where abs(net_amount - (gross_amount - discount_amount)) > 0.01
