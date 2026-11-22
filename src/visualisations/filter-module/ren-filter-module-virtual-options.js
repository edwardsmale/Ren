/**
 * Filter Module: the virtualised list an item with over MAX_VISIBLE_ROWS options draws into.  Only
 * the rows in view are built, as thousands of checkbox rows took seconds and gigabytes.  Rows have
 * a fixed ROW_HEIGHT, and hidden sizer rows hold the item at the whole list's width.
 */
Ren.FilterModule_VirtualOptions = () => {

    // Also the scroll box's height, in rows.
    const MAX_VISIBLE_ROWS = 30;

    // Must match $optionRowHeight in ren-filter-module.scss.
    const ROW_HEIGHT = 20;

    // Rows built beyond each end of the window, so scrolling doesn't rebuild on every notch.
    const OVERSCAN_ROWS = 12;

    // Several, as the longest caption in characters need not be the widest in pixels.
    const SIZER_ROW_COUNT = 8;

    // Cleared at the start of every render, as the panel is rebuilt wholesale.
    const lists = [];

    // Kept across renders, so a filter toggle doesn't throw a list back to the top.
    const scrollTopByKey = new Map();

    // Gets a value indicating whether a column with this many options is drawn as a scroll box.
    const isVirtualised = (optionCount) => optionCount > MAX_VISIBLE_ROWS;

    // Found in one pass, as sorting a whole column to read off the top few is what this avoids.
    const collectTopIndexes = (optionCount, scoreOf) => {

        const indexes = [];
        const scores = [];

        for (let index = 0; index < optionCount; index++) {

            const score = scoreOf(index);

            if (indexes.length === SIZER_ROW_COUNT && score <= scores[indexes.length - 1]) continue;

            let position = indexes.length;

            while (position > 0 && scores[position - 1] < score) position--;

            indexes.splice(position, 0, index);
            scores.splice(position, 0, score);

            if (indexes.length > SIZER_ROW_COUNT) {

                indexes.pop();
                scores.pop();
            }
        }

        return indexes;
    };

    // Gets the longest captions and largest figures, as either can set the item's width.  Captions
    // are ranked by their base text, so choosing them costs no formatting.
    const getSizerIndexes = (options) => {

        const byTextLength = collectTopIndexes(
            options.length,
            (index) => String(options[index].baseText ?? "").length
        );

        const byValue = collectTopIndexes(
            options.length,
            (index) => Math.abs(Number(options[index].aggregatedValue) || 0)
        );

        const indexes = [];
        const taken = new Set();

        const take = (index) => {

            if (taken.has(index)) return;

            taken.add(index);
            indexes.push(index);
        };

        for (let i = 0; i < byTextLength.length; i++) take(byTextLength[i]);
        for (let i = 0; i < byValue.length; i++) take(byValue[i]);

        return indexes;
    };

    /**
     * config carries key (the column identifier the scroll offset is kept under), options,
     * buildRow(index) returning { element, ref }, buildSizerRow(index), and onRowsRendered(refs),
     * so the view can sync checkboxes built since it last synced.
     */
    const createList = (config) => {

        const { key, options, buildRow, buildSizerRow, onRowsRendered } = config;

        const optionCount = options.length;

        // Replaced wholesale each time the window moves.
        let renderedRefs = [];

        // The half-open range of option indexes currently built.
        let renderedStart = 0;
        let renderedEnd = 0;

        const scroller = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("FilterModuleVirtualOptions");

        // The spacer stands in for the full list, so the scrollbar reads the column's length.
        scroller._style("height", (MAX_VISIBLE_ROWS * ROW_HEIGHT) + "px");

        const spacer = scroller.querySelector(".js-ren-options-spacer");

        spacer.style.height = (optionCount * ROW_HEIGHT) + "px";

        // Holds the built rows, moved down the spacer to sit where the window's first row belongs.
        const rowsElement = Ren.HtmlUtils.enrich(scroller.querySelector(".js-ren-options-window"));

        const clearRows = () => {

            while (rowsElement.firstChild) rowsElement.removeChild(rowsElement.firstChild);
        };

        const buildWindow = (start, end) => {

            clearRows();

            const refs = [];

            for (let index = start; index < end; index++) {

                const row = buildRow(index);

                if (row.ref) refs.push(row.ref);

                rowsElement._append(row.element);
            }

            rowsElement._style("transform", "translateY(" + (start * ROW_HEIGHT) + "px)");

            renderedRefs = refs;
            renderedStart = start;
            renderedEnd = end;

            if (onRowsRendered) onRowsRendered(refs);
        };

        // Most scroll events cost only this comparison, while the view stays within the overscan.
        const renderWindowForScroll = () => {

            const firstVisible = Math.floor(scroller.scrollTop / ROW_HEIGHT);
            const lastNeeded = Math.min(firstVisible + MAX_VISIBLE_ROWS, optionCount);

            if (firstVisible >= renderedStart && lastNeeded <= renderedEnd) return;

            buildWindow(
                Math.max(0, firstVisible - OVERSCAN_ROWS),
                Math.min(optionCount, lastNeeded + OVERSCAN_ROWS)
            );
        };

        scroller.addEventListener("scroll", () => {

            scrollTopByKey.set(key, scroller.scrollTop);
            renderWindowForScroll();
        });

        // Built once and outside the window, so scrolling never disturbs the width.
        const sizer = Ren.HtmlUtils.enrich(scroller.querySelector(".js-ren-options-sizer"));
        const sizerIndexes = getSizerIndexes(options);

        for (let i = 0; i < sizerIndexes.length; i++) sizer._append(buildSizerRow(sizerIndexes[i]));

        // Clamped, as the filter causing the render may have pruned the options.
        const restoredScrollTop = Math.min(
            scrollTopByKey.get(key) ?? 0,
            Math.max(0, (optionCount - MAX_VISIBLE_ROWS) * ROW_HEIGHT)
        );

        const firstVisible = Math.floor(restoredScrollTop / ROW_HEIGHT);

        buildWindow(
            Math.max(0, firstVisible - OVERSCAN_ROWS),
            Math.min(optionCount, firstVisible + MAX_VISIBLE_ROWS + OVERSCAN_ROWS)
        );

        // Retried until it takes, as the box is built detached and setting scrollTop with nothing
        // to scroll is dropped.
        const restoreScrollTop = (attemptsLeft) => {

            scroller.scrollTop = restoredScrollTop;

            if (Math.abs(scroller.scrollTop - restoredScrollTop) >= 1 && attemptsLeft > 0) {

                requestAnimationFrame(() => restoreScrollTop(attemptsLeft - 1));

                return;
            }

            renderWindowForScroll();
        };

        if (restoredScrollTop > 0) requestAnimationFrame(() => restoreScrollTop(60));

        const list = {
            element: scroller,
            getRenderedRefs: () => renderedRefs
        };

        lists.push(list);

        return list;
    };

    // Called at the start of each render, as the panel is rebuilt wholesale.
    const reset = () => {

        lists.length = 0;
    };

    const getLists = () => lists;

    return {
        isVirtualised,
        createList,
        reset,
        getLists
    };
};
