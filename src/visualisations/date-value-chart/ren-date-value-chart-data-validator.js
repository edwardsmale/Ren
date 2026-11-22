Ren.CreateDateValueChart__DataValidator = (() => {

    const validateDatesExist = (props, data) => {

        if (data.some(d => Ren.IsNull(d[props.dateHeading]))) {

            const allMissing = data.every(d => Ren.IsNull(d[props.dateHeading]));

            if (allMissing) {
                return `Date column '${props.dateHeading}' not found.`;
            }
            else {

                return `Some data points are missing dates (expected column '${props.dateHeading}').`;
            }
        }

        return null;
    };

    const validateValuesExist = (props, data) => {

        if (props.valueHeadings && Array.isArray(props.valueHeadings)) {

            for (let i = 0; i < props.valueHeadings.length; i++) {

                const heading = props.valueHeadings[i];

                if (data.some(d => Ren.IsNull(d[heading]))) {

                    const allMissing = data.every(d => Ren.IsNull(d[heading]));

                    if (allMissing) {
                        return `Value column '${heading}' not found.`;
                    }
                    else {

                        return `Some data points are missing values (expected column '${heading}').`;
                    }
                }
            }
        }
        else if (props.valueHeading) {

            if (data.some(d => Ren.IsNull(d[props.valueHeading]))) {

                const allMissing = data.every(d => Ren.IsNull(d[props.valueHeading]));

                if (allMissing) {
                    return `Value column '${props.valueHeading}' not found.`;
                }
                else {

                    return `Some data points are missing values (expected column '${props.valueHeading}').`;
                }
            }
        }

        return null;
    };

    const validateDateValueChartData = (props, data) => {

        const volumeError = Ren.CreateDateValueChart_PrepareData.validateInputDataVolume(data);

        if (volumeError) return volumeError;

        const dateError = validateDatesExist(props, data);

        if (dateError) {

            console.warn("DateValueChart: " + dateError);
            return dateError;
        }

        const valueError = validateValuesExist(props, data);

        if (valueError) {

            console.warn("DateValueChart: " + valueError);
            return valueError;
        }

        return true;
    };

    return {
        validateDateValueChartData
    };
})();
