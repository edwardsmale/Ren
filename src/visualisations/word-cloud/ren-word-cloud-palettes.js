/**
 * Word Cloud Color Palettes
 * Centralized palette definitions used across word cloud visualizations
 * Inspired by https://www.datawrapper.de/blog/colors-for-data-vis-style-guides
 */
Ren.WordCloud_Palettes = (() => {

    const DEFAULT_PALETTE_ID = "accent";

    // Palettes renamed since settings were saved with them.
    const LEGACY_PALETTE_IDS = {
        default: "standard",
        mint: "green",
        blush: "red",
        aurora: "hi-vis"
    };

    const palettes = {
        accent: {
            name: "Accent",
            id: "accent",
            backgroundColor: "#FFFFFF",
            colors: ["#EB4297", "#4D85FF", "#FD9C29", "#008000", "#7B3FBF", "#00858A", "#1F3A93", "#B0206E", "#C75F00", "#4A4A4A"]
        },
        standard: {
            name: "Standard",
            id: "standard",
            backgroundColor: "#FFFFFF",
            colors: ["#1565A0", "#E67E0D", "#237A1D", "#B71C1C", "#6B4C8A", "#6D4C41", "#C2185B", "#616161", "#9FA825", "#00838F"]
        },
        earth: {
            name: "Earth",
            id: "earth",
            backgroundColor: "#FAF6EF",
            colors: ["#8C3B1E", "#5B6B2E", "#A0661B", "#3E5A6B", "#7A3E5C", "#2F6B55", "#6B4E2E", "#A83F3F", "#4A5A8C", "#7A6A1F"]
        },
        green: {
            name: "Green",
            id: "green",
            backgroundColor: "#EEF7F0",
            colors: ["#14532D", "#7C2D12", "#1E3A8A", "#86198F", "#9A3412", "#0F766E", "#713F12", "#9F1239", "#3F6212", "#4C1D95"]
        },
        amber: {
            name: "Amber",
            id: "amber",
            backgroundColor: "#FDF4E3",
            colors: ["#8A4B00", "#3B4F7A", "#A3360F", "#2F6B4F", "#6E3A6B", "#7A5A00", "#9B2C2C", "#1F5F6B", "#5C4033", "#B35900"]
        },
        red: {
            name: "Red",
            id: "red",
            backgroundColor: "#FBEFF1",
            colors: ["#8E1B3A", "#4B3F72", "#1F6F78", "#A34A28", "#5E2750", "#2F5D3A", "#B03060", "#3D4F7C", "#7A5230", "#6B2D5C"]
        },
        midnight: {
            name: "Midnight",
            id: "midnight",
            backgroundColor: "#1A1A2E",
            colors: ["#64B5F6", "#81C784", "#FFB74D", "#EF5350", "#BA68C8", "#4DD0E1", "#FFD54F", "#64B5F6", "#A1887F", "#F48FB1"]
        },
        "hi-vis": {
            name: "Hi Vis",
            id: "hi-vis",
            backgroundColor: "#0D1117",
            colors: ["#7EE8FA", "#B8F28B", "#FFD166", "#FF8FA3", "#C3A6FF", "#5EEAD4", "#FFB86B", "#9AD1FF", "#F9A8D4", "#D9F99D"]
        },
        forest: {
            name: "Forest",
            id: "forest",
            backgroundColor: "#13261C",
            colors: ["#E9D8A6", "#94D2BD", "#F4A261", "#FFB5A7", "#CDB4DB", "#A7C957", "#FFD6A5", "#BDE0FE", "#F2CC8F", "#E5989B"]
        },
        plum: {
            name: "Plum",
            id: "plum",
            backgroundColor: "#241332",
            colors: ["#FFC6FF", "#A0C4FF", "#FDFFB6", "#9BF6FF", "#FFADAD", "#CAFFBF", "#FFD6A5", "#E0AAFF", "#F7B267", "#8EECF5"]
        },
        slate: {
            name: "Slate",
            id: "slate",
            backgroundColor: "#2B2F36",
            colors: ["#F6BD60", "#84DCC6", "#F28482", "#A5B4FC", "#F9DCC4", "#B9FBC0", "#FFCAD4", "#90DBF4", "#FDE68A", "#CFBAF0"]
        },
        greyscale: {
            name: "Greyscale",
            id: "greyscale",
            backgroundColor: "#FFFFFF",
            colors: ["#B0B0B0", "#9A9A9A", "#858585", "#707070", "#5C5C5C", "#484848", "#363636", "#242424", "#121212", "#000000"]
        },
        // Tints and shades of pink (#EB4297), light to dark like Greyscale.
        monochrome: {
            name: "Monochrome",
            id: "monochrome",
            backgroundColor: "#FFFFFF",
            colors: ["#F5A1CB", "#F284BD", "#EF64AA", "#EB4297", "#C83880", "#A52E6A", "#812453", "#5E1A3C", "#42122A", "#2A0C1B"]
        }
    };

    /**
     * Gets all available palettes as an array for use in menus
     */
    const getPalettesAsArray = () => {

        return Object.values(palettes);
    };

    /**
     * Gets a specific palette by ID
     */
    const getPaletteById = (paletteId) => {

        return palettes[paletteId]
            || palettes[LEGACY_PALETTE_IDS[paletteId]]
            || palettes[DEFAULT_PALETTE_ID];
    };

    /**
     * Gets the color palette object (for style generation)
     */
    const getColourPalettes = () => {

        const colourPalettes = {};
        Object.keys(palettes).forEach(key => {

            colourPalettes[key] = palettes[key].colors;
        });
        return colourPalettes;
    };

    return {
        DEFAULT_PALETTE_ID,
        getPalettesAsArray,
        getPaletteById,
        getColourPalettes
    };
})();
