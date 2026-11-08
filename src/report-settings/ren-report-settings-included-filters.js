/**
 * Which of a report's filters belong to the report itself.
 *
 * Filtering while reading a report is exploration, so filters are not saved by default.  A filter
 * is saved as it stands on the page only where its column is marked for inclusion ("Include when
 * saving settings" on the filter module item); every other column falls back to the filter the
 * report was loaded with, and a column with neither saves nothing.
 *
 * A mark lives in includedWhenSavingColumns beside the filter it describes, and never reaches the
 * settings file: a load starts with nothing marked, however many filters the settings carry.
 */
Ren.ReportSettings_IncludedFilters = (() => {

    /**
     * The filters the report was loaded with, kept as settings group -> filter set parent -> data
     * tab title -> { columnValueFilters, predicates }.  Grouping levels are keyed by position,
     * since that is all a settings file gives them, so regrouping can land a filter kept here on
     * the level that has taken the old one's place.
     */
    const loadedFilters = {};

    /**
     * Gets the column a row-filter predicate is marked by, or null where it is not marked by a
     * column at all.  A combination predicate belongs to the leaf of its chain.  Null means
     * "leave it alone": a "function" predicate is only ever written by hand in a settings file.
     */
    const getPredicateColumn = (predicate) => {

        if (!predicate) return null;

        if (predicate.type === "compare") return predicate.column ?? null;

        if (predicate.type === "excludeCombinations" || predicate.type === "includeCombinations") {

            const columns = predicate.columns;

            if (!Array.isArray(columns) || !columns.length) return null;

            return columns[columns.length - 1];
        }

        return null;
    };

    /**
     * Gets a value indicating whether a row-filter predicate belongs to whoever is looking at the
     * report rather than to the report, whatever anybody has marked.  An "includeRowIndexes"
     * predicate names row indexes of the data as loaded, which say nothing about the next run's.
     */
    const isTransientPredicate = (predicate) => predicate?.type === "includeRowIndexes";

    /**
     * Gets every filter set parent in one settings object - its data rows and each of its grouping
     * levels, either of which can carry a filter set of its own - each with the key its loaded
     * filters are kept under.
     */
    const getFilterSetParents = (dataGroupingSettings) => {

        const filterSetParents = [];

        if (dataGroupingSettings.dataRows) {

            filterSetParents.push({
                key: "dataRows",
                filterSetParent: dataGroupingSettings.dataRows
            });
        }

        const entries = dataGroupingSettings.groupings?.entries;

        if (Array.isArray(entries)) {

            for (let i = 0; i < entries.length; i++) {

                filterSetParents.push({ key: "grouping-" + i, filterSetParent: entries[i] });
            }
        }

        return filterSetParents;
    };

    /**
     * Takes a copy of one tab's filters, in the shape they are kept in for the next save.
     * A null column value filter is one the transformer emptied because every value was selected.
     * Predicates no column marks are left out, since they are taken from the page instead.
     */
    const captureTabFilters = (tabFilters) => {

        const columnValueFilters = {};
        const sourceColumnValueFilters = tabFilters.columnValueFilters;

        for (const columnIdOrHeading in sourceColumnValueFilters) {

            const values = sourceColumnValueFilters[columnIdOrHeading];

            if (values) columnValueFilters[columnIdOrHeading] = values;
        }

        const predicates = [];
        const sourcePredicates = tabFilters.rowFilter?.predicates;

        if (Array.isArray(sourcePredicates)) {

            for (let i = 0; i < sourcePredicates.length; i++) {

                if (getPredicateColumn(sourcePredicates[i]) !== null) {

                    predicates.push(sourcePredicates[i]);
                }
            }
        }

        // A filter's negation mark says how its values are to be read (see Ren.FilterNegation), so
        // it travels with them: a filter restored from the file must come back meaning what it did.
        const negatedColumns = Array.isArray(tabFilters.negatedColumns)
            ? tabFilters.negatedColumns
            : [];

        return Ren.ObjectUtils.clone({ columnValueFilters, predicates, negatedColumns });
    };

    /**
     * Takes a copy of the filters some settings carry, and clears any mark they carry with them.
     * Nothing writes a mark to a settings file, so ordinarily there is nothing to clear; doing it
     * anyway makes the rule true of any file, however it came to be written.
     */
    const captureFilters = (reportSettings, replaceCaptured) => {

        const dataGroupingSettings = reportSettings?.dataGroupingSettings;

        if (!dataGroupingSettings) return;

        for (const settingsGroup in dataGroupingSettings) {

            const settings = dataGroupingSettings[settingsGroup];

            if (!settings) continue;

            // Only a load says the report's own filters are now something else.
            if (!replaceCaptured && loadedFilters[settingsGroup] !== undefined) continue;

            const capturedParents = {};
            const filterSetParents = getFilterSetParents(settings);

            for (let i = 0; i < filterSetParents.length; i++) {

                const filterSet = filterSetParents[i].filterSetParent.filterSet;

                if (!filterSet) continue;

                const capturedTabs = {};

                for (const dataTabTitle in filterSet) {

                    const tabFilters = filterSet[dataTabTitle];

                    delete tabFilters.includedWhenSavingColumns;

                    capturedTabs[dataTabTitle] = captureTabFilters(tabFilters);
                }

                capturedParents[filterSetParents[i].key] = capturedTabs;
            }

            loadedFilters[settingsGroup] = capturedParents;
        }
    };

    /**
     * Composes the filters to save for one tab, from the filters now on the page and the ones the
     * report was loaded with, and says whether anything of substance came of it.  The marks
     * themselves go, since they are not written to the settings file at all.
     * @param {boolean} keepEveryFilter Treats every column as marked, as a variation needs.
     */
    const composeTabFilters = (tabFilters, loadedTabFilters, pageTabMarks, keepEveryFilter) => {

        const includedWhenSavingColumns = Array.isArray(tabFilters.includedWhenSavingColumns)
            ? tabFilters.includedWhenSavingColumns.slice()
            : [];

        // The settings being saved need not carry any of the marks the page holds for this tab.
        for (let i = 0; pageTabMarks && i < pageTabMarks.length; i++) {

            if (includedWhenSavingColumns.indexOf(pageTabMarks[i]) === -1) {

                includedWhenSavingColumns.push(pageTabMarks[i]);
            }
        }

        delete tabFilters.includedWhenSavingColumns;

        const isMarked = (columnIdOrHeading) =>
            keepEveryFilter || includedWhenSavingColumns.indexOf(columnIdOrHeading) !== -1;

        const columnValueFilters = tabFilters.columnValueFilters ?? {};
        const loadedColumnValueFilters = loadedTabFilters?.columnValueFilters;
        let hasFilter = false;

        for (const columnIdOrHeading in columnValueFilters) {

            if (columnValueFilters[columnIdOrHeading] && isMarked(columnIdOrHeading)) {

                hasFilter = true;
                continue;
            }

            delete columnValueFilters[columnIdOrHeading];
        }

        for (const columnIdOrHeading in loadedColumnValueFilters) {

            if (isMarked(columnIdOrHeading)) continue;

            columnValueFilters[columnIdOrHeading] =
                Ren.ObjectUtils.clone(loadedColumnValueFilters[columnIdOrHeading]);

            hasFilter = true;
        }

        if (hasFilter) {
            tabFilters.columnValueFilters = columnValueFilters;
        }
        else {

            delete tabFilters.columnValueFilters;
        }

        const keptPredicates = [];
        const predicates = tabFilters.rowFilter?.predicates;

        if (Array.isArray(predicates)) {

            for (let i = 0; i < predicates.length; i++) {

                const predicate = predicates[i];

                if (isTransientPredicate(predicate)) continue;

                const column = getPredicateColumn(predicate);

                // A hand-written filter function is the author's either way, so it is kept.
                if (column === null || isMarked(column)) keptPredicates.push(predicate);
            }
        }

        const loadedPredicates = loadedTabFilters?.predicates;

        if (Array.isArray(loadedPredicates)) {

            for (let i = 0; i < loadedPredicates.length; i++) {

                if (isMarked(getPredicateColumn(loadedPredicates[i]))) continue;

                keptPredicates.push(Ren.ObjectUtils.clone(loadedPredicates[i]));
            }
        }

        if (keptPredicates.length) {

            const rowFilter = tabFilters.rowFilter ?? {};

            rowFilter.predicates = keptPredicates;
            tabFilters.rowFilter = rowFilter;
            hasFilter = true;
        }
        else if (tabFilters.rowFilter) {

            delete tabFilters.rowFilter.predicates;
        }

        // Each surviving filter keeps the negation mark of wherever it came from: the page's for a
        // marked column, the file's for one restored from the loaded filters.  A combination
        // predicate carries its own sense, but the mark travels too, so a hierarchical item comes
        // back marked as it was left.
        const pageNegatedColumns = Array.isArray(tabFilters.negatedColumns)
            ? tabFilters.negatedColumns
            : [];

        const loadedNegatedColumns = Array.isArray(loadedTabFilters?.negatedColumns)
            ? loadedTabFilters.negatedColumns
            : [];

        const negatedColumns = [];

        const keepNegationMark = (columnIdOrHeading) => {

            if (columnIdOrHeading === null) return;
            if (negatedColumns.indexOf(columnIdOrHeading) !== -1) return;

            const source = isMarked(columnIdOrHeading) ? pageNegatedColumns : loadedNegatedColumns;

            if (source.indexOf(columnIdOrHeading) !== -1) negatedColumns.push(columnIdOrHeading);
        };

        for (const columnIdOrHeading in columnValueFilters) {

            keepNegationMark(columnIdOrHeading);
        }

        for (let i = 0; i < keptPredicates.length; i++) {

            keepNegationMark(getPredicateColumn(keptPredicates[i]));
        }

        if (negatedColumns.length) {
            tabFilters.negatedColumns = negatedColumns;
        }
        else {

            delete tabFilters.negatedColumns;
        }

        return hasFilter;
    };

    /**
     * Composes the filters to save for one settings object, dropping any filter set left with
     * nothing in it.  A tab the page no longer filters is put back where the report was loaded
     * with filters on it, since those are saved whether or not the page still shows them.
     */
    const composeFilters = (dataGroupingSettings, loadedParents, pageParentMarks, keepEveryFilter) => {

        const filterSetParents = getFilterSetParents(dataGroupingSettings);

        for (let i = 0; i < filterSetParents.length; i++) {

            const filterSetParent = filterSetParents[i].filterSetParent;
            const loadedTabs = loadedParents ? loadedParents[filterSetParents[i].key] : null;
            const markedTabs = pageParentMarks ? pageParentMarks[filterSetParents[i].key] : null;
            const filterSet = filterSetParent.filterSet ?? {};

            for (const dataTabTitle in loadedTabs) {

                if (!filterSet[dataTabTitle]) filterSet[dataTabTitle] = {};
            }

            let hasAnyFilter = false;

            for (const dataTabTitle in filterSet) {

                const hasFilter = composeTabFilters(
                    filterSet[dataTabTitle],
                    loadedTabs ? loadedTabs[dataTabTitle] : null,
                    markedTabs ? markedTabs[dataTabTitle] : null,
                    keepEveryFilter
                );

                if (hasFilter) {
                    hasAnyFilter = true;
                }
                else {

                    delete filterSet[dataTabTitle];
                }
            }

            if (hasAnyFilter) {
                filterSetParent.filterSet = filterSet;
            }
            else {

                delete filterSetParent.filterSet;
            }
        }
    };

    /**
     * A copy of the settings about to be saved, holding for each column the filter now on the page
     * where it is marked for inclusion, the filter the report was loaded with where it is not, and
     * nothing where there is neither.  The marks are left out whichever way they fall.
     *
     * A copy, because the settings being saved share their objects with the collection the page is
     * still running on, which has to keep every filter and every mark it holds.
     *
     * Variations are saved as they stand: the filter is usually the whole point of one ("UK only").
     */
    const withoutUnmarkedFilters = (allDataGroupingSettings) => {

        const settingsCopy = Ren.ObjectUtils.clone(allDataGroupingSettings);
        const pageMarks = getPageMarks();

        for (const settingsGroup in settingsCopy) {

            const settings = settingsCopy[settingsGroup];

            if (settings) {

                composeFilters(
                    settings,
                    loadedFilters[settingsGroup],
                    pageMarks[settingsGroup],
                    settingsGroup.includes("__")
                );
            }
        }

        return settingsCopy;
    };

    /**
     * Calls the action with every live settings object on the page, once each.  Both collections
     * are walked because neither holds all of them: of a grid set's per-tab settings objects only
     * the first is in Ren.DataGroupingSettingsCollection, the rest reached through the
     * visualisation that owns them.
     */
    const forEachLiveSettings = (action) => {

        const visited = [];

        const visit = (settings, settingsGroup) => {

            if (!settings || visited.indexOf(settings) !== -1) return;

            visited.push(settings);

            action(settings, settings.dataGroupingSettingsGroup ?? settingsGroup);
        };

        const settingsEntries = Ren.DataGroupingSettingsCollection.entries;

        for (let i = 0; i < settingsEntries.length; i++) visit(settingsEntries[i], null);

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];
            const instanceSettings = visualisation.instance?.dataGroupingSettings;

            if (Array.isArray(instanceSettings)) {

                for (let j = 0; j < instanceSettings.length; j++) {
                    visit(instanceSettings[j], visualisation.dataGroupingSettingsGroup);
                }
            }
            else {

                visit(instanceSettings, visualisation.dataGroupingSettingsGroup);
            }
        }
    };

    /**
     * Gets every column marked anywhere on the page, as settings group -> filter set parent ->
     * data tab title -> column identifiers.  Marking is a change to one settings object alone,
     * unlike filtering, so a grid set's marks have to be gathered from every settings object on
     * the group rather than from the one being saved.
     */
    const getPageMarks = () => {

        const pageMarks = {};

        forEachLiveSettings((settings, settingsGroup) => {

            if (!settingsGroup) return;

            const filterSetParents = getFilterSetParents(settings);

            for (let i = 0; i < filterSetParents.length; i++) {

                const filterSet = filterSetParents[i].filterSetParent.filterSet;

                for (const dataTabTitle in filterSet) {

                    const includedColumns = filterSet[dataTabTitle].includedWhenSavingColumns;

                    if (!Array.isArray(includedColumns) || !includedColumns.length) continue;

                    const groupMarks = pageMarks[settingsGroup] ??= {};
                    const parentMarks = groupMarks[filterSetParents[i].key] ??= {};
                    const tabMarks = parentMarks[dataTabTitle] ??= [];

                    for (let c = 0; c < includedColumns.length; c++) {

                        if (tabMarks.indexOf(includedColumns[c]) === -1) {
                            tabMarks.push(includedColumns[c]);
                        }
                    }
                }
            }
        });

        return pageMarks;
    };

    /**
     * Clears every mark on the page.  The marks live on the live settings a filter module is
     * driving, never in a file, and applying settings deliberately does not clear them - settings
     * are applied for all sorts of reasons besides a load.
     */
    const clearPageFilterMarks = () => {

        forEachLiveSettings((settings) => {

            const filterSetParents = getFilterSetParents(settings);

            for (let i = 0; i < filterSetParents.length; i++) {

                const filterSet = filterSetParents[i].filterSetParent.filterSet;

                for (const dataTabTitle in filterSet) {

                    delete filterSet[dataTabTitle].includedWhenSavingColumns;
                }
            }
        });
    };

    /**
     * Takes a copy of the filters the report is written with, for any settings group not already
     * copied from.  A scan can come long after settings have been loaded over the page's, so what
     * a group was first seen holding is what stands.
     */
    const capturePageFilters = (reportSettings) => captureFilters(reportSettings, false);

    /**
     * Takes a copy of the filters a set of settings loaded into the report carries, in place of
     * whatever those settings groups were last seen holding.
     */
    const captureLoadedFilters = (reportSettings) => captureFilters(reportSettings, true);

    return {
        capturePageFilters,
        captureLoadedFilters,
        clearPageFilterMarks,
        withoutUnmarkedFilters
    };
})();
