/**
 * If the report settings contain the same query embedding for multiple grid states, this module
 * removes that query embedding from all of the grid states, since the approach of using query
 * embeddings to match queries to grid states relies on queries being different, so the approach
 * wouldn't work.  Removing the query embeddings means that the grid state matching will fall back
 * to relying on query order.
 */
Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover = (() => {

    /**
     * Removes any duplicated query embeddings from the report settings, since the query embedding-
     * based matching doesn't work when the same query is repeated.
     */
    const removeDuplicateQueryEmbeddings = (settings) => {

        if (!settings?.gridState) return;

        const counts = new Map();

        for (const key in settings.gridState) {

            const embedding = settings.gridState[key]?.queryEmbedding;

            if (!embedding) continue;

            const serialized = JSON.stringify(embedding);

            counts.set(serialized, (counts.get(serialized) || 0) + 1);
        }

        for (const key in settings.gridState) {

            const entry = settings.gridState[key];

            if (!entry?.queryEmbedding) continue;

            if (counts.get(JSON.stringify(entry.queryEmbedding)) > 1) {
                delete entry.queryEmbedding;
            }
        }
    };

    return {
        removeDuplicateQueryEmbeddings
    };
})();
