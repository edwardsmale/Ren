Ren.QA.WordCloud = (() => {

    const setQaWordCloud = (props, inputData) => {

        if (!props.guid) {
            return;
        }

        const element = document.querySelector("." + props.guid);

        if (!element) {
            return;
        }

        if (inputData) {
            element.setAttribute("data-qa-word-cloud-row-count", inputData.length);
        }

        if (props.wordHeading) {
            element.setAttribute("data-qa-word-cloud-word-column", props.wordHeading);
        }

        if (props.countHeading) {
            element.setAttribute("data-qa-word-cloud-count-column", props.countHeading);
        }

        element.setAttribute(
            "data-qa-word-cloud-individual-words",
            props.wordCloudIndividualWords === true
        );
    };

    return {
        setQaWordCloud
    };
})();
