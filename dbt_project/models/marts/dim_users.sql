-- Type 1: attributes overwritten in place. Nobody has ever asked for the history of a
-- shopper's city. tenure_bucket is banded here so no dashboard writes its own CASE.
with users as (select * from {{ ref('stg_bazaar__users') }})

select
    {{ surrogate_key(['user_id']) }}   as user_sk,
    user_id,
    user_country,
    user_city,
    acquisition_channel,
    cast(signed_up_at as date)         as signed_up_on,
    case
        when date_diff('day', cast(signed_up_at as date), date '2026-06-29') < 90  then 'new'
        when date_diff('day', cast(signed_up_at as date), date '2026-06-29') < 365 then '3-12m'
        else '1y+'
    end                                as tenure_bucket,
    is_guest
from users
