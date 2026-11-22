Ren.CreateWordCloud_PrepareData = (() => {

    // Anything that is not a letter, a digit or an intra-word apostrophe or hyphen separates one
    // word from the next.
    const wordSeparatorPattern = /[^\p{L}\p{N}'’-]+/u;

    /**
     * Splits a phrase into its individual words, discarding empty fragments and any leading or
     * trailing punctuation left on a word by the split.
     */
    const splitIntoWords = (phrase) => {

        const fragments = String(phrase).split(wordSeparatorPattern);
        const words = [];

        for (let i = 0; i < fragments.length; i++) {

            const word = fragments[i].replace(/^['’-]+|['’-]+$/g, "");

            if (word) words.push(word);
        }

        return words;
    };

    /**
     * Replaces each phrase with its individual words, summing the phrase's count into every word
     * it contains.  Words are counted case insensitively, and shown in the casing first met.
     */
    const aggregateIndividualWords = (data, props) => {

        const counts = Object.create(null);
        const displayWords = Object.create(null);

        for (let i = 0; i < data.length; i++) {

            const row = data[i];
            const count = row[props.countHeading];
            const words = splitIntoWords(row[props.wordHeading]);

            for (let j = 0; j < words.length; j++) {

                const word = words[j];
                const key = word.toLowerCase();

                if (counts[key] === undefined) {

                    counts[key] = count;
                    displayWords[key] = word;
                }
                else {

                    counts[key] += count;
                }
            }
        }

        const keys = Object.keys(counts);
        const aggregated = [];

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];
            const obj = {};
            obj[props.wordHeading] = displayWords[key];
            obj[props.countHeading] = counts[key];
            aggregated.push(obj);
        }

        return aggregated;
    };

    const prepareData = (inputData, props) => {

        if (!inputData || inputData.length === 0) {
            return null;
        }

        // First pass: create objects with word and count
        let data = inputData.map(row => {

            const word = row[props.wordHeading];

            const obj = {};
            obj[props.wordHeading] = word === Ren.NullSentinel ? "null" : word;
            obj[props.countHeading] = +row[props.countHeading];

            return obj;
        })
        .filter(d => d[props.wordHeading] && d[props.countHeading] > 0);

        if (props.wordCloudIndividualWords) {

            // Counting individual words aggregates the counts itself, so the phrase-level
            // aggregation below is neither needed nor wanted.
            data = aggregateIndividualWords(data, props);
        }
        else {

            // Check if all counts are 1 (indicating we need to aggregate)
            const allCountsAreOne = data.every(d => d[props.countHeading] === 1);

            if (allCountsAreOne && data.length > 1) {

                // Group by word and count occurrences
                const grouped = {};
                data.forEach(row => {

                    const word = row[props.wordHeading];

                    if (grouped[word]) {

                        grouped[word]++;
                    }
                    else {

                        grouped[word] = 1;
                    }
                });

                // Convert back to array format
                data = Object.entries(grouped).map(([word, count]) => {

                    const obj = {};
                    obj[props.wordHeading] = word;
                    obj[props.countHeading] = count;
                    return obj;
                });
            }
        }

        // Sort by count descending
        return data.sort((a, b) => b[props.countHeading] - a[props.countHeading]);
    };

    return {
        prepareData
    };
})();
