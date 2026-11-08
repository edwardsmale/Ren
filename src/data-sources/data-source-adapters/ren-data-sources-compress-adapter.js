Ren.DataSourcesCompressAdapter = (() => {

    /**
     * Compresses the string and date values in the row models.
     * This code is equivalent to the code in TabularDataSetCollectionCompressor.cs.
     */
    const compress = (rowModels, isColumnCompressed, uniqueStrings) => {

        const dictionary = Array.from(uniqueStrings);
        dictionary.sort();

        // Create a map that maps the string values to their dictionary index.
        const dictionaryMap = new Map();

        for (let i = 0; i < dictionary.length; i++) {

            dictionaryMap.set(dictionary[i], i);
        }

        // Replace the string values in the compressed columns with their dictionary index.
        for (let i = 0; i < rowModels.length; i++) {

            const rowModel = rowModels[i];

            for (let j = 0; j < rowModel.CV.length; j++) {

                if (isColumnCompressed[j]) {

                    rowModel.CV[j] = dictionaryMap.get(rowModel.CV[j]);
                }
            }
        }

        return dictionary;
    };

    return {
        compress
    };
})();
