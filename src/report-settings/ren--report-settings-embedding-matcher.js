/**
 * Pairs saved settings back up with the queries they were saved against, by query embedding and
 * columns, where editing the SQL has moved the queries away from the keys the settings are under.
 */
Ren.SettingsEmbeddingMatcher = (() => {

    const SIMILARITY_THRESHOLD = 0.7;

    // The columns weigh more than the embedding because they say what the query produced, whereas
    // the embedding only says how its SQL was written.
    const COLUMN_OVERLAP_WEIGHT = 0.6;

    // Allows for the rounding in embeddings saved before they were stored as whole-number counts.
    const SAME_QUERY_SIMILARITY = 0.9999;

    // Pairings whose combined scores differ by less than this are too close for the scores to
    // choose between, so the order of the tabs chooses instead.
    const TIE_MARGIN = 0.02;

    /**
     * Gets a lookup of the names a query's columns could be saved under, both of which are used:
     * grid state names its columns by ID or heading, and an Editor-path key by heading alone.
     */
    const getQueryColumnLookup = (columnModels) => {

        const lookup = {};

        if (!columnModels) {
            return { lookup, count: 0 };
        }

        for (let i = 0; i < columnModels.length; i++) {

            if (columnModels[i].Heading) {
                lookup[columnModels[i].Heading] = true;
            }

            if (columnModels[i].ColumnIdOrHeading) {
                lookup[columnModels[i].ColumnIdOrHeading] = true;
            }
        }

        return {
            lookup,
            count: columnModels.length
        };
    };

    /**
     * Gets a query in the form it is scored in, identified by its data tab's index so that two tabs
     * running the same SQL are still told apart.
     */
    const createQuery = (tabIndex, tabularData) => {

        const columns = getQueryColumnLookup(tabularData.ColumnModels);

        return {
            signature: String(tabIndex),
            embedding: tabularData.QueryEmbedding,
            columnLookup: columns.lookup,
            columnCount: columns.count
        };
    };

    /**
     * Gets the columns a settings entry was saved against, which data grouping settings carry as
     * their queryColumns, grid state as its columns array, and an Editor-path key spells out as the
     * pipe-joined headings it is composed of.
     */
    const getSettingsColumnNames = (settingsGroup, settings) => {

        if (Array.isArray(settings.queryColumns) && settings.queryColumns.length > 0) {

            return settings.queryColumns;
        }

        const columnNames = [];

        if (Array.isArray(settings.columns)) {

            for (let i = 0; i < settings.columns.length; i++) {

                if (settings.columns[i]?.column) {
                    columnNames.push(settings.columns[i].column);
                }
            }
        }

        if (columnNames.length > 0) return columnNames;

        return settingsGroup.includes("|") ? settingsGroup.split("|") : [];
    };

    /**
     * Gets a settings entry in the form it is scored in, or null if it has no embedding to score.
     */
    const createCandidate = (settingsGroup, settings) => {

        const embedding = Ren.EmbeddingUtils.decodeEmbedding(settings?.queryEmbedding);

        if (!embedding) return null;

        return {
            key: settingsGroup,
            embedding,
            columnNames: getSettingsColumnNames(settingsGroup, settings)
        };
    };

    /**
     * Gets a value indicating whether settings were saved against the query as it is now: the same
     * SQL and, where both say what their columns are, the same columns.
     */
    const isSavedAgainstQuery = (query, candidate) => {

        const similarity = Ren.EmbeddingUtils.cosineSimilarity(query.embedding, candidate.embedding);

        if (similarity < SAME_QUERY_SIMILARITY) return false;

        if (query.columnCount === 0 || candidate.columnNames.length === 0) return true;

        if (candidate.columnNames.length !== query.columnCount) return false;

        for (let i = 0; i < candidate.columnNames.length; i++) {

            if (!query.columnLookup[candidate.columnNames[i]]) return false;
        }

        return true;
    };

    /**
     * Gets a value indicating whether a settings group is one of a grid set's: its own group, which
     * its first grid uses, or that group numbered for a later grid.
     */
    const isInFamily = (settingsGroup, familyGroup) => {

        if (settingsGroup === familyGroup) return true;

        if (!settingsGroup.startsWith(familyGroup + "[")) return false;

        return /^\[\d+\]$/.test(settingsGroup.substring(familyGroup.length));
    };

    /**
     * Gets a value indicating whether a settings group is a variation, named by appending "__" and
     * the variation's name.  A preview's group lists its columns, which may themselves start "__".
     */
    const isVariation = (settingsGroup) => {

        const lastColumnIndex = settingsGroup.lastIndexOf("|") + 1;

        return settingsGroup.indexOf("__", lastColumnIndex + 1) !== -1;
    };

    /**
     * Gets the settings the queries can be paired with.  Variations are left out, being chosen by
     * name rather than by query, as are settings a data tab has already kept as its own.
     */
    const getCandidates = (tabs, allSettings, keptKeys) => {

        const candidates = [];

        for (const settingsGroup in allSettings) {

            if (isVariation(settingsGroup) || keptKeys[settingsGroup]) continue;

            if (tabs.familyGroup && !isInFamily(settingsGroup, tabs.familyGroup)) continue;

            const candidate = createCandidate(settingsGroup, allSettings[settingsGroup]);

            if (candidate) {

                candidates.push(candidate);
            }
        }

        return candidates;
    };

    /**
     * Gets how much of the query's columns and the settings' columns are the same, as a proportion
     * of whichever set is the larger, so that added and dropped columns both count against it.
     */
    const getColumnOverlap = (query, candidate) => {

        let inCommon = 0;

        for (let i = 0; i < candidate.columnNames.length; i++) {

            if (query.columnLookup[candidate.columnNames[i]]) {
                inCommon++;
            }
        }

        return inCommon / Math.max(query.columnCount, candidate.columnNames.length);
    };

    /**
     * Scores a query against a settings entry.  The embedding on its own cannot tell two similarly
     * written queries apart, so where both sides say what their columns were, how far those agree
     * carries most of the score.
     */
    const getScore = (query, candidate) => {

        const similarity = Ren.EmbeddingUtils.cosineSimilarity(query.embedding, candidate.embedding);

        if (query.columnCount === 0 || candidate.columnNames.length === 0) return similarity;

        const columnOverlap = getColumnOverlap(query, candidate);

        return COLUMN_OVERLAP_WEIGHT * columnOverlap + (1 - COLUMN_OVERLAP_WEIGHT) * similarity;
    };

    /**
     * Pairs up the one query and the one settings entry that the threshold left unassigned.  The
     * threshold is there to choose between competing candidates, so where nothing is competing the
     * only settings there are belong to the only query there is, however much its SQL has changed.
     */
    const assignLastRemainingPair = (queries, candidates, scores, columnNamesByKey, assignment,
        keysAssigned) => {

        let remainingSignature = null;
        let remainingQueryCount = 0;

        for (let i = 0; i < queries.length; i++) {

            if (assignment[queries[i].signature]) continue;

            remainingSignature = queries[i].signature;
            remainingQueryCount++;
        }

        if (remainingQueryCount !== 1) return;

        let remainingKey = null;
        let remainingKeyCount = 0;

        for (let i = 0; i < candidates.length; i++) {

            if (keysAssigned[candidates[i].key]) continue;

            remainingKey = candidates[i].key;
            remainingKeyCount++;
        }

        if (remainingKeyCount !== 1) return;

        assignment[remainingSignature] = {
            key: remainingKey,
            similarity: scores[remainingSignature][remainingKey],
            columnNames: columnNamesByKey[remainingKey]
        };

        keysAssigned[remainingKey] = true;
    };

    /**
     * Gets the tab position a grid set's settings group is numbered by: 0 for the family's own
     * group and n for its "[n]" group.
     */
    const getFamilyIndex = (settingsGroup, familyGroup) => {

        if (settingsGroup === familyGroup) return 0;

        return parseInt(settingsGroup.substring(familyGroup.length + 1), 10);
    };

    /**
     * Swaps the settings of two paired tabs where they cross the order the settings were saved in
     * and the scores are too close to say which way round they belong.  Inserting or removing a
     * SELECT shifts the tabs after it without reordering them, so similar queries keep their order.
     * Settings saved against a query exactly as it is are never swapped away from it.
     */
    const uncrossNearTies = (queries, scores, columnNamesByKey, assignment, familyGroup) => {

        if (!familyGroup) return;

        // As in a selection sort, each tab ends up with the earliest settings it can swap for.
        for (let i = 0; i < queries.length; i++) {

            const firstScores = scores[queries[i].signature];

            for (let j = i + 1; j < queries.length; j++) {

                const first = assignment[queries[i].signature];
                const second = assignment[queries[j].signature];

                if (!first || !second) continue;

                if (first.similarity >= SAME_QUERY_SIMILARITY ||
                    second.similarity >= SAME_QUERY_SIMILARITY) {

                    continue;
                }

                if (getFamilyIndex(first.key, familyGroup) <
                    getFamilyIndex(second.key, familyGroup)) {

                    continue;
                }

                const secondScores = scores[queries[j].signature];

                const loss =
                    firstScores[first.key] + secondScores[second.key] -
                    firstScores[second.key] - secondScores[first.key];

                if (loss >= TIE_MARGIN) continue;

                assignment[queries[i].signature] = {
                    key: second.key,
                    similarity: firstScores[second.key],
                    columnNames: columnNamesByKey[second.key]
                };

                assignment[queries[j].signature] = {
                    key: first.key,
                    similarity: secondScores[first.key],
                    columnNames: columnNamesByKey[first.key]
                };
            }
        }
    };

    /**
     * Assigns settings to queries so that the combined score across all of them is as high as
     * possible: the highest-scoring pair is taken first and neither side can be used again.
     * Matching each query on its own would let one query take settings another query needed more,
     * and would let two queries claim the same settings.  Near ties are then settled by tab order.
     */
    const assignCandidatesToQueries = (queries, candidates, familyGroup) => {

        const scores = {};
        const columnNamesByKey = {};
        const pairs = [];

        for (let i = 0; i < queries.length; i++) {

            const queryScores = {};

            scores[queries[i].signature] = queryScores;

            for (let j = 0; j < candidates.length; j++) {

                const score = getScore(queries[i], candidates[j]);

                queryScores[candidates[j].key] = score;
                columnNamesByKey[candidates[j].key] = candidates[j].columnNames;

                if (score < SIMILARITY_THRESHOLD) continue;

                pairs.push({
                    signature: queries[i].signature,
                    key: candidates[j].key,
                    columnNames: candidates[j].columnNames,
                    score
                });
            }
        }

        pairs.sort((a, b) => b.score - a.score);

        const assignment = {};
        const keysAssigned = {};

        for (let i = 0; i < pairs.length; i++) {

            const pair = pairs[i];

            if (assignment[pair.signature]) continue;

            if (keysAssigned[pair.key]) continue;

            assignment[pair.signature] = {
                key: pair.key,
                similarity: pair.score,
                columnNames: pair.columnNames
            };

            keysAssigned[pair.key] = true;
        }

        assignLastRemainingPair(
            queries,
            candidates,
            scores,
            columnNamesByKey,
            assignment,
            keysAssigned
        );

        uncrossNearTies(queries, scores, columnNamesByKey, assignment, familyGroup);

        return assignment;
    };

    /**
     * Finds the settings for one of a visualisation's data tabs.  A tab keeps the settings under
     * its own key while they were saved against its query as it is now, or say nothing about their
     * query.  Otherwise the SQL has changed, so the settings the tabs have not kept are paired with
     * the tabs that need them, all tabs at once, so that no two tabs take the same settings.  Tabs
     * keyed by the same settings group, as a grid set's tabs with the same columns are, keep or are
     * paired with settings together, so that they stay synchronised.
     *
     * @param {number} tabIndex - The index of the data tab to find settings for.
     * @param {Object} tabs - The visualisation's data tabs: tabularDatas, the settingsGroups each
     *   is keyed by, and the familyGroup those keys are numbered from.  Without a familyGroup, as
     *   in a preview, whose keys are its columns, any settings on the page can be paired.
     * @param {Object} allSettings - The grid state or data grouping settings, by settings group.
     * @returns {{key: string, columnNames: string[]|null}|null} The key of the settings found, and
     *   the columns they were saved against where those may not be the query's, or null.
     */
    const findSettingsForTab = (tabIndex, tabs, allSettings) => {

        const settingsGroup = tabs.settingsGroups[tabIndex];
        const keyedSettings = allSettings[settingsGroup] ?? null;

        if (!Array.isArray(tabs.tabularDatas[tabIndex]?.QueryEmbedding)) {

            return keyedSettings ?
                { key: settingsGroup, columnNames: null } :
                null;
        }

        const queries = [];
        const keptKeys = {};
        const keysSeen = {};
        let targetQuery = null;

        for (let i = 0; i < tabs.settingsGroups.length; i++) {

            const key = tabs.settingsGroups[i];

            // Tabs sharing a key share its settings, so are paired as one, by the first of them.
            if (keysSeen[key]) continue;

            keysSeen[key] = true;

            const settings = allSettings[key];
            const candidate = settings ? createCandidate(key, settings) : null;
            let query = null;
            let isSaved = false;

            for (let j = i; j < tabs.settingsGroups.length && !isSaved; j++) {

                const tabularData = tabs.tabularDatas[j];

                if (tabs.settingsGroups[j] !== key || !Array.isArray(tabularData?.QueryEmbedding)) {
                    continue;
                }

                const tabQuery = createQuery(j, tabularData);

                query = query ?? tabQuery;
                isSaved = candidate !== null && isSavedAgainstQuery(tabQuery, candidate);
            }

            if (settings && (!query || !candidate || isSaved)) {

                keptKeys[key] = true;
                continue;
            }

            if (!query) {
                continue;
            }

            queries.push(query);

            if (key === settingsGroup) {
                targetQuery = query;
            }
        }

        if (!targetQuery) {

            return keyedSettings ?
                { key: settingsGroup, columnNames: null } :
                null;
        }

        const candidates = getCandidates(tabs, allSettings, keptKeys);
        const assignment = assignCandidatesToQueries(queries, candidates, tabs.familyGroup);
        const match = assignment[targetQuery.signature];

        if (match) {

            return {
                key: match.key,
                columnNames: match.columnNames
            };
        }

        // Too little alike to pair with confidence, the settings under the tab's own key are still
        // the likeliest, unless another tab has been paired with them.
        if (!keyedSettings) return null;

        for (const signature in assignment) {

            if (assignment[signature].key === settingsGroup) return null;
        }

        return {
            key: settingsGroup,
            columnNames: getSettingsColumnNames(settingsGroup, keyedSettings)
        };
    };

    return {
        findSettingsForTab
    };
})();
