/**
 * Filter Module: pinning the items' measured dimensions, so a filter-driven re-render doesn't
 * reflow the panel beneath the pointer.  Any other change drops the pins and measures afresh.
 * Both are pinned only as minimums, so an item can grow to show options a filter brings back, or an
 * expanding hierarchy, but never shrinks beneath the pointer.
 */
Ren.FilterModule_FixedDimensions = (s) => {

    const { element, stylesheet } = s;

    // Only the panel's own top-level items, not the node rows nested inside a hierarchical item.
    const ITEM_SELECTOR = ":scope > .ren-filter-module__item";

    // Null until the first measurement has completed.
    let pinnedByKey = null;
    let pinnedSignature = null;

    // Bumped by every call, so a deferred measurement pass can tell it has been superseded.
    let measureToken = 0;

    const getItemElements = () => element.querySelectorAll(ITEM_SELECTOR);

    // Gets a signature changing when an item is added, removed or reordered, but not when a filter
    // prunes an item's options.  A unit separator joins them, as no column identifier holds one.
    const signatureOf = (items) => {

        const keys = [];
        for (let i = 0; i < items.length; i++) keys.push(items[i].dataset.reorderKey);
        return keys.join(String.fromCharCode(31));
    };

    // A key stated as the value of an attribute selector, so a heading carrying a quote or a
    // backslash still selects the item it belongs to.
    const quoteKey = (key) => key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

    // A scrolling item is measured with its squeeze lifted, as the panel may be holding it to
    // less than its natural height, and its floor is that height with the box at its minimum.
    const measureUnsqueezed = (item) => {

        const isScrolling = item.classList.contains("ren-filter-module__item--scrolling");
        const scrollBox = isScrolling
            ? item.querySelector(".ren-filter-module__options-scroll")
            : null;

        if (!scrollBox) {

            return {
                width: item.offsetWidth,
                height: item.offsetHeight,
                isScrolling,
                floorHeight: null
            };
        }

        item.style.flex = "none";
        item.style.maxHeight = "none";

        const dimensions = {
            width: item.offsetWidth,
            height: item.offsetHeight,
            isScrolling,
            floorHeight: item.offsetHeight - scrollBox.offsetHeight +
                parseFloat(getComputedStyle(scrollBox).minHeight)
        };

        item.style.flex = "";
        item.style.maxHeight = "";

        return dimensions;
    };

    // Stacked in a column, an item is stretched to the column's widest, so it is measured at its
    // own width instead.
    const measure = (item) => {

        const isColumnFlow = element.classList.contains("ren-filter-module--column-flow");

        if (isColumnFlow) item.style.alignSelf = "flex-start";

        const dimensions = measureUnsqueezed(item);

        if (isColumnFlow) item.style.alignSelf = "";

        return dimensions;
    };

    const hasItemWithoutWidth = (items) => {

        for (let i = 0; i < items.length; i++) {
            if (items[i].offsetWidth === 0) return true;
        }

        return false;
    };

    // Written as the panel's own rules, so one update holds every item still.  flex-shrink holds
    // the pinned width where a flex line's items would otherwise be squeezed to fit.
    const writePins = (byKey) => {

        const keys = Object.keys(byKey);
        const styles = [];

        const isColumnFlow = element.classList.contains("ren-filter-module--column-flow");

        // Stacked in a column, an item would otherwise stretch to the column's widest.
        const widthRule = isColumnFlow ? "width: max-content; " : "";

        for (let i = 0; i < keys.length; i++) {

            const dimensions = byKey[keys[i]];
            const selector = `.ren-filter-module__item[data-reorder-key="${quoteKey(keys[i])}"]`;

            // Stacked in a column, a scrolling item starts from its floor, so the column only
            // breaks for it when even that won't fit, and grows into whatever room the column has
            // left, up to its natural height.  A percentage basis is taken as the content's height
            // while the panel's height is still to be found, as when the popup is fitted to it.
            if (isColumnFlow && dimensions.floorHeight !== null) {

                styles.push(
                    `${selector} { ${widthRule}min-width: ${dimensions.width}px; flex: 1 1 0%; ` +
                    `min-height: min(${dimensions.floorHeight}px, 100%); ` +
                    `max-height: min(${dimensions.height}px, 100%) }`
                );

                continue;
            }

            // A scrolling item's height is capped at the panel's, which a plain minimum would
            // override once the popup is made shorter.
            const minHeight = dimensions.isScrolling
                ? `min(${dimensions.height}px, 100%)`
                : `${dimensions.height}px`;

            styles.push(
                `${selector} { ${widthRule}min-width: ${dimensions.width}px; ` +
                `min-height: ${minHeight}; ` +
                `flex-shrink: 0 }`
            );
        }

        stylesheet.updateIfChanged(styles);
    };

    // Deferred a frame, so the unpinned items have been laid out, and re-tried while the panel has
    // no layout yet, being created detached.
    const measureAndPin = (signature, token, attemptsLeft) => {

        if (token !== measureToken) return; // A newer render has superseded this pass.

        const items = getItemElements();

        // The structure changed again before this pass ran; its own pass will pin the new items.
        if (signatureOf(items) !== signature) return;

        // Not laid out yet (still detached, or within a hidden popup): wait for a later frame.
        if (items.length > 0 && (element.offsetWidth === 0 || hasItemWithoutWidth(items))) {

            if (attemptsLeft > 0) {

                requestAnimationFrame(() => measureAndPin(signature, token, attemptsLeft - 1));
                return;
            }

            if (element.offsetWidth === 0) return;
        }

        const byKey = {};

        // All measured before any is pinned, as pinning invalidates the layout.  An item with no
        // width is left unpinned, as pinning it at zero hid its options for good.
        for (let i = 0; i < items.length; i++) {

            const item = items[i];
            const dimensions = measure(item);

            if (dimensions.width > 0) byKey[item.dataset.reorderKey] = dimensions;
        }

        writePins(byKey);

        pinnedByKey = byKey;
        pinnedSignature = signature;
    };

    // Re-pins one item at its natural size, returning how much wider it became, so the caller can
    // grow whatever contains the panel by as much.  Used while something inside it is dragged to a
    // new size, which the pinned width would otherwise hold the item back from following.
    const repinItemToContent = (item) => {

        // An item a re-render has since replaced measures zero wide, which would pin the live
        // item at nothing.
        if (!item.isConnected || item.offsetWidth === 0) return 0;

        const key = item.dataset.reorderKey;
        const previousWidth = item.offsetWidth;

        // Kept in the measured set, so a re-render re-pins the dragged width.
        if (!pinnedByKey) pinnedByKey = {};

        delete pinnedByKey[key];
        writePins(pinnedByKey);

        pinnedByKey[key] = measure(item);
        writePins(pinnedByKey);

        return pinnedByKey[key].width - previousWidth;
    };

    // Drops one item's pins, so it follows its content down while a hierarchy node collapses
    // rather than holding the height of everything that had been expanded within it.
    const unpinItem = (item) => {

        if (!pinnedByKey || !(item.dataset.reorderKey in pinnedByKey)) return;

        delete pinnedByKey[item.dataset.reorderKey];
        writePins(pinnedByKey);
    };

    // Called at the end of every render.  With reuseIfUnchanged set and the items unchanged, the
    // dimensions already measured are re-pinned at once, so nothing shifts.
    const stabiliseItemDimensions = (reuseIfUnchanged) => {

        // Cancel any measurement pass still pending from an earlier render.
        measureToken++;
        const token = measureToken;

        const items = getItemElements();
        const signature = signatureOf(items);

        if (reuseIfUnchanged && pinnedByKey && signature === pinnedSignature) {

            writePins(pinnedByKey);

            return;
        }

        // A structural or configuration change: measure again once laid out.
        pinnedByKey = null;
        pinnedSignature = null;

        writePins({});

        requestAnimationFrame(() => measureAndPin(signature, token, 60));
    };

    return {
        stabiliseItemDimensions,
        repinItemToContent,
        unpinItem
    };
};
