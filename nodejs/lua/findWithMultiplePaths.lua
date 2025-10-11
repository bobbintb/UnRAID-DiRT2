local cursor = '0'
local pattern = ARGV[1]
local separator = ARGV[2]
local all_results = {}

repeat
  local scan_results = redis.call('SCAN', cursor, 'MATCH', pattern)
  cursor = scan_results[1]
  local keys = scan_results[2]
  for i, key in ipairs(keys) do
    if redis.call('TYPE', key).ok == 'hash' then
      local path_str = redis.call('HGET', key, 'path')
      if path_str and string.find(path_str, separator) then
        local obj = redis.call('HGETALL', key)
        table.insert(all_results, obj)
      end
    end
  end
until cursor == '0'

return all_results