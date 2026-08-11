-- 真题演练：为客户端重试增加幂等请求 ID，避免网络重试重复写入练习记录。
alter table practice_records
  add column if not exists client_request_id uuid;

create unique index if not exists practice_records_user_client_request_uidx
  on practice_records(user_id, client_request_id);
