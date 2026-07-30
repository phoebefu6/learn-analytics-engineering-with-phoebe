-- GRAIN: one date-hour. Serves peak-hour, staffing and deploy-window questions. Built from
-- the payments fact because the question is about when money MOVES.
with facts as (select * from {{ ref('fct_transactions') }}),
     dates as (select * from {{ ref('dim_dates') }}),
     hours as (select * from {{ ref('dim_time_of_day') }})

select
    dates.date_day        as activity_date,
    dates.day_name,
    dates.is_weekend,
    hours.hour_24,
    hours.hour_label,
    hours.daypart,
    count(*)              as attempts,
    sum(facts.is_approved) as approvals,
    sum(facts.is_declined) as declines,
    round(sum(facts.approved_amount), 2) as approved_amount,
    round(sum(facts.declined_amount), 2) as declined_amount,
    count(distinct facts.order_id) as orders_touched
from facts
join dates on dates.date_key = facts.date_key
join hours on hours.time_key = facts.time_key
group by 1, 2, 3, 4, 5, 6
