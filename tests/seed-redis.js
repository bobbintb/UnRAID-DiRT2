const { connectToRedis, getFileMetadataRepository, getRedisClient, closeRedis } = require('../nodejs/redis');

async function seedDatabase() {
  console.log('Starting to seed the database...');
  let redisClient;
  let fileMetadataRepository;

  try {
    // Connect to Redis using the centralized function
    const connections = await connectToRedis();
    redisClient = connections.redisClient;
    fileMetadataRepository = connections.fileMetadataRepository;
    console.log('Connected to Redis.');

    // Step 1: Clear existing data
    const keys = await redisClient.keys('ino:*');
    if (keys.length > 0) {
      console.log(`Deleting ${keys.length} existing file records...`);
      await redisClient.del(keys);
    } else {
      console.log('No existing file records to delete.');
    }

    // Step 2: Define sample data
    const sampleFiles = [
        // --- Scenario 1: Files with no hash (potential duplicates by size) ---
        {
            ino: 1001,
            path: ['/mnt/user/downloads/incomplete/movie.mkv'],
            shares: ['downloads'],
            size: 8589934592, // 8 GB
            nlink: 1,
            atime: new Date('2023-10-26T10:00:00Z'),
            mtime: new Date('2023-10-26T10:00:00Z'),
            ctime: new Date('2023-10-26T10:00:00Z'),
            // No hash
        },
        {
            ino: 1002,
            path: ['/mnt/user/media/movies/Movie (2023).mkv'],
            shares: ['media'],
            size: 8589934592, // 8 GB
            nlink: 1,
            atime: new Date('2023-10-25T14:30:00Z'),
            mtime: new Date('2023-10-25T14:30:00Z'),
            ctime: new Date('2023-10-25T14:30:00Z'),
            // No hash
        },

        // --- Scenario 2: A file with a unique hash ---
        {
            ino: 2001,
            path: ['/mnt/user/documents/archive.zip'],
            shares: ['documents'],
            size: 5242880, // 5 MB
            nlink: 1,
            atime: new Date('2023-11-01T09:00:00Z'),
            mtime: new Date('2023-11-01T09:00:00Z'),
            ctime: new Date('2023-11-01T09:00:00Z'),
            hash: 'unique_hash_abcdef123456',
        },

        // --- Scenario 3: Duplicate Group 1 (3 files) ---
        {
            ino: 3001,
            path: ['/mnt/user/photos/vacation/IMG_001.jpg'],
            shares: ['photos'],
            size: 4194304, // 4 MB
            nlink: 1,
            atime: new Date('2023-08-15T18:20:00Z'),
            mtime: new Date('2023-08-15T18:20:00Z'),
            ctime: new Date('2023-08-15T18:20:00Z'),
            hash: 'duplicate_hash_A_9876543210',
        },
        {
            ino: 3002,
            path: ['/mnt/user/backups/photos_2023/IMG_001_copy.jpg'],
            shares: ['backups'],
            size: 4194304, // 4 MB
            nlink: 1,
            atime: new Date('2023-09-01T11:00:00Z'),
            mtime: new Date('2023-09-01T11:00:00Z'),
            ctime: new Date('2023-09-01T11:00:00Z'),
            hash: 'duplicate_hash_A_9876543210',
        },
        {
            ino: 3003,
            path: ['/mnt/user/staging/sorted/IMG_001.jpg'],
            shares: ['staging'],
            size: 4194304, // 4 MB
            nlink: 1,
            atime: new Date('2023-10-20T15:00:00Z'),
            mtime: new Date('2023-10-20T15:00:00Z'),
            ctime: new Date('2023-10-20T15:00:00Z'),
            hash: 'duplicate_hash_A_9876543210',
        },

        // --- Scenario 4: Duplicate Group 2 (2 files) ---
        {
            ino: 4001,
            path: ['/mnt/user/downloads/document.pdf'],
            shares: ['downloads'],
            size: 1048576, // 1 MB
            nlink: 1,
            atime: new Date('2023-11-05T12:00:00Z'),
            mtime: new Date('2023-11-05T12:00:00Z'),
            ctime: new Date('2023-11-05T12:00:00Z'),
            hash: 'duplicate_hash_B_fedcba54321',
        },
        {
            ino: 4002,
            path: ['/mnt/user/documents/important/document_final.pdf'],
            shares: ['documents'],
            size: 1048576, // 1 MB
            nlink: 1,
            atime: new Date('2023-11-05T12:05:00Z'),
            mtime: new Date('2023-11-05T12:05:00Z'),
            ctime: new Date('2023-11-05T12:05:00Z'),
            hash: 'duplicate_hash_B_fedcba54321',
        },
    ];

    console.log(`Preparing to seed ${sampleFiles.length} file records...`);

    // Step 3: Save data to Redis in parallel for performance
    const savePromises = sampleFiles.map(fileData =>
        fileMetadataRepository.save(fileData.ino.toString(), fileData)
    );
    await Promise.all(savePromises);

    console.log('Successfully seeded the database.');

    // Step 4: Verify by fetching data back
    const allFiles = await fileMetadataRepository.search().return.all();
    console.log(`Verification: Found ${allFiles.length} records in the database.`);
    console.log(JSON.stringify(allFiles, null, 2));


  } catch (error) {
    console.error('An error occurred during seeding:', error);
  } finally {
    // Disconnect from Redis using the centralized function
    await closeRedis();
    console.log('Disconnected from Redis.');
  }
}

seedDatabase();
