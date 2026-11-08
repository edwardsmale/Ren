/**
 * Utilities for working with query embeddings.
 */
Ren.EmbeddingUtils = (() => {

    const MAX_COUNT_MULTIPLE = 8;
    const SMALLINT_EMBEDDING_SCALE = 32767;
    const HEX_DIGITS_REGEX = /^[0-9A-Fa-f]+$/;

    /**
     * Gets the bucket counts an embedding was made from.  Data generated before counts were sent
     * (and still cached) holds each count divided by the vector's magnitude, so dividing by the
     * smallest value gives the counts back, or a multiple of them where no bucket held 1.  Returns
     * null if the values are not in proportion to whole numbers.
     */
    const getCounts = (embedding) => {

        let smallest = Infinity;
        let isCounts = true;

        for (let i = 0; i < embedding.length; i++) {

            if (embedding[i] !== 0) {
                smallest = Math.min(smallest, Math.abs(embedding[i]));
            }

            if (!Number.isInteger(embedding[i])) {
                isCounts = false;
            }
        }

        if (isCounts) return embedding;

        for (let multiple = 1; multiple <= MAX_COUNT_MULTIPLE; multiple++) {

            const counts = new Array(embedding.length);
            let index = 0;

            for (; index < embedding.length; index++) {

                const count = smallest === Infinity ? 0 : embedding[index] / smallest * multiple;
                const rounded = Math.round(count);

                if (Math.abs(count - rounded) > 0.01) break;

                counts[index] = rounded;
            }

            if (index === embedding.length) return counts;
        }

        return null;
    };

    /**
     * Gets the embedding's bucket counts as a Base64 string of signed bytes, which is how settings
     * files store it.  Counts beyond a byte are clamped, which barely moves the similarity.
     */
    const encodeEmbedding = (embedding) => {

        if (!Array.isArray(embedding)) return embedding;

        const counts = getCounts(embedding);

        if (!counts) return embedding;

        let binary = "";

        for (let i = 0; i < counts.length; i++) {

            const count = Math.max(-127, Math.min(127, counts[i]));

            binary += String.fromCharCode(count & 0xFF);
        }

        return btoa(binary);
    };

    /**
     * Gets the bucket counts from an embedding stored by encodeEmbedding.  Settings saved before
     * embeddings were encoded hold an array, which is returned as it is.
     */
    const decodeEmbedding = (embedding) => {

        if (Array.isArray(embedding)) return embedding;

        if (typeof embedding !== "string" || embedding.length === 0) return null;

        let binary;

        try {
            binary = atob(embedding);
        }
        catch (error) {

            console.warn("[EmbeddingUtils] Could not decode query embedding:", error);
            return null;
        }

        const counts = new Array(binary.length);

        for (let i = 0; i < binary.length; i++) {

            const byte = binary.charCodeAt(i);

            counts[i] = byte > 127 ? byte - 256 : byte;
        }

        return counts;
    };

    /**
     * Gets the vector from an embedding the SQL stores as a VARBINARY of big-endian SMALLINTs,
     * each a unit vector's dimension multiplied by 32767.  A VARBINARY column reaches Ren as a
     * string of upper-case hex digits, as CONVERT(VARCHAR(MAX), <column>, 2) writes it, which is
     * what this expects, with or without the "0x" prefix of style 1.  Returns a Float32Array of
     * values from -1 to 1, which cosineSimilarity can compare, or null for a NULL embedding or a
     * string that is not whole SMALLINTs of hex.
     *
     * @param {string} hex - The embedding's bytes as hexadecimal digits, four per dimension
     * @returns {Float32Array|null} The unit vector
     */
    const decodeHexEmbedding = (hex) => {

        if (typeof hex !== "string") return null;

        const start = hex.charAt(1) === "x" || hex.charAt(1) === "X" ? 2 : 0;
        const length = (hex.length - start) / 4;

        if (length === 0 || !Number.isInteger(length)) return null;
        if (!HEX_DIGITS_REGEX.test(start === 0 ? hex : hex.substring(start))) return null;

        const vector = new Float32Array(length);

        for (let i = 0; i < length; i++) {

            const offset = start + i * 4;
            const value = parseInt(hex.substring(offset, offset + 4), 16);

            vector[i] = (value >= 32768 ? value - 65536 : value) / SMALLINT_EMBEDDING_SCALE;
        }

        return vector;
    };

    /**
     * Gets the vector folded down to the given length by summing the buckets that share a bucket
     * at that length.  A bucket is the hash modulo the bucket count, so where one count divides
     * the other the larger vector folds exactly into the smaller: it is what would have been
     * generated had the smaller count been used.  This is what lets an embedding saved before the
     * bucket count was raised still be compared with one generated since.
     */
    const foldVector = (vector, length) => {

        const folded = new Array(length).fill(0);

        for (let i = 0; i < vector.length; i++) {
            folded[i % length] += vector[i];
        }

        return folded;
    };

    /**
     * Calculates the cosine similarity between two embedding vectors.
     * Returns a value between 0 and 1, where 1 means the vectors are identical.
     *
     * @param {number[]} vector1 - First embedding vector
     * @param {number[]} vector2 - Second embedding vector
     * @returns {number} Similarity score between 0 and 1
     */
    const cosineSimilarity = (vector1, vector2) => {

        if (vector1 && vector2 && vector1.length !== vector2.length) {

            const shorter = Math.min(vector1.length, vector2.length);

            if (shorter > 0 && vector1.length % shorter === 0 && vector2.length % shorter === 0) {

                vector1 = foldVector(vector1, shorter);
                vector2 = foldVector(vector2, shorter);
            }
        }

        if (!vector1 || !vector2) {

            return 0;
        }

        if (vector1.length !== vector2.length) {

            console.warn('[EmbeddingUtils] Vector length mismatch:', vector1.length, 'vs', vector2.length);
            return 0;
        }

        if (vector1.length === 0) {

            return 0;
        }

        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        for (let i = 0; i < vector1.length; i++) {

            dotProduct += vector1[i] * vector2[i];
            magnitude1 += vector1[i] * vector1[i];
            magnitude2 += vector2[i] * vector2[i];
        }

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) {

            return 0;
        }

        return dotProduct / (magnitude1 * magnitude2);
    };

    /**
     * Finds the most similar embedding from a set of candidates.
     *
     * @param {number[]} targetEmbedding - The embedding to compare against
     * @param {Object.<string, number[]>} candidateEmbeddings - Map of keys to embedding vectors
     * @returns {{key: string, similarity: number}|null} The most similar candidate and its
     *   similarity score
     */
    const findMostSimilar = (targetEmbedding, candidateEmbeddings) => {

        if (!targetEmbedding || !candidateEmbeddings) return null;

        let bestMatch = null;
        let bestSimilarity = -1;

        for (const [key, candidateEmbedding] of Object.entries(candidateEmbeddings)) {

            const similarity = cosineSimilarity(targetEmbedding, candidateEmbedding);

            if (similarity > bestSimilarity) {

                bestSimilarity = similarity;
                bestMatch = { key, similarity };
            }
        }

        return bestMatch;
    };

    /**
     * Finds all similar embeddings above a threshold.
     *
     * @param {number[]} targetEmbedding - The embedding to compare against
     * @param {Object.<string, number[]>} candidateEmbeddings - Map of keys to embedding vectors
     * @param {number} threshold - Minimum similarity score (0-1) to include in results.  Default is
     *   0.7
     * @returns {Array<{key: string, similarity: number}>} Array of matches sorted by similarity
     *   descending
     */
    const findSimilar = (targetEmbedding, candidateEmbeddings, threshold = 0.7) => {

        if (!targetEmbedding || !candidateEmbeddings) {

            return [];
        }

        const results = [];

        for (const [key, candidateEmbedding] of Object.entries(candidateEmbeddings)) {

            const similarity = cosineSimilarity(targetEmbedding, candidateEmbedding);

            if (similarity >= threshold) {

                results.push({ key, similarity });
            }
        }

        // Sort by similarity descending
        results.sort((a, b) => b.similarity - a.similarity);

        return results;
    };

    return {
        encodeEmbedding,
        decodeEmbedding,
        decodeHexEmbedding,
        cosineSimilarity,
        findMostSimilar,
        findSimilar
    };
})();
