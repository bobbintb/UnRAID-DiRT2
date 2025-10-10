local cursor = '0'
local pattern = ARGV[1]
local hash_counts = {}
local duplicate_hashes = {}
local all_results = {}

-- First pass: count hashes
repeat
  local scan_results = redis.call('SCAN', cursor, 'MATCH', pattern)
  cursor = scan_results[1]
  local keys = scan_results[2]
  for i, key in ipairs(keys) do
    local hash = redis.call('HGET', key, 'hash')
    if hash then
      hash_counts[hash] = (hash_counts[hash] or 0) + 1
    end
  end
until cursor == '0'

-- Identify duplicate hashes
for hash, count in pairs(hash_counts) do
  if count > 1 then
    table.insert(duplicate_hashes, hash)
  end
end

-- Second pass: find all objects with duplicate hashes
cursor = '0'
repeat
  local scan_results = redis.call('SCAN', cursor, 'MATCH', pattern)
  cursor = scan_results[1]
  local keys = scan_results[2]
  for i, key in ipairs(keys) do
    local hash = redis.call('HGET', key, 'hash')
    if hash then
      for _, dup_hash in ipairs(duplicate_hashes) do
        if hash == dup_hash then
          local obj = redis.call('HGETALL', key)
          table.insert(all_results, obj)
          break
        end
      end
    end
  end
until cursor == '0'

return all_results