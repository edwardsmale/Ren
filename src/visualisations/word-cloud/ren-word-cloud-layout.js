/**
 * Lays out the words in a word cloud without overlap and within the visualisation's bounds.
 */
Ren.WordCloud_Layout = (() => {

    const minFontSize = 6;
    const maxFontSize = 80;
    const maxFontSizeRatio = 8;
    const fontFamily = "Arial, sans-serif";

    // Pixels added after every character by the word cloud's stylesheet, whatever the font size.
    const letterSpacing = 1;

    // Arial's ascent plus descent, so a word's box covers its glyphs.
    const lineHeightRatio = 1.12;

    // The share of the canvas the words' padded boxes aim to cover.  Spiral packing leaves
    // gaps, so aiming for much more leaves words unplaced.
    const targetFillRatio = 0.5;

    const measuringFontSize = 100;
    const fallbackCharWidthRatio = 0.55;

    let measuringContext = null;

    const getHorizontalPadding = fontSize => 2 + fontSize * 0.1;

    const getVerticalPadding = fontSize => 1 + fontSize * 0.04;

    /**
     * Gets a word's width, less its letter spacing, as a multiple of its font size.
     */
    const measureWidthRatio = word => {

        if (measuringContext === null) {
            measuringContext = document.createElement("canvas").getContext("2d") || false;
        }

        if (!measuringContext) {
            return word.length * fallbackCharWidthRatio;
        }

        measuringContext.font = measuringFontSize + "px " + fontFamily;
        return measuringContext.measureText(word).width / measuringFontSize;
    };

    const getTextWidth = (fontSize, widthRatio, word) =>
        fontSize * widthRatio + letterSpacing * word.length;

    /**
     * Creates a function sizing a word by its count, scaled so that together the words cover
     * about the target share of the canvas.
     */
    const createFontScale = (data, props) => {

        let minCount = Infinity;
        let maxCount = -Infinity;

        for (let i = 0; i < data.length; i++) {

            const count = data[i][props.countHeading];
            if (count < minCount) minCount = count;
            if (count > maxCount) maxCount = count;
        }

        const minRoot = Math.sqrt(minCount);
        const rootRange = Math.sqrt(maxCount) - minRoot;

        // From 0 for the rarest word to 1 for the commonest, by square root so a word's area
        // rather than its height follows its count.  With a single count every word is largest.
        const getSizeFraction = count => rootRange > 0
            ? (Math.sqrt(count) - minRoot) / rootRange
            : 1;

        // The rarest words keep the smallest size; only the spread up to the largest is fitted.
        const getFontSize = (largestFontSize, count) => {

            const smallestFontSize = Math.max(minFontSize, largestFontSize / maxFontSizeRatio);
            return smallestFontSize + (largestFontSize - smallestFontSize) * getSizeFraction(count);
        };

        const counts = new Array(data.length);
        const words = new Array(data.length);
        const widthRatios = new Array(data.length);

        for (let i = 0; i < data.length; i++) {

            counts[i] = data[i][props.countHeading];
            words[i] = String(data[i][props.wordHeading]);
            widthRatios[i] = measureWidthRatio(words[i]);
        }

        const getTotalArea = largestFontSize => {

            let area = 0;

            for (let i = 0; i < data.length; i++) {

                const fontSize = getFontSize(largestFontSize, counts[i]);
                const textWidth = getTextWidth(fontSize, widthRatios[i], words[i]);
                area += (textWidth + 2 * getHorizontalPadding(fontSize)) *
                    (fontSize * lineHeightRatio + 2 * getVerticalPadding(fontSize));
            }
            return area;
        };

        const targetArea = targetFillRatio * props.innerWidth * props.innerHeight;
        let low = minFontSize;
        let high = maxFontSize;

        // Padding has a fixed part, so area is not proportional to size and is fitted by search.
        for (let iteration = 0; iteration < 20; iteration++) {

            const middle = (low + high) / 2;

            if (getTotalArea(middle) > targetArea) {
                high = middle;
            }
            else {

                low = middle;
            }
        }

        return count => getFontSize(low, count);
    };

    const layoutWords = (data, fontScale, props) => {

        // A fixed seed keeps the layout the same from one render to the next.
        const seed = typeof props.randomSeed === "number" ? props.randomSeed : 123456789;
        const seededRandom = Ren.RandomUtils.mulberry32(seed);

        const innerWidth = props.innerWidth;
        const innerHeight = props.innerHeight;

        const words = [];

        for (let i = 0; i < data.length; i++) {

            const word = String(data[i][props.wordHeading]);
            const count = data[i][props.countHeading];
            const widthRatio = measureWidthRatio(word);
            let fontSize = fontScale(count);

            const maxWidth = innerWidth - 2 * getHorizontalPadding(fontSize);

            if (getTextWidth(fontSize, widthRatio, word) > maxWidth) {

                const maxWidthLessSpacing = maxWidth - letterSpacing * word.length;
                fontSize = Math.max(minFontSize, maxWidthLessSpacing / widthRatio);
            }

            const horizontalPadding = getHorizontalPadding(fontSize);
            const verticalPadding = getVerticalPadding(fontSize);
            const width = getTextWidth(fontSize, widthRatio, word);
            const height = fontSize * lineHeightRatio;

            words.push({
                word,
                count,
                fontSize,
                width,
                height,
                boxWidth: width + 2 * horizontalPadding,
                boxHeight: height + 2 * verticalPadding,
                horizontalPadding,
                verticalPadding,
                x: 0,
                y: 0,
                index: i
            });
        }

        words.sort((a, b) => b.fontSize - a.fontSize || b.count - a.count || a.index - b.index);

        // Placed boxes are bucketed into grid cells for faster collision detection.
        const gridSize = 15;
        const gridColumns = Math.ceil(innerWidth / gridSize);
        const gridRows = Math.ceil(innerHeight / gridSize);
        const grid = new Array(gridColumns * gridRows);

        for (let i = 0; i < grid.length; i++) {
            grid[i] = [];
        }

        // Called for every point on every spiral, so the grid is walked inline.
        const hasCollision = (x, y, width, height) => {

            const minColumn = Math.max(0, Math.floor(x / gridSize));
            const maxColumn = Math.min(gridColumns - 1, Math.floor((x + width) / gridSize));
            const minRow = Math.max(0, Math.floor(y / gridSize));
            const maxRow = Math.min(gridRows - 1, Math.floor((y + height) / gridSize));
            const right = x + width;
            const bottom = y + height;

            for (let row = minRow; row <= maxRow; row++) {

                for (let column = minColumn; column <= maxColumn; column++) {

                    const cell = grid[row * gridColumns + column];

                    for (let i = 0; i < cell.length; i++) {

                        const placed = cell[i];

                        if (x < placed.right && right > placed.x &&
                            y < placed.bottom && bottom > placed.y) {

                            return true;
                        }
                    }
                }
            }
            return false;
        };

        const recordPlacement = (x, y, width, height) => {

            const box = { x, y, right: x + width, bottom: y + height };
            const minColumn = Math.max(0, Math.floor(x / gridSize));
            const maxColumn = Math.min(gridColumns - 1, Math.floor(box.right / gridSize));
            const minRow = Math.max(0, Math.floor(y / gridSize));
            const maxRow = Math.min(gridRows - 1, Math.floor(box.bottom / gridSize));

            for (let row = minRow; row <= maxRow; row++) {

                for (let column = minColumn; column <= maxColumn; column++) {
                    grid[row * gridColumns + column].push(box);
                }
            }
        };

        const centerX = innerWidth / 2;
        const centerY = innerHeight / 2;
        const aspectRatio = innerWidth / innerHeight;

        // Points on the spiral are about this far apart, both around and between its turns.
        const spiralSpacing = 4;

        // An elliptical spiral out from the center, stretched to the canvas's shape.
        const tryPlaceOnSpiral = w => {

            const halfWidth = w.boxWidth / 2;
            const halfHeight = w.boxHeight / 2;

            // Beyond this radius every point on the spiral leaves the box outside the canvas.
            const maxRadius = Math.sqrt(
                Math.pow((centerX + halfWidth) / aspectRatio, 2) + Math.pow(centerY + halfHeight, 2)
            );

            const radiusPerRadian = spiralSpacing / (2 * Math.PI);
            const direction = seededRandom() < 0.5 ? -1 : 1;
            const startAngle = seededRandom() * 2 * Math.PI;
            let angle = 0;

            for (let radius = 0; radius <= maxRadius; radius = angle * radiusPerRadian) {

                const spiralAngle = startAngle + direction * angle;
                const x = centerX + aspectRatio * radius * Math.cos(spiralAngle) - halfWidth;
                const y = centerY + radius * Math.sin(spiralAngle) - halfHeight;

                if (x >= 0 && x + w.boxWidth <= innerWidth &&
                    y >= 0 && y + w.boxHeight <= innerHeight &&
                    !hasCollision(x, y, w.boxWidth, w.boxHeight)) {

                    recordPlacement(x, y, w.boxWidth, w.boxHeight);
                    w.x = x + w.horizontalPadding;
                    w.y = y + w.verticalPadding;
                    return true;
                }

                const arcRadius = radius * Math.max(1, aspectRatio);
                angle += spiralSpacing / Math.max(spiralSpacing, arcRadius);
            }
            return false;
        };

        const placedWords = [];

        // A box that did not fit rules out any box at least as wide and tall, saving a long
        // fruitless search for each of the many small words once the canvas is full.
        const unplacedBoxes = [];

        const isRuledOut = w => {

            for (let i = 0; i < unplacedBoxes.length; i++) {

                const box = unplacedBoxes[i];

                if (w.boxWidth >= box.width && w.boxHeight >= box.height) {
                    return true;
                }
            }
            return false;
        };

        for (let i = 0; i < words.length; i++) {

            const w = words[i];
            const ruledOut = isRuledOut(w);

            if (!ruledOut && tryPlaceOnSpiral(w)) {

                placedWords.push(w);
                continue;
            }

            if (!ruledOut) {
                unplacedBoxes.push({ width: w.boxWidth, height: w.boxHeight });
            }
        }

        return placedWords;
    };

    return {
        createFontScale,
        layoutWords,
        letterSpacing
    };
})();
