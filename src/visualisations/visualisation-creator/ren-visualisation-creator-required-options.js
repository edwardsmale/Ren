/**
 * Enforces required options when creating visualisations.
 */
Ren.VisualisationCreator_RequiredOptions = (() => {

    const requiredOptions = {

        // Currently no required options.  sourceVisualisation was previously required but
        // removed because it was always set to null by the actuizer and didn't provide value.
    };

    const validateOptions = (options) => {

        Object.keys(requiredOptions).forEach(key => {

            let type = requiredOptions[key];
            const isNullable = type.endsWith("?");

            if (isNullable) type = type.slice(0, -1); // Remove the "?" from the end.

            if (options[key] === undefined) {

                let message = "Visualisation options are missing required option: " + key;

                if (isNullable) {

                    message +=
                        "  (You may pass NULL for this option if you don't need it - but the " +
                        "field needs to exist in the options object.)";
                }

                throw new Error(message);
            }

            if (options[key] === null && !isNullable) {
                throw new Error("Visualisation option " + key + " cannot be NULL.");
            }

            if (options[key] !== null && typeof options[key] !== type) {

                throw new Error(
                    "Visualisation option " + key + " must be of type " + type + "."
                );
            }
        });
    };

    return {
        validateOptions
    };
})();
