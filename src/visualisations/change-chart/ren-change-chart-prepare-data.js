Ren.ChangeChart_PrepareData = (() => {

    const toNumber = (value) => {

        if (value === null || value === undefined || value === "" || value === Ren.NullSentinel) {
            return NaN;
        }

        return Number(value);
    };

    /**
     * Gets the rows to draw, in the data's order: those with both a before and an after value.
     */
    const prepareData = (inputData, props) => {

        const rows = [];

        for (let index = 0; index < inputData.length; index++) {

            const row = inputData[index];
            const before = toNumber(row[props.beforeHeading]);
            const after = toNumber(row[props.afterHeading]);

            if (!isFinite(before) || !isFinite(after)) continue;

            rows.push({
                label: row[props.labelHeading],
                before,
                after,
                row
            });
        }

        return rows;
    };

    return {
        prepareData
    };
})();
