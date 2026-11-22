/**
 * Builds a Ren enum: the named values it declares, plus the members every enum needs but should not
 * have to restate - the ordered name and value lists to build menus from, and the reverse lookup
 * behind AsString.  Since those are supplied here rather than written out per enum, a caller can
 * iterate an enum's Values without having to sift them out of its helper functions by type.
 *
 * Most of these enums mirror a server-side C# enum, so their numbers are stated explicitly rather
 * than generated from the declaration order.
 *
 * helpers, where given, are the enum's own predicates (e.g. IsNumeric), added as members of it.
 */
Ren.DefineEnum = (members, helpers) => {

    const enumeration = {};
    const names = Object.keys(members);
    const values = [];
    const namesByValue = {};

    for (let i = 0; i < names.length; i++) {

        const name = names[i];
        const value = members[name];

        enumeration[name] = value;
        values.push(value);

        // Where an enum declares an alias (a Default naming one of its real members), the member's
        // own name is kept, so AsString reports the value rather than how it came to be chosen.
        if (!(value in namesByValue)) namesByValue[value] = name;
    }

    // The declared names and their values, in declaration order and index for index.  Aliases
    // appear in both, being declared members in their own right.
    enumeration.Names = names;
    enumeration.Values = values;

    // The name of the member with this value, or undefined where no member has it.
    enumeration.AsString = (value) => namesByValue[value];

    if (helpers) {

        const helperNames = Object.keys(helpers);

        for (let i = 0; i < helperNames.length; i++) {
            enumeration[helperNames[i]] = helpers[helperNames[i]];
        }
    }

    return enumeration;
};
