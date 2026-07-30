-- Type 2 structure. dbt has a first-class answer for this - snapshots - and session b6
-- builds one. This model is the current-version view of it, so the mart layer stays
-- readable while the snapshot keeps the history.
with merchants as (select * from {{ ref('stg_bazaar__merchants') }})

select
    {{ surrogate_key(['merchant_id']) }}  as merchant_sk,
    merchant_id,
    merchant_name,
    merchant_category,
    merchant_country,
    merchant_tier,
    commission_pct,
    joined_on,
    joined_on                             as valid_from,
    cast('9999-12-31' as date)            as valid_to,
    true                                  as is_current
from merchants
