-- The one dimension you never source: generated, wider than the data, and every calendar
-- attribute anyone will group by. DuckDB's generate_series does the walking.
with days as (
    select cast(range as date) as date_day
    from range(date '2026-03-01', date '2026-10-01', interval 1 day)
)

select
    {{ surrogate_key(['date_day']) }}          as date_key,
    date_day,
    year(date_day)                             as year_number,
    quarter(date_day)                          as quarter_number,
    month(date_day)                            as month_number,
    monthname(date_day)                        as month_name,
    day(date_day)                              as day_of_month,
    dayofweek(date_day)                        as day_of_week,
    dayname(date_day)                          as day_name,
    week(date_day)                             as week_of_year,
    dayofweek(date_day) in (0, 6)              as is_weekend
from days
