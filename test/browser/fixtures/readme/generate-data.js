// Generates the made-up data behind the README's screenshots: 22 months of monthly
// sales for an imaginary outdoor and cycling shop, its date markers, its site's search terms, and
// each category's revenue in the first nine months of 2025 and of 2026.  Run with node from the
// repo's root; the output is the same every time.

const fs = require("fs");
const path = require("path");

const folder = __dirname;

// A small seeded generator, so that the data is the same on every run.
let seed = 20260101;
const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Department, category, monthly revenue across all regions, average order value, margin, and
// each month's trade relative to the category's average (January first).
const categories = [
    ["Bikes", "Road bikes", 120000, 1150, 0.17, [0.55, 0.6, 0.95, 1.3, 1.45, 1.4, 1.35, 1.15, 0.95, 0.75, 0.6, 0.95]],
    ["Bikes", "Mountain bikes", 95000, 880, 0.19, [0.5, 0.55, 0.85, 1.15, 1.4, 1.45, 1.45, 1.35, 1.1, 0.8, 0.6, 0.8]],
    ["Bikes", "E-bikes", 70000, 2050, 0.14, [0.6, 0.65, 0.95, 1.25, 1.35, 1.3, 1.25, 1.2, 1.05, 0.85, 0.7, 0.85]],
    ["Camping", "Tents", 42000, 230, 0.31, [0.25, 0.3, 0.55, 0.9, 1.45, 1.9, 2.1, 1.85, 0.9, 0.45, 0.3, 0.35]],
    ["Camping", "Sleeping bags", 18000, 82, 0.34, [0.35, 0.35, 0.55, 0.85, 1.3, 1.7, 1.95, 1.75, 0.95, 0.55, 0.45, 0.65]],
    ["Clothing", "Waterproof jackets", 52000, 135, 0.42, [1.35, 1.1, 0.95, 0.8, 0.6, 0.5, 0.5, 0.6, 0.95, 1.4, 1.6, 1.65]],
    ["Clothing", "Walking boots", 40000, 118, 0.38, [0.8, 0.85, 1.15, 1.3, 1.2, 0.95, 0.9, 0.9, 1.05, 1.15, 0.85, 0.9]]
];

const regions = [["North", 0.85], ["South", 1.3], ["East", 0.8], ["West", 1.05]];

const months = [];
for (let date = new Date(Date.UTC(2025, 0, 1)); date <= new Date(Date.UTC(2026, 9, 1));
    date.setUTCMonth(date.getUTCMonth() + 1)) {

    months.push(new Date(date));
}

const round2 = (value) => Math.round(value * 100) / 100;

const rows = [];
for (const month of months) {

    const monthIndex = month.getUTCMonth();
    const monthsIn = (month.getUTCFullYear() - 2025) * 12 + monthIndex;

    for (const [department, category, base, orderValue, margin, seasons] of categories) {

        // Trade grows about 8% a year, and e-bikes much faster after September 2025's new range.
        let factor = seasons[monthIndex] * (1 + monthsIn * 0.0065);
        if (category === "E-bikes" && month >= new Date(Date.UTC(2025, 8, 1))) {
            factor *= 1.35 + (monthsIn - 8) * 0.02;
        }

        // The spring sales lift March, and the summer camping weekends lift July.
        if (monthIndex === 2) factor *= 1.12;
        if (monthIndex === 6 && department === "Camping" && month.getUTCFullYear() === 2026) factor *= 1.2;

        for (const [region, weight] of regions) {

            const revenue = base * weight / 3.95 * factor * (0.88 + random() * 0.24);
            const orders = Math.max(1, Math.round(revenue / (orderValue * (0.93 + random() * 0.14))));
            const profit = revenue * (margin + (random() - 0.5) * 0.04);

            rows.push([month.toISOString().slice(0, 10), department, category, region, orders,
                round2(revenue), round2(profit)]);
        }
    }
}

const write = (name, data) => {
    const lines = [
        "{",
        `    "columns": ${JSON.stringify(data.columns)},`,
        "    \"rows\": [",
        data.rows.map(row => "        " + JSON.stringify(row)).join(",\n"),
        "    ]",
        "}",
        ""
    ];
    fs.writeFileSync(path.join(folder, name), lines.join("\n"));
};

write("sales.json", {
    columns: ["OrderDate", "Department", "Category", "Region", "Orders", "Revenue", "Profit"],
    rows
});

write("markers.json", {
    columns: ["Date", "Event"],
    rows: [
        ["2025-03-07", "Spring sale"],
        ["2025-09-01", "New e-bike range"],
        ["2026-03-06", "Spring sale"],
        ["2026-05-18", "Riverside store opens"],
        ["2026-07-03", "Camping weekends"]
    ]
});

// Each category's revenue over January to September of each year.
const revenueByCategory = (year) => {
    const totals = {};
    for (const row of rows) {
        if (row[0].startsWith(year) && row[0] < `${year}-10`) {
            totals[row[2]] = (totals[row[2]] || 0) + row[5];
        }
    }
    return totals;
};

const before = revenueByCategory("2025");
const after = revenueByCategory("2026");

write("category-change.json", {
    columns: ["Category", "Jan-Sep 2025", "Jan-Sep 2026"],
    rows: categories.map(([, category]) => [category, round2(before[category]), round2(after[category])])
});

const searchTerms = [
    "waterproof jacket", "e-bike", "gravel bike", "walking boots", "tent", "helmet", "bike lights",
    "sleeping bag", "inner tube", "panniers", "camping stove", "bike lock", "base layer",
    "trail shoes", "cycling shorts", "head torch", "puncture repair", "kids bike", "rucksack",
    "tent pegs", "mudguards", "bike pump", "gloves", "fleece", "camping chair", "cool box",
    "roof rack", "bottle cage", "saddle", "chain lube", "insulated jacket", "walking poles",
    "cycling jersey", "sunglasses", "turbo trainer", "bivvy bag", "hammock", "dry bag",
    "clip-in pedals", "tyres"
];

write("search-terms.json", {
    columns: ["Search term", "Searches"],
    rows: searchTerms.map((term, i) => [term, Math.round(4200 / Math.pow(i + 1, 0.75) * (0.85 + random() * 0.3))])
});
