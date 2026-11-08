/**
 * Creates tabular data transformer instances.
 */
Ren.TabularDataTransformerFactory = (() => {

    const doCreateTransformer = (name, parameters) => {

        if (name === "RegexReplaceColumn") {

            return Ren.TabularDataTransformer_RegexReplaceColumn(
                parameters.targetColumn,
                parameters.regexPattern,
                parameters.replacement,
                parameters.replacementFormat,
                parameters.replacementType
            );
        }
        else if (name === "CopyColumn") {

            return Ren.TabularDataTransformer_CopyColumn(
                parameters.insertBeforeColumn,
                parameters.valueColumnHeading,
                parameters.value_or_value_function_spec
            );
        }
        else if (name === "AddColumn") {

            return Ren.TabularDataTransformer_AddColumn(
                parameters.insertBeforeColumn,
                parameters.valueColumnHeading,
                parameters.columnFormat,
                parameters.columnType,
                parameters.isNewColumnCompressed,
                parameters.value_or_value_function_spec
            );
        }
        else if (name === "DuplicateColumn") {

            return Ren.TabularDataTransformer_DuplicateColumn(
                parameters.columnIdOrHeading
            );
        }
        else if (name === "SimpleFilter") {

            return Ren.TabularDataTransformer_SimpleFilter(
                parameters.columnIdOrHeading,
                parameters.filterFunction
            );
        }

        return null;
    };

    const cache = {};

    const getCacheKey = (name, parameters) => {

        return `${name}:${JSON.stringify(parameters)}`;
    };

    const createTransformer = (name, parameters) => {

        const cacheKey = getCacheKey(name, parameters);

        if (cache[cacheKey]) return cache[cacheKey];

        const transformer = doCreateTransformer(name, parameters);

        if (transformer) {
            cache[cacheKey] = transformer;
        }

        return transformer;
    };

    return {
        createTransformer
    };
})();
