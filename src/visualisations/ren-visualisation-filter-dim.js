/**
 * Dims the visualisations that are catching up with a filter change, so that the change reads as
 * the page working rather than as nothing happening.
 *
 * This answers the filterChanging message and dims everything following the settings group or
 * filter group the change was made to, in the report context it was made in.  filterChanging is
 * used rather than filterChanged because it is notified in the turn of the click, which the browser
 * paints before the message bus sends its queued messages.
 *
 * A visualisation drawn inside another that is being dimmed doesn't get a dim of its own, and the
 * outer dim stays on until every visualisation under it has redrawn.  A visualisation is finished
 * when it calls undimVisualisation or is seen to redraw; anything still dimmed once the page has
 * been quiet for a moment comes back then.
 *
 * The dim fades in only after a short delay, so a change answered within a frame or two never
 * visibly dims anything.
 */
Ren.VisualisationFilterDim = (() => {

    const DIM_CLASS = "ren-visualisation--filter-pending";

    // A turn reached this promptly cannot have had work in front of it.
    const PROMPT_TURN_MS = 24;

    // How long the page has to stay that quiet before a visualisation that has not been seen to
    // redraw is taken to have had nothing to redraw.  Long enough for the next visualisation's
    // coalesced work to have started, short enough not to leave a dim standing over a done page.
    const QUIET_SETTLE_MS = 150;

    const STYLES = [
        ".ren-visualisation { transition: opacity 0.15s ease-out }",
        ".ren-visualisation--filter-pending { opacity: 0.75;" +
            " transition: opacity 0.2s ease-out 0.12s }"
    ];

    // The dims currently on: the element each is applied to, against the visualisation elements it
    // stands for that have yet to redraw.
    const dims = new Map();

    // The dim each visualisation element is covered by, which is its own where it has one.
    const dimsByVisualisationElement = new Map();

    // The rules go into a dynamic stylesheet rather than into the SCSS so that they arrive with the
    // script itself.  Written on the first dim, since the container they are written into is
    // appended to the body, which is not there yet while the scripts are being loaded.
    let isStylesheetWritten = false;

    const writeStylesheet = () => {

        if (isStylesheetWritten) return;

        isStylesheetWritten = true;

        Ren.DynamicStylesheets
            .setupDynamicStylesheet("", "visualisation-filter-dim")
            .updateIfChanged(STYLES);
    };

    let isWaiting = false;
    let lastTurnAt = 0;
    let quietSince = null;

    const undim = (element) => {

        const dim = dims.get(element);

        if (!dim) return;

        dim.observer.disconnect();
        dim.covers.forEach((coveredElement) => dimsByVisualisationElement.delete(coveredElement));

        dims.delete(element);
        element.classList.remove(DIM_CLASS);
    };

    const undimAll = () => {

        const elements = [];

        dims.forEach((_dim, element) => elements.push(element));

        for (let index = 0; index < elements.length; index++) undim(elements[index]);
    };

    /**
     * Takes a visualisation to have redrawn, and brings back the dim covering it once nothing else
     * under that dim is still to redraw.
     */
    const completeVisualisation = (visualisationElement) => {

        const element = dimsByVisualisationElement.get(visualisationElement);

        if (!element) return;

        const dim = dims.get(element);

        if (!dim) return;

        dim.awaiting.delete(visualisationElement);

        if (dim.awaiting.size === 0) undim(element);
    };

    /**
     * Brings a visualisation back the moment it has finished redrawing, rather than at the end of
     * the turn.
     */
    const undimVisualisation = (visualisation) => {

        const visualisationElement = visualisation?.element;

        if (!visualisationElement) return;

        completeVisualisation(visualisationElement);
    };

    /**
     * Takes the visualisations seen to redraw during the turn just ended as finished.  Read here
     * rather than as the changes arrive, since a visualisation's first act on redrawing is often to
     * throw away what it had drawn.
     */
    const completeVisualisationsSeenToRedraw = () => {

        const redrawn = [];

        dims.forEach((dim) => {

            dim.awaiting.forEach((visualisationElement) => {

                if (dim.redrawn.has(visualisationElement)) redrawn.push(visualisationElement);
            });
        });

        for (let index = 0; index < redrawn.length; index++) completeVisualisation(redrawn[index]);
    };

    const endOfTurn = () => {

        const now = performance.now();
        const wasReachedPromptly = now - lastTurnAt < PROMPT_TURN_MS;

        lastTurnAt = now;

        completeVisualisationsSeenToRedraw();

        if (dims.size === 0) {

            isWaiting = false;
            return;
        }

        if (!wasReachedPromptly) {
            quietSince = null;
        }
        else if (quietSince === null) {

            quietSince = now;
        }
        else if (now - quietSince >= QUIET_SETTLE_MS) {

            isWaiting = false;
            undimAll();
            return;
        }

        setTimeout(endOfTurn, 0);
    };

    const waitForRedraws = () => {

        lastTurnAt = performance.now();
        quietSince = null;

        if (isWaiting) return;

        isWaiting = true;
        setTimeout(endOfTurn, 0);
    };

    /**
     * A redraw is anything a visualisation puts on screen in place of what was there.  Attributes
     * are not watched, since the dim is itself an attribute change.  Which visualisation redrew is
     * read from where the change landed, the dim standing for more than one of them.
     */
    const watchForRedraws = (element, dim) => {

        dim.observer = new MutationObserver((records) => {

            for (let index = 0; index < records.length; index++) {

                const target = records[index].target;
                let node = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;

                while (node) {

                    if (dim.awaiting.has(node)) {

                        dim.redrawn.add(node);
                        break;
                    }

                    node = node.parentElement;
                }
            }
        });

        dim.observer.observe(element, {
            childList: true,
            subtree: true,
            characterData: true
        });
    };

    const isDimmable = (visualisation) =>
        !visualisation.isDestroyed && !!visualisation.element?.classList;

    const collectElements = (visualisations, containingReportGuid, visualisationElements) => {

        for (let index = 0; index < visualisations.length; index++) {

            const visualisation = visualisations[index];

            if (!isDimmable(visualisation)) continue;

            // A settings group declared in a report's view is the same literal in every open
            // instance of that report, so only the instance the change was made in answers it.
            if (!Ren.ReportContextMatch.isSameReportContext(
                containingReportGuid,
                visualisation.containingReportGuid
            )) continue;

            visualisationElements.add(visualisation.element);
        }
    };

    /**
     * Gets the element the dim covering a visualisation goes on: the outermost of the
     * visualisations being dimmed that this one is drawn inside, or the visualisation itself where
     * it stands on its own.
     */
    const getCoveringElement = (visualisationElement, visualisationElements) => {

        let covering = visualisationElement;
        let ancestor = visualisationElement.parentElement;

        while (ancestor) {

            if (visualisationElements.has(ancestor)) covering = ancestor;

            ancestor = ancestor.parentElement;
        }

        return covering;
    };

    /**
     * Gets the visualisations following the filter group, which is the settings group itself for a
     * visualisation that doesn't name one of its own.
     */
    const getVisualisationsByFilterGroup = (filterGroup) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();
        const result = [];

        for (let index = 0; index < visualisations.length; index++) {

            const visualisation = visualisations[index];
            const visualisationFilterGroup =
                visualisation.filterGroup ?? visualisation.dataGroupingSettingsGroup;

            if (visualisationFilterGroup === filterGroup) result.push(visualisation);
        }

        return result;
    };

    const startDim = (element) => {

        const dim = { observer: null, covers: new Set(), awaiting: new Set(), redrawn: new Set() };

        dims.set(element, dim);
        watchForRedraws(element, dim);
        element.classList.add(DIM_CLASS);

        return dim;
    };

    const dimForFilterChange = (group, filterGroup, containingReportGuid) => {

        writeStylesheet();

        const visualisationElements = new Set();

        collectElements(
            Ren.VisualisationCollection.getVisualisationsByDataGroupingSettingsGroup(group),
            containingReportGuid,
            visualisationElements
        );

        collectElements(
            getVisualisationsByFilterGroup(filterGroup),
            containingReportGuid,
            visualisationElements
        );

        visualisationElements.forEach((visualisationElement) => {

            const element = getCoveringElement(visualisationElement, visualisationElements);
            const dim = dims.get(element) ?? startDim(element);

            dim.covers.add(visualisationElement);
            dim.awaiting.add(visualisationElement);
            dim.redrawn.delete(visualisationElement);

            dimsByVisualisationElement.set(visualisationElement, element);
        });

        waitForRedraws();
    };

    Ren.Messages.Events.filterChanging.handle((
        dataGroupingSettingsGroup, filterGroup, containingReportGuid) => {

        dimForFilterChange(dataGroupingSettingsGroup, filterGroup, containingReportGuid);
    });

    return {
        undimVisualisation,
        undimAll
    };
})();
