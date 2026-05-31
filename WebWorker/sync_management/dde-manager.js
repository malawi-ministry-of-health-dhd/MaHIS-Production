/**
 * Handles DDE (Dynamic Data Exchange) ID management
 */
const DdeManager = {
    async createDdeIndex(remoteDB) {
        try {
            await remoteDB.createIndex({
                index: {
                    fields: ["_id"],
                    name: "id-index",
                    ddoc: "id-index",
                },
            });
            console.log("[DDE] Created index for _id sorting");
        } catch (error) {
            if (error.status !== 409) {
                console.warn("[DDE] Failed to create index:", error);
            }
        }
    },

    async countLocalDdeIds(localDB, deviceId) {
        try {
            const result = await localDB.find({
                selector: {
                    $and: [{ assignedTo: deviceId }, { status: "used" }, { consumed: { $exists: false } }],
                },
            });
            return result.docs.length;
        } catch (error) {
            console.error("[DDE] Error counting local IDs:", error);
            return 0;
        }
    },

    async claimDdeIds(remoteUrl, options = {}, deviceId, targetCount = SYNC_CONFIG.DDE.TARGET_COUNT, maxRetries = SYNC_CONFIG.DDE.MAX_RETRIES) {
        try {
            // Step 1: Ensure DDE database exists on both local and remote
            const localDB = DatabaseManager.getDatabaseInstance("dde");
            const remoteDB = await SyncUtils.ensureDatabaseExists(remoteUrl, "dde", options);

            // Step 2: Create index for sorting (if not exists)
            await this.createDdeIndex(remoteDB);

            console.log(`[DDE] Starting ID claim process for device: ${deviceId}`);

            // Step 3: Check current local count
            const currentCount = await this.countLocalDdeIds(localDB, deviceId);
            console.log(`[DDE] Current local ID count: ${currentCount}/${targetCount}`);

            if (currentCount >= targetCount) {
                console.log(`[DDE] Already have enough IDs (${currentCount}/${targetCount}), skipping claim`);
                return [];
            }

            const needed = targetCount - currentCount;
            console.log(`[DDE] Need to claim ${needed} more IDs`);

            let claimedIds = [];
            let attempt = 0;
            let totalClaimed = 0;

            while (totalClaimed < needed && attempt < maxRetries) {
                attempt++;
                console.log(`[DDE] Claim attempt ${attempt}/${maxRetries}, need ${needed - totalClaimed} more IDs`);

                try {
                    // Step 4: Find available IDs
                    const availableResult = await remoteDB.find({
                        selector: {
                            $and: [{ status: { $exists: false } }, { assignedTo: { $exists: false } }, { assignedAt: { $exists: false } }],
                        },
                        limit: needed - totalClaimed + 5, // Get a few extra in case of conflicts
                    });

                    if (availableResult.docs.length === 0) {
                        console.log("[DDE] No available IDs to claim");
                        break;
                    }

                    // Sort the results locally to ensure consistent ordering
                    const sortedDocs = availableResult.docs.sort((a, b) => a._id.localeCompare(b._id));
                    const docsToTry = sortedDocs.slice(0, needed - totalClaimed);

                    console.log(`[DDE] Found ${availableResult.docs.length} potentially available IDs, trying ${docsToTry.length}`);

                    // Step 5: Attempt to claim each ID atomically using update conflicts
                    const claimResults = await Promise.allSettled(
                        docsToTry.map(async (doc) => {
                            try {
                                // Create the claimed version
                                const claimedDoc = {
                                    ...doc,
                                    status: "used",
                                    assignedTo: deviceId,
                                    assignedAt: new Date().toISOString(),
                                };

                                // Atomic update - will fail if document was modified by another device
                                const result = await remoteDB.put(claimedDoc);
                                console.log(`[DDE] Successfully claimed ID: ${doc._id}`);

                                // Update the document with the new rev for local storage
                                claimedDoc._rev = result.rev;
                                return { success: true, doc: claimedDoc, id: doc._id };
                            } catch (error) {
                                if (error.status === 409) {
                                    // Conflict - another device claimed this ID
                                    console.log(`[DDE] ID ${doc._id} already claimed by another device`);
                                    return { success: false, reason: "conflict", id: doc._id };
                                } else {
                                    console.error(`[DDE] Error claiming ID ${doc._id}:`, error);
                                    return { success: false, reason: "error", id: doc._id, error };
                                }
                            }
                        })
                    );

                    // Step 6: Collect successful claims
                    const successfulClaims = claimResults
                        .filter((result) => result.status === "fulfilled" && result.value.success)
                        .map((result) => result.value);

                    if (successfulClaims.length > 0) {
                        // Step 7: Store claimed IDs in local database
                        const localDocs = successfulClaims.map((claim) => {
                            const { _rev, ...docWithoutRev } = claim.doc;
                            return docWithoutRev;
                        });

                        console.log(`[DDE] Storing ${localDocs.length} documents in local database`);

                        try {
                            const bulkResult = await localDB.bulkDocs(localDocs);
                            const errors = bulkResult.filter((result) => result.error);
                            const successes = bulkResult.filter((result) => !result.error);

                            console.log(`[DDE] Bulk insert: ${successes.length} success, ${errors.length} errors`);

                            if (errors.length > 0) {
                                console.error("[DDE] Bulk insert errors:", errors);
                            }
                        } catch (bulkError) {
                            console.error("[DDE] Error storing documents locally:", bulkError);
                        }

                        const newClaimedIds = successfulClaims.map((claim) => claim.id);
                        claimedIds = [...claimedIds, ...newClaimedIds];
                        totalClaimed += successfulClaims.length;

                        console.log(`[DDE] Successfully claimed ${successfulClaims.length} IDs in this attempt (${totalClaimed}/${needed} total)`);

                        // Check if we have enough now
                        if (totalClaimed >= needed) {
                            console.log(`[DDE] Successfully claimed enough IDs (${totalClaimed}/${needed})`);
                            break;
                        }
                    } else {
                        console.log(`[DDE] No IDs successfully claimed in attempt ${attempt}, retrying...`);
                        // Add a small random delay to reduce synchronization between devices
                        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));
                    }
                } catch (error) {
                    console.error(`[DDE] Error during claim attempt ${attempt}:`, error);
                    if (attempt < maxRetries) {
                        // Wait before retrying with exponential backoff
                        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    }
                }
            }

            // Final verification
            const finalCount = await this.countLocalDdeIds(localDB, deviceId);
            console.log(`[DDE] Final local ID count: ${finalCount}/${targetCount}`);

            if (claimedIds.length === 0 && totalClaimed === 0) {
                console.warn(`[DDE] Failed to claim any new IDs after ${maxRetries} attempts`);
            }

            return claimedIds;
        } catch (error) {
            console.error("[DDE] Critical error in claimDdeIds:", error);
            return [];
        }
    },
};
