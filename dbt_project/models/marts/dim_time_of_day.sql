-- Hour grain, kept out of dim_dates on purpose: putting hours in the date dimension would
-- multiply it by 24 for no benefit, and "what are our peak hours" needs to group across all
-- 90 days at once.
with hours as (select cast(range as integer) as hour_24 from range(0, 24))

select
    hour_24                                    as time_key,
    hour_24,
    lpad(cast(hour_24 as varchar), 2, '0') || ':00-' ||
      lpad(cast(hour_24 as varchar), 2, '0') || ':59' as hour_label,
    case
        when hour_24 < 6  then 'overnight'
        when hour_24 < 11 then 'morning'
        when hour_24 < 14 then 'lunch'
        when hour_24 < 18 then 'afternoon'
        when hour_24 < 23 then 'evening'
        else 'late'
    end                                        as daypart,
    hour_24 between 9 and 18                   as is_business_hour
from hours
