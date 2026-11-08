/**
 * Collapses a wrapped grid of cards down to its first few visual rows, hiding the rest behind a
 * "show more" link.  These are the laid-out rows rather than data rows, so how many cards a row
 * holds depends on how many fit across the module: the rows are measured from the cards'
 * positions, and measured again if the module's width changes.
 */
Ren.GridRowCollapser = (() => {

    const blockName = "ren-format-function-content-module";

    /**
     * The vertical position of the first card on each visual row.  Cards that wrapped onto the
     * same row share an offsetTop, and the cards are in document order, so a card sitting lower
     * than the last one recorded starts a new row.
     */
    const findRowOffsets = (offsetTops) => {

        const offsets = [];

        for (let index = 0; index < offsetTops.length; index++) {

            if (offsets.length === 0 || offsetTops[index] > offsets[offsets.length - 1]) {

                offsets.push(offsetTops[index]);
            }
        }

        return offsets;
    };

    /**
     * The cards laid out by the module.  They are not necessarily its own children: HTML appended
     * to an element arrives inside a display: contents wrapper, whose children are the ones the
     * grid lays out.  That wrapper is descended into and otherwise left alone - clearing its
     * display would make it a block, and the cards would stop being items of the grid.
     */
    const collectCards = (parent, cards) => {

        for (let index = 0; index < parent.children.length; index++) {

            const child = parent.children[index];

            if (child.style.display === "contents") {

                collectCards(child, cards);
            }
            else {

                cards.push(child);
            }
        }

        return cards;
    };

    const buildShowMore = () => {

        const container = document.createElement("div");
        container.classList.add(blockName + "__show-more");

        const link = document.createElement("a");
        link.classList.add(blockName + "__show-more-link");
        link.setAttribute("href", "javascript:void(0)");
        container.appendChild(link);

        return container;
    };

    /**
     * Hides everything below the first visibleRowCount visual rows of the module, adding a link
     * that reveals the rest.  While the module has no layout - it is in an unopened tab, say -
     * every card measures as being on the same row, so nothing is hidden until it does.
     */
    const apply = (module, visibleRowCount) => {

        const cards = collectCards(module, []);

        if (cards.length === 0) {

            return;
        }

        const showMore = buildShowMore();
        const link = showMore.querySelector("." + blockName + "__show-more-link");
        module.appendChild(showMore);

        let expanded = false;

        const showAllCards = () => {

            for (let index = 0; index < cards.length; index++) {

                cards[index].style.display = "";
            }
        };

        const collapse = () => {

            if (expanded) {

                return;
            }

            // Measure from the uncollapsed grid, with the link out of the way so that it does not
            // occupy a row of its own while the rows are being counted.
            showAllCards();
            showMore.style.display = "none";

            const offsetTops = [];

            for (let index = 0; index < cards.length; index++) {

                offsetTops.push(cards[index].offsetTop);
            }

            const offsets = findRowOffsets(offsetTops);

            if (offsets.length <= visibleRowCount) {

                return;
            }

            // Every position is taken before anything is hidden: hiding a card reflows the ones
            // after it, so their offsets would no longer say which row they started on.
            const firstHiddenOffset = offsets[visibleRowCount];
            let hiddenCount = 0;

            for (let index = 0; index < cards.length; index++) {

                if (offsetTops[index] >= firstHiddenOffset) {

                    cards[index].style.display = "none";
                    hiddenCount++;
                }
            }

            link.textContent = "Show " + hiddenCount + " more";
            showMore.style.display = "";
        };

        link.addEventListener("click", (event) => {

            event.preventDefault();
            expanded = true;
            showAllCards();
            showMore.style.display = "none";
        });

        if (typeof ResizeObserver !== "undefined") {

            // Collapsing changes the module's height, which delivers another resize; only its
            // width decides how many cards fit on a row, so ignore the deliveries that leave the
            // width alone rather than measuring in a loop.
            //
            // The measuring and hiding must also happen outside the delivery itself: showing and
            // hiding cards from within the callback resizes the observed module during the same
            // delivery, which the browser reports as "ResizeObserver loop completed with
            // undelivered notifications".  Deferring to the next frame - and coalescing repeats -
            // lets each delivery complete without a further size change.
            let lastWidth = -1;
            let collapseScheduled = false;

            const collapseNextFrame = () => {

                if (collapseScheduled) {

                    return;
                }

                collapseScheduled = true;

                requestAnimationFrame(() => {

                    collapseScheduled = false;

                    if (module.clientWidth === lastWidth) {

                        return;
                    }

                    lastWidth = module.clientWidth;
                    collapse();
                });
            };

            const observer = new ResizeObserver(collapseNextFrame);

            observer.observe(module);
        }

        Ren.FnUtils.defer(collapse);
    };

    return {
        apply: apply
    };
})();
