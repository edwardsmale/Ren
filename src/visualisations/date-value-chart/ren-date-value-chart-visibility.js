/**
 * Shows and hides the parts of a date/value chart that come and go - the hover band, the dragged
 * range, the crosshairs and axes the chart is drawn without - through a stylesheet of the chart's
 * own rather than on the elements themselves.  The rules are keyed by selector, so hold through
 * redraws, and the sheet is written only when what is hidden changes.
 */
Ren.DateValueChart_Visibility = (() => {

    const getState = (props) => {

        if (!props.visibility) {

            const stylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "visibility")
                .getStylesheet();

            // Props made afresh start with everything shown, whatever a sheet under the same guid
            // was left holding.
            stylesheet.textContent = "";

            props.visibility = { stylesheet, hiddenSelectors: new Set() };
        }

        return props.visibility;
    };

    /**
     * Shows or hides every element of the chart matching a selector.
     *
     * @param {object} props - The chart's props.
     * @param {string} selector - The elements' selector, within the chart.
     * @param {boolean} isShown - Whether they are shown.
     */
    const setShown = (props, selector, isShown) => {

        const state = getState(props);

        if (state.hiddenSelectors.has(selector) !== isShown) return;

        if (isShown) {
            state.hiddenSelectors.delete(selector);
        }
        else {

            state.hiddenSelectors.add(selector);
        }

        const rules = [];

        state.hiddenSelectors.forEach(hiddenSelector => {

            rules.push(`.${props.guid} ${hiddenSelector} { display: none }`);
        });

        state.stylesheet.textContent = rules.join("\n");
    };

    return {
        setShown
    };
})();
