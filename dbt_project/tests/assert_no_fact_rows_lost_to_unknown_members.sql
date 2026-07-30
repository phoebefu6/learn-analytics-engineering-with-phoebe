-- Unknown members exist so a broken dimension lookup stays countable instead of vanishing.
-- If the share ever climbs above 1%, the load is quietly dropping context.
select 'fct_order_items' as fact_name,
       count(*) as total_rows,
       sum(case when merchant_sk = '-1' or product_sk = '-1' or user_sk = '-1' then 1 else 0 end) as unknown_rows
from {{ ref('fct_order_items') }}
group by 1
having sum(case when merchant_sk = '-1' or product_sk = '-1' or user_sk = '-1' then 1 else 0 end) * 1.0 / count(*) > 0.01
