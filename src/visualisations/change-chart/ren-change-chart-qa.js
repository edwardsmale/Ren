Ren.QA.ChangeChart = (() => {

    const setQaChangeChart = (props, inputData) => {

        const element = props.guid ? document.querySelector("." + props.guid) : null;

        if (!element) {
            return;
        }

        if (inputData) {
            element.setAttribute("data-qa-change-chart-row-count", inputData.length);
        }

        if (props.labelHeading) {
            element.setAttribute("data-qa-change-chart-label-column", props.labelHeading);
        }

        if (props.beforeHeading) {
            element.setAttribute("data-qa-change-chart-before-column", props.beforeHeading);
        }

        if (props.afterHeading) {
            element.setAttribute("data-qa-change-chart-after-column", props.afterHeading);
        }
    };

    return {
        setQaChangeChart
    };
})();
