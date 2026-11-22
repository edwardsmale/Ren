Ren.CreateWordCloud_DataValidator = (() => {

    const validateWordCloudData = (props, data) => {

        if (!data || data.length === 0) {
            return "No data to display in word cloud";
        }

        if (!props.wordHeading) {
            return "Word column not specified";
        }

        if (!props.countHeading) {
            return "Count column not specified";
        }

        const hasValidCounts = data.some(d => {

            const count = d[props.countHeading];
            return !isNaN(count) && count > 0;
        });

        if (!hasValidCounts) {
            return "No valid numeric counts found in data";
        }

        return true;
    };

    return {
        validateWordCloudData
    };
})();
