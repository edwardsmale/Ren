/**
 * Once the report has finished rendering, measures each server-rendered tabbed module's tab content
 * and gives the tab content (and the module) explicit dimensions.  Without this a tab content is a
 * near-zero-height, absolutely positioned box that its <ren-*> content (e.g. a grid) merely
 * overflows visibly, so the module reserves no space on the page and tab-relative popups have no
 * real area to be positioned and clipped within.
 * A dimension that has been stipulated explicitly is left untouched - either via width/height
 * attributes on <ren-tabbed-module-content> in the markup, or contentWidth/contentHeight in the
 * JSON report settings, both of which Ren.CreateTabbedModule applies as inline styles on the tab
 * content.
 *
 * Editable (client-side) modules are skipped: their tab content fills the module's own popup, whose
 * size is the module's stipulated dimensions.
 */
Ren.TabbedModuleAutoSize = (() => {

    /**
     * Reads a measurement from a tab content while it is temporarily laid out with any given style
     * overrides in effect.  The element and any ancestor tab contents are force-displayed, so a tab
     * content nested inside an unselected tab can still be measured; only the measured element is
     * made invisible.  Everything is restored before returning, so nothing is painted.
     */
    const measureWithOverrides = (element, overrides, read) => {

        const restore = [];

        let current = element;

        while (current) {

            restore.push({
                element: current,
                display: current.style.display,
                visibility: current.style.visibility
            });

            if (current === element) current.style.visibility = "hidden";
            current.style.display = "block";

            current = current.parentElement
                ? current.parentElement.closest(".ren-tabbed-module__tab-content")
                : null;
        }

        const savedWidth = element.style.width;
        const savedHeight = element.style.height;

        if (overrides.width !== undefined) element.style.width = overrides.width;
        if (overrides.height !== undefined) element.style.height = overrides.height;

        const result = read(element);

        element.style.width = savedWidth;
        element.style.height = savedHeight;

        for (let index = 0; index < restore.length; index++) {

            restore[index].element.style.display = restore[index].display;
            restore[index].element.style.visibility = restore[index].visibility;
        }

        return result;
    };

    /**
     * Returns the width needed to show a tab content's contents in full.  An ordinary element is
     * measured by its laid-out width, but a horizontally scrollable descendant (e.g. a grid's
     * "overflow: scroll" viewport) hides content wider than its box and collapses under
     * max-content, so its scrollWidth is used to recover the full content width.  Capped at the
     * viewport so the tab content does not push out a page-level horizontal scrollbar (the grid
     * scrolls beyond this).
     */
    const measureContentWidth = (element) => {

        const elementLeft = element.getBoundingClientRect().left;

        let width = element.scrollWidth;

        const descendants = element.querySelectorAll("*");

        for (let index = 0; index < descendants.length; index++) {

            const descendant = descendants[index];

            if (descendant.scrollWidth > descendant.clientWidth) {

                const left = descendant.getBoundingClientRect().left - elementLeft;
                width = Math.max(width, Math.ceil(left + descendant.scrollWidth));
            }
        }

        const maxWidth = Math.floor(window.innerWidth - elementLeft - 8);

        return Math.min(width, Math.max(maxWidth, 0));
    };

    /**
     * Measures the natural size of a tab content's contents, free of any inherited size constraint.
     */
    const measureNaturalSize = (tabContent) =>
        measureWithOverrides(tabContent, { width: "max-content", height: "auto" }, element => ({
            width: measureContentWidth(element),
            height: element.offsetHeight
        }));

    /**
     * Measures a tab content's height as it will actually render (i.e. keeping its explicit size).
     */
    const measureRenderedHeight = (tabContent) =>
        measureWithOverrides(tabContent, {}, element => element.offsetHeight);

    const sizeTabbedModule = (tabbedModule) => {

        const tabs = tabbedModule.querySelectorAll(":scope > .ren-tabbed-module__tab");

        let maxContentHeight = 0;
        let headerHeight = 0;

        // The dimensions each tab content is to be given, applied once every tab's been measured.
        const sizesToApply = [];

        tabs.forEach(tab => {

            const header = tab.querySelector(":scope > .ren-tabbed-module__tab-header");
            const tabContent = tab.querySelector(":scope > .ren-tabbed-module__tab-content");

            if (header) headerHeight = Math.max(headerHeight, header.offsetHeight);

            if (!tabContent) return;

            // A non-empty inline width/height is one that was stipulated in the markup or JSON and
            // applied by Ren.CreateTabbedModule, so leave that dimension as-is.
            const hasExplicitWidth = tabContent.style.width !== "";
            const hasExplicitHeight = tabContent.style.height !== "";

            const naturalSize = (!hasExplicitWidth || !hasExplicitHeight)
                ? measureNaturalSize(tabContent)
                : null;

            if (!hasExplicitWidth || !hasExplicitHeight) {

                sizesToApply.push({
                    element: tabContent,
                    width: hasExplicitWidth ? null : naturalSize.width,
                    height: hasExplicitHeight ? null : naturalSize.height
                });
            }

            const contentHeight = hasExplicitHeight
                ? measureRenderedHeight(tabContent)
                : naturalSize.height;

            maxContentHeight = Math.max(maxContentHeight, contentHeight);
        });

        for (let index = 0; index < sizesToApply.length; index++) {

            const size = sizesToApply[index];

            if (size.width !== null) size.element.style.width = size.width + "px";
            if (size.height !== null) size.element.style.height = size.height + "px";
        }

        // Give the module a height that reserves space for the tallest tab's content below the tab
        // headers, so following page content is not overlapped by the absolute tab content.
        tabbedModule.style.height = (maxContentHeight + headerHeight) + "px";
    };

    const sizeTabbedModules = () => {

        const tabbedModules = Array.from(
            document.querySelectorAll(".ren-tabbed-module:not(.ren-tabbed-module--editable)")
        );

        // Deepest-first (reverse document order), so a nested module is sized before the ancestor
        // tab content that has to measure it.
        for (let index = tabbedModules.length - 1; index >= 0; index--) {
            sizeTabbedModule(tabbedModules[index]);
        }
    };

    // allReportsLoaded fires once no loading animations remain, i.e. the report has finished
    // rendering and the measurements will reflect the final content.
    Ren.Messages.Events.allReportsLoaded.handle(() => {

        sizeTabbedModules();
    });

    return {
        sizeTabbedModules
    };
})();
