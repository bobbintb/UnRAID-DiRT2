-- ARGV[1]: pattern to match keys (e.g., 'file:*')
local pattern = ARGV[1]
local cursor = '0'
local hashes = {}

-- First and only pass: scan keys and group by hash
repeat
    local scan_results = redis.call('SCAN', cursor, 'MATCH', pattern)
    cursor = scan_results[1]
    local keys = scan_results[2]
    for i, key in ipairs(keys) do
        local hash = redis.call('HGET', key, 'hash')
        if hash then
            if hashes[hash] == nil then
                hashes[hash] = {}
            end
            local obj = redis.call('HGETALL', key)
            table.insert(hashes[hash], obj)
        end
    end
until cursor == '0'

-- Filter out hashes that are not duplicates
local result = {}
for hash, objects in pairs(hashes) do
    if #objects > 1 then
        table.insert(result, objects)
    end
end

return result