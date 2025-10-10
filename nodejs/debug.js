const { findBySize, findWithMultiplePaths, findWithNonUniqueHashes } = require('./redis');

async function debugFindFilesBySize(size) {
    console.log(`Executing debug query: findBySize with size ${size}`);
    const results = await findBySize(size);
    console.log(`Found ${results.length} files of size ${size}:`, results.map(r => r.toJSON()));
    return results;
}

async function debugFindFilesWithMultiplePaths() {
    console.log('Executing debug query: findWithMultiplePaths');
    const results = await findWithMultiplePaths();
    console.log(`Found ${results.length} files with multiple paths:`, results.map(r => r.toJSON()));
    return results;
}

async function debugFindFilesWithNonUniqueHashes() {
    console.log('Executing debug query: findWithNonUniqueHashes');
    const results = await findWithNonUniqueHashes();
    console.log(`Found ${results.length} files with non-unique hashes:`, results.map(r => r.toJSON()));
    return results;
}

module.exports = {
    debugFindFilesBySize,
    debugFindFilesWithMultiplePaths,
    debugFindFilesWithNonUniqueHashes,
};