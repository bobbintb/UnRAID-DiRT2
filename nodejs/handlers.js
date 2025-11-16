const { findDuplicates, getFileMetadataRepository, getRedisClient, actionQueue } = require('./redis.js');
const { hashFile } = require('./utils');
const broadcaster = require('./broadcaster');
const fs = require('fs').promises;


async function handleUpsert(job) {
    const { path } = job.data;
    const repository = getFileMetadataRepository();
    const redisClient = getRedisClient();

    try {
        const stats = await fs.stat(path);
        const ino = stats.ino.toString();

        let fileEntity = await repository.fetch(ino);
        const existingPaths = new Set(fileEntity.path || []);

        if (existingPaths.has(path)) {
            console.log(`[HANDLER] Path '${path}' already exists for ino '${ino}'. Skipping update.`);
            return;
        }

        const newPaths = [...existingPaths, path];
        const newShares = [...new Set(newPaths.map(p => p.split('/')[3]))];

        fileEntity.path = newPaths;
        fileEntity.shares = newShares;
        fileEntity.nlink = stats.nlink;
        fileEntity.atime = stats.atime;
        fileEntity.mtime = stats.mtime;
        fileEntity.ctime = stats.ctime;

        if (!fileEntity.hash || existingPaths.size === 0) {
            fileEntity.hash = await hashFile(path);
        }

        await repository.save(fileEntity);
        console.log(`[HANDLER] Upserted file metadata for ino '${ino}' with new path '${path}'.`);

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`[HANDLER] File not found during upsert: ${path}. It may have been deleted.`);
        } else {
            console.error(`[HANDLER] Error processing upsert for path '${path}':`, error);
        }
    }
}

async function handleRemove(job) {
    const { path } = job.data;
    const repository = getFileMetadataRepository();

    try {
        const searchResults = await repository.search().where('path').contains(path).return.all();
        if (searchResults.length === 0) {
            console.log(`[HANDLER] No record found with path '${path}'. Nothing to remove.`);
            return;
        }

        for (const entity of searchResults) {
            const ino = entity.entityId;
            const currentPaths = new Set(entity.path);

            if (currentPaths.size > 1) {
                currentPaths.delete(path);
                const newShares = [...new Set([...currentPaths].map(p => p.split('/')[3]))];

                entity.path = [...currentPaths];
                entity.shares = newShares;

                await repository.save(entity);
                console.log(`[HANDLER] Removed path '${path}' from ino '${ino}'.`);
            } else {
                await repository.remove(ino);
                await getRedisClient().hDel('actions', ino);
                console.log(`[HANDLER] Removed entity for ino '${ino}' as it was the last path.`);
            }
        }
    } catch (error) {
        console.error(`[HANDLER] Error processing remove for path '${path}':`, error);
    }
}

async function handleRename(job) {
    const { oldPath, newPath } = job.data;
    const repository = getFileMetadataRepository();

    try {
        const searchResults = await repository.search().where('path').contains(oldPath).return.all();
        if (searchResults.length === 0) {
            console.log(`[HANDLER] No record found with path '${oldPath}'. Cannot rename.`);
            return;
        }

        for (const entity of searchResults) {
            const ino = entity.entityId;
            const currentPaths = new Set(entity.path);

            currentPaths.delete(oldPath);
            currentPaths.add(newPath);

            const newShares = [...new Set([...currentPaths].map(p => p.split('/')[3]))];

            entity.path = [...currentPaths];
            entity.shares = newShares;

            await repository.save(entity);
            console.log(`[HANDLER] Renamed path for ino '${ino}' from '${oldPath}' to '${newPath}'.`);
        }
    } catch (error) {
        console.error(`[HANDLER] Error processing rename from '${oldPath}' to '${newPath}':`, error);
    }
}


async function findDuplicatesAndBroadcast(ws) {
    const redisClient = getRedisClient();
    const [duplicates, state, actions, waitingJobs] = await Promise.all([
        findDuplicates(),
        redisClient.hGetAll('state'),
        redisClient.hGetAll('actions'),
        actionQueue.getWaiting(),
    ]);

    // Transform the BullMQ jobs into the simple { path: action } format the frontend expects
    const queue = waitingJobs.reduce((acc, job) => {
        acc[job.data.path] = job.name; // job.name is the action, e.g., 'delete'
        return acc;
    }, {});

    // Before sending, augment the duplicates with the isOriginal flag and actions
    for (const group of duplicates) {
        const originalIno = state[group.hash];
        group.files.forEach(file => {
            if (originalIno && file.ino === originalIno) {
                file.isOriginal = true;
            }
            file.action = actions[file.ino] || null;
        });
    }

    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
            action: 'duplicateFiles',
            data: {
                duplicates,
                state,
                queue,
            },
        }));
    }
}

module.exports = {
    handleUpsert,
    handleRemove,
    handleRename,
    findDuplicatesAndBroadcast,
};
