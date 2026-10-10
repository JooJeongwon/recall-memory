-- Read-only predeployment checks. Results contain counts only, no user IDs or file names.

select j.jobname, j.schedule, j.active, r.status, r.start_time, r.end_time
from cron.job j
left join lateral (
  select status, start_time, end_time
  from cron.job_run_details
  where jobid = j.jobid
  order by start_time desc
  limit 5
) r on true
where j.jobname = 'recall-maintenance'
order by r.start_time desc nulls last;

select kind, status, count(*) as jobs, min(run_after) as next_attempt
from public.cleanup_jobs
group by kind, status
order by kind, status;

select lifecycle, count(*) as photos
from public.photos
group by lifecycle
order by lifecycle;

select bucket_id, count(*) as objects,
  coalesce(sum(case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
    then (metadata ->> 'size')::bigint else 0 end), 0) as bytes
from storage.objects
where bucket_id = 'memory-assets'
group by bucket_id;
