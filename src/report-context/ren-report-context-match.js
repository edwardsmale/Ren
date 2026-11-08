/**
 * Decides whether two things that carry a containing report context GUID belong to the same report
 * context.
 *
 * Data grouping settings are synchronised by settings group, and a settings group declared in a
 * report's view (settings-group="...") is a literal, so every open instance of that report - each
 * popup, each embedded report - declares the same one.  Sharing the group name meant a change made
 * in one instance was applied to all of them.  The data grouping settings change events therefore
 * carry the GUID of the report context they were fired from, and a receiver answers only those
 * fired from its own context.
 *
 * An absent GUID matches everything.  Not everything sits inside a report context - an ad-hoc
 * visualisation built from a cell selection, an editor preview - and neither does the
 * destroyed-cleanup broadcast, so those must keep reaching their receivers as they did before.
 */
Ren.ReportContextMatch = (() => {

    const isSameReportContext = (containingReportGuid, otherContainingReportGuid) => {

        if (containingReportGuid == null || otherContainingReportGuid == null) return true;

        return containingReportGuid === otherContainingReportGuid;
    };

    /**
     * Gets a value indicating whether a group named in a change, with the report context it came
     * from, is the given group in the given report context.  The group alone is not enough, since
     * every open instance of a report declares the same one.
     */
    const isSameGroup = (group, containingReportGuid, ownGroup, ownContainingReportGuid) =>
        group === ownGroup && isSameReportContext(containingReportGuid, ownContainingReportGuid);

    /**
     * Gets a value indicating whether two holders of a data grouping settings group and a report
     * context, such as the settings themselves or a visualisation, have the same group.
     */
    const isSameDataGroupingSettingsGroup = (holder, otherHolder) => isSameGroup(
        holder.dataGroupingSettingsGroup,
        holder.containingReportGuid,
        otherHolder.dataGroupingSettingsGroup,
        otherHolder.containingReportGuid
    );

    return {
        isSameReportContext,
        isSameGroup,
        isSameDataGroupingSettingsGroup
    };
})();
