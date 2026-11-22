/**
 * Functions for working with objects.
 */
Ren.ObjectUtils = (() => {

    /**
     * Returns a value indicating whether the value is a plain object - one built by an object
     * literal or JSON.parse, or with no prototype - rather than an array, Date, class instance etc.
     * @param {*} value - The value to check.
     * @returns {boolean} True if the value is a plain object, false otherwise.
     */
    const isPlainObject = (value) => {

        if (!value || typeof value !== "object") return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    };

    /**
     * Deep clones an object, keeping any functions it holds.  Plain objects and arrays are rebuilt;
     * Dates, regular expressions, Maps, Sets and typed arrays are copied as new instances of
     * themselves; everything else, functions included, is carried across by reference.  Objects
     * that refer back to themselves are handled.
     * @param {Object} objectToClone - The object to deep clone.
     * @param {Map} [seen] - Values already cloned on this pass, keyed by the original.
     * @returns {Object} The deep-cloned object.
     */
    const cloneDeep = (objectToClone, seen) => {

        if (objectToClone == null || typeof objectToClone !== "object") return objectToClone;

        if (!seen) {
            seen = new Map();
        }
        else if (seen.has(objectToClone)) {

            return seen.get(objectToClone);
        }

        if (Array.isArray(objectToClone)) {

            const arr = new Array(objectToClone.length);
            seen.set(objectToClone, arr);

            for (let i = 0; i < objectToClone.length; i++) {

                arr[i] = cloneDeep(objectToClone[i], seen);
            }
            return arr;
        }

        if (objectToClone instanceof Date) {

            const date = new Date(objectToClone.getTime());
            seen.set(objectToClone, date);
            return date;
        }

        if (objectToClone instanceof RegExp) {

            const regExp = new RegExp(objectToClone.source, objectToClone.flags);
            seen.set(objectToClone, regExp);
            return regExp;
        }

        if (objectToClone instanceof Map) {

            const map = new Map();
            seen.set(objectToClone, map);
            objectToClone.forEach((value, key) => map.set(cloneDeep(key, seen), cloneDeep(value, seen)));
            return map;
        }

        if (objectToClone instanceof Set) {

            const set = new Set();
            seen.set(objectToClone, set);
            objectToClone.forEach(value => set.add(cloneDeep(value, seen)));
            return set;
        }

        // A typed array owns its bytes, so a copy of them is the clone.
        if (ArrayBuffer.isView(objectToClone) && typeof objectToClone.set === "function") {

            const view = new objectToClone.constructor(objectToClone.length);
            view.set(objectToClone);
            seen.set(objectToClone, view);
            return view;
        }

        // Anything that isn't a plain object - a DOM node, a class instance - is left as it is,
        // rather than being rebuilt as a lookalike that has lost its prototype.
        if (!isPlainObject(objectToClone)) return objectToClone;

        const clone = {};
        seen.set(objectToClone, clone);
        const keys = Object.keys(objectToClone);

        for (let i = 0; i < keys.length; i++) {

            clone[keys[i]] = cloneDeep(objectToClone[keys[i]], seen);
        }
        return clone;
    };

    /**
     * Deep clones an object, including only its values.  Functions are not preserved.
     * @param {Object} objectToClone - The object to clone.
     * @returns {Object} The cloned object with values only.
     */
    const clone = (objectToClone) => {

        if (objectToClone == null) return objectToClone;
        return JSON.parse(JSON.stringify(objectToClone));
    };

    /**
     * Clones an object to the specified depth.  Nested objects and arrays are cloned up to the
     * given depth.  Optimized for TabularData structure which has ColumnModels, RowModels, and
     * other properties that can be selectively cloned.
     * @param {Object} objectToClone - The object to clone.
     * @param {number} depth - The depth to which to clone nested objects and arrays.
     * @returns {Object} The partially deep-cloned object.
     */
    const cloneTabularData = (objectToClone, depth) => {

        if (objectToClone == null) return objectToClone;
        if (depth === 0) return objectToClone;

        const clone = {};
        const keys = Object.keys(objectToClone);
        const nextDepth = depth - 1;

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];
            const val = objectToClone[key];

            // Primitives, and arrays at the final depth - a row's CV - are handled inline, as this
            // runs for every row.
            if (!val || typeof val !== "object") {
                clone[key] = val;
            }
            else if (nextDepth === 0 && Array.isArray(val)) {

                clone[key] = val.slice();
            }
            else {

                clone[key] = cloneTabularValue(val, nextDepth);
            }
        }
        return clone;
    };

    /**
     * Clones one value of a tabular data model for cloneTabularData.  An array's items are cloned
     * to the same depth as the array itself.
     * @param {*}      val   - The value to clone.
     * @param {number} depth - The depth to which to clone it; 0 gives arrays a new wrapper only.
     * @returns {*} The cloned value.
     */
    const cloneTabularValue = (val, depth) => {

        if (!val || typeof val !== "object") return val;

        if (Array.isArray(val)) {

            if (depth === 0) return val.slice();

            const arr = new Array(val.length);

            for (let j = 0; j < val.length; j++) {

                const item = val[j];

                // An object item - a row - is cloned directly, as this runs for every row.
                if (!item || typeof item !== "object") {
                    arr[j] = item;
                }
                else if (!Array.isArray(item) && !ArrayBuffer.isView(item) &&
                    !(item instanceof Date)) {

                    arr[j] = cloneTabularData(item, depth);
                }
                else {

                    arr[j] = cloneTabularValue(item, depth);
                }
            }
            return arr;
        }

        // A row's CV may be a fixed-length view onto a shared buffer (from a worker parse), which a
        // transformer inserting a column cannot splice, so it becomes a plain array here.
        if (ArrayBuffer.isView(val) && !(val instanceof DataView)) return Array.from(val);

        // Objects at the final depth, and anything that isn't a plain object, are referenced.
        if (depth === 0 || !isPlainObject(val)) return val;

        return cloneTabularData(val, depth);
    };

    /**
     * Returns a value indicating whether the first items of the array include an object with the
     * same contents as the given object.
     * @param {Array}  array  - The array to search.
     * @param {number} length - The number of items, from the start, to search.
     * @param {Object} obj    - The object to find.
     * @returns {boolean} True if an equal object is found, false otherwise.
     */
    const containsEqualObject = (array, length, obj) => {

        for (let i = 0; i < length; i++) {

            const item = array[i];
            if (item && typeof item === "object" && !areDifferent(item, obj)) return true;
        }
        return false;
    };

    /**
     * Copies one property from source to target, for syncObject and mergeObject.  Plain objects
     * are copied property by property; other objects, such as Dates, are copied by reference.
     * @param {string}  key          - The property key being copied.
     * @param {*}       s            - The source value (source[key]).
     * @param {Object}  target       - The target object.
     * @param {boolean} clearArrays  - When true (syncObject), existing target arrays are cleared
     *                                 before copying.  When false (mergeObject), values are
     *                                 appended to any existing array, unless it already holds an
     *                                 equal value.
     */
    const copyProperty = (key, s, target, clearArrays) => {

        if (isPlainObject(s)) {

            // A primitive or an array is replaced, as the source's properties can't be copied onto
            // it.
            const t = target[key];
            if (!t || typeof t !== "object" || Array.isArray(t)) target[key] = {};
            copyProperties(s, target[key], null, clearArrays);
        }
        else if (Array.isArray(s)) {

            // An array shared by source and target already matches, and clearing it (or appending
            // it to itself) would empty it (or never finish).
            if (target[key] === s) return;

            if (!Array.isArray(target[key])) {
                target[key] = [];
            }
            else if (clearArrays) {

                target[key].length = 0;
            }

            const targetArray = target[key];
            const originalLength = targetArray.length;

            // Values already held are skipped, so merging the same source again changes nothing.
            // Only the original values are checked, so the source's own repeats are kept.
            const originalValues = originalLength > 0 ? new Set(targetArray) : null;

            // Use a loop to avoid stack overflow for large arrays.
            for (let i = 0; i < s.length; i++) {

                const value = s[i];

                if (originalValues && (originalValues.has(value) ||
                    (value && typeof value === "object" &&
                        containsEqualObject(targetArray, originalLength, value)))) {

                    continue;
                }
                targetArray.push(value);
            }
        }
        else if (typeof s !== "function") {

            target[key] = s;
        }
    };

    /**
     * Shared inner loop for syncObject and mergeObject.  Copies the properties of source to
     * target, recursing into nested objects in the same mode.
     * @param {Object}          source       - The source object.
     * @param {Object}          target       - The target object to update.
     * @param {string|string[]} fieldsToSkip - Top-level fields to skip.
     * @param {boolean}         clearArrays  - See copyProperty.
     */
    const copyProperties = (source, target, fieldsToSkip, clearArrays) => {

        if (source === target) return;

        for (let key in source) {

            if (fieldsToSkip && (fieldsToSkip === key || (Array.isArray(fieldsToSkip) && fieldsToSkip.includes(key)))) continue;
            copyProperty(key, source[key], target, clearArrays);
        }
    };

    /**
     * Updates the properties of the target object to match the source object, skipping specified
     * fields.
     * @param {Object} source - The source object.
     * @param {Object} target - The target object to update.
     * @param {string|string[]} fieldsToSkip - Fields to skip during synchronization.
     */
    const syncObject = (source, target, fieldsToSkip) => {

        copyProperties(source, target, fieldsToSkip, true);
    };

    /**
     * Merges the properties of the source object into the target object, skipping specified
     * fields.  Array values are appended, including in nested objects, apart from any the target
     * array already holds, so merging the same source twice has no further effect.
     * @param {Object} source - The source object.
     * @param {Object} target - The target object to update.
     * @param {string|string[]} fieldsToSkip - Fields to skip during merging.
     */
    const mergeObject = (source, target, fieldsToSkip) => {

        copyProperties(source, target, fieldsToSkip, false);
    };

    /**
     * Determines whether two objects are different in terms of their contents.
     * @param {*} object1 - The first object to compare.
     * @param {*} object2 - The second object to compare.
     * @returns {boolean} True if the objects are different, false otherwise.
     */
    const areDifferent = (object1, object2) => {

        if (object1 === object2) return false;
        if (typeof object1 !== typeof object2) return true;
        if (object1 == null || object2 == null) return object1 !== object2;

        if (Array.isArray(object1) !== Array.isArray(object2)) return true;

        // A Date has no own keys to compare, so its time is compared instead.
        if (object1 instanceof Date || object2 instanceof Date) {

            return !(object1 instanceof Date && object2 instanceof Date) ||
                object1.getTime() !== object2.getTime();
        }

        if (Array.isArray(object1)) {

            if (object1.length !== object2.length) return true;

            for (let i = 0; i < object1.length; i++) {

                if (areDifferent(object1[i], object2[i])) return true;
            }
            return false;
        }

        if (typeof object1 === "object" && typeof object2 === "object") {

            const keys1 = Object.keys(object1);
            const keys2 = Object.keys(object2);
            if (keys1.length !== keys2.length) return true;

            for (let i = 0; i < keys1.length; i++) {

                const key = keys1[i];
                if (!Object.prototype.hasOwnProperty.call(object2, key) || areDifferent(object1[key], object2[key])) return true;
            }
            return false;
        }
        return object1 !== object2;
    };

    /**
     * Determines whether two objects are the same in terms of their contents.  Uses JSON.stringify
     * for comparison.
     * @param {*} object1 - The first object to compare.
     * @param {*} object2 - The second object to compare.
     * @returns {boolean} True if the objects are the same, false otherwise.
     */
    const areSame = (object1, object2) => {

        if (object1 === object2) return true;
        return JSON.stringify(object1) === JSON.stringify(object2);
    };

    /**
     * Returns a value indicating whether the key names one of the enum's values, rather than one
     * of its helpers (Names, Values, AsString etc.) or an inherited property.
     * @param {Object} enumType - The enum type object.
     * @param {string} key - The key to check.
     * @returns {boolean} True if the key names an enum value, false otherwise.
     */
    const isEnumMember = (enumType, key) => {

        if (!Object.prototype.hasOwnProperty.call(enumType, key)) return false;
        const value = enumType[key];
        return value !== null && typeof value !== "object" && typeof value !== "function";
    };

    /**
     * Gets the enum key (string) for the given enum value (number or string).
     * @param {Object} enumType - The enum type object.
     * @param {string|number} enumValue - The enum value to look up.
     * @param {Object} [defaultValue] - The default value to use if not found.
     * @returns {string|null} The enum key, or null if not found.
     */
    const getEnumKey = (enumType, enumValue, defaultValue) => {

        if (typeof enumValue === "string" && isEnumMember(enumType, enumValue)) return enumValue;

        for (let key in enumType) {

            if (isEnumMember(enumType, key) && enumType[key] === enumValue) return key;
        }

        if (defaultValue !== undefined) return getEnumKey(enumType, defaultValue);
        if (enumType.Default !== undefined) return getEnumKey(enumType, enumType.Default);
        return null;
    };

    /**
     * Gets the enum value (number) for the given enum key (string).  A value of the enum is
     * returned as it is.
     * @param {Object} enumType - The enum type object.
     * @param {string|number} enumKey - The enum key to look up.
     * @param {number} [defaultValue] - The default value to use if not found.
     * @returns {number|null} The enum value, or null if not found.
     */
    const getEnumValue = (enumType, enumKey, defaultValue) => {

        if (enumKey != null && enumKey !== "") {

            if (typeof enumKey === "string" && isEnumMember(enumType, enumKey)) {
                return enumType[enumKey];
            }

            // A value of the enum, rather than a key.
            for (let key in enumType) {

                if (isEnumMember(enumType, key) && enumType[key] === enumKey) return enumKey;
            }
        }

        if (defaultValue !== undefined) return defaultValue;
        if (enumType.Default !== undefined) return enumType.Default;
        return null;
    };

    /**
     * Returns a value indicating whether the value is a non-null object (arrays included).
     * @param {*} value - The value to check.
     * @returns {boolean} True if the value is a non-null object, false otherwise.
     */
    const isObject = (value) => {

        return !!value && typeof value === "object";
    };

    /**
     * Returns a value indicating whether the object is empty (i.e. has no own properties).
     * @param {Object} obj - The object to check.
     * @returns {boolean} True if the object is empty, false otherwise.
     */
    const isEmptyObject = (obj) => {

        for (let _ in obj) return false;
        return true;
    };

    /**
     * Recursively deletes all properties that are empty plain objects, but not empty arrays, nor
     * Dates, Maps etc., which have no own keys however much they hold.
     * @param {Object} obj - The object to clean.
     */
    const deleteAllEmptyObjects = (obj) => {

        for (let key in obj) {

            const val = obj[key];

            if (isPlainObject(val)) {

                deleteAllEmptyObjects(val);

                if (Object.keys(val).length === 0) delete obj[key];
            }
        }
    };

    /**
     * Recursively deletes all properties that are empty plain objects or arrays containing only
     * null or undefined values.  Does not remove empty arrays.
     * @param {Object} obj - The object to clean.
     */
    const deleteEmptyObjectsAndArraysContainingOnlyNullOrUndefined = (obj) => {

        for (let key in obj) {

            let val = obj[key];

            if (val == null) { delete obj[key]; continue; }

            if (val && typeof val === "object") {

                if (Array.isArray(val)) {

                    if (val.length === 0) continue;
                    if (!val.some(item => item != null)) delete obj[key];
                }
                else if (isPlainObject(val)) {

                    deleteEmptyObjectsAndArraysContainingOnlyNullOrUndefined(val);
                    if (Object.keys(val).length === 0) delete obj[key];
                }
            }
        }
    };

    /**
     * Applies default options to an object, setting any undefined properties to default values.
     * @param {Object} options - The options object to update.
     * @param {Object} defaults - The default values to apply.
     */
    const applyDefaultOptions = (options, defaults) => {

        for (let key in defaults) if (options[key] === undefined) options[key] = defaults[key];
    };

    /**
     * Adds the key/value pairs from the source object to the target object.  Throws an error if any
     * of the keys already exist in the target object.
     * @param {Object} source - The source object.
     * @param {Object} target - The target object to update.
     */
    const addProperties = (source, target) => {

        for (let key in source) {

            if (Object.prototype.hasOwnProperty.call(target, key)) {
                throw new Error("Key already exists: " + key);
            }
            target[key] = source[key];
        }
    };

    /**
     * Finds the key of an object, matching case-insensitively.  Prefers an exact match if possible.
     * @param {Object} obj - The object to search.
     * @param {string} key - The key to find.
     * @returns {string|null} The matching key, or null if not found.
     */
    const findKeyCaseInsensitively = (obj, key) => {

        if (obj.hasOwnProperty(key)) return key;
        const lower = key.toLowerCase();
        for (let objKey in obj) if (objKey.toLowerCase() === lower) return objKey;
        return null;
    };

    /**
     * Converts all keys in the object to camelCase and returns the resulting object.
     * @param {Object} obj - The object whose keys to convert.
     * @returns {Object} A new object with camelCase keys.
     */
    const makeKeysCamelCase = (obj) => {

        const newObj = {};
        for (let key in obj) newObj[Ren.TextUtils.convertToCamelCase(key)] = obj[key];
        return newObj;
    };

    /**
     * Recursively removes all properties with the specified name from the object.
     * @param {Object} obj - The object to update.
     * @param {string} property - The property name to remove.
     */
    const recursivelyRemoveProperty = (obj, property) => {

        if (obj.hasOwnProperty(property)) delete obj[property];

        for (let key in obj) {

            const val = obj[key];
            if (val && typeof val === "object") recursivelyRemoveProperty(val, property);
        }
    };

    /**
     * Recursively removes all properties from the object, including arrays and nested objects.
     * @param {Object} obj - The object to update.
     */
    const recursivelyRemoveAllProperties = (obj) => {

        for (let key in obj) {

            const val = obj[key];

            if (Array.isArray(val)) {
                delete obj[key];
            }
            else if (val && typeof val === "object") {

                recursivelyRemoveAllProperties(val);
            }
            else {

                delete obj[key];
            }
        }
    };

    /**
     * Recursively replaces the value of a property in an object with a new value.
     * @param {Object} obj - The object to update.
     * @param {string} property - The property name to replace.
     * @param {*} newValue - The new value to set.
     */
    const recursivelyReplaceProperty = (obj, property, newValue) => {

        if (obj.hasOwnProperty(property)) obj[property] = newValue;

        for (let key in obj) {

            const val = obj[key];
            if (val && typeof val === "object") recursivelyReplaceProperty(val, property, newValue);
        }
    };

    /**
     * Recursively finds all objects containing the specified property key.
     * @param {Object} obj - The object to search.
     * @param {string} key - The property key to find.
     * @returns {Object[]} An array of objects containing the property key.
     */
    const recursivelyFindProperties = (obj, key) => {

        let results = [];
        if (obj.hasOwnProperty(key)) results.push(obj);

        for (let prop in obj) {

            const val = obj[prop];
            if (val && typeof val === "object") results = results.concat(recursivelyFindProperties(val, key));
        }
        return results;
    };

    /**
     * Returns a copy of the object with all keys sorted in alphabetical order, recursively up to
     * the specified depth.
     * @param {Object} obj - The object to sort.
     * @param {number} depth - The depth to which to sort the keys.  0 means no sorting, 1 means
     * only sort the top-level keys, and so on.
     * @returns {Object} The sorted object.
     */
    const doSortKeys = (obj, depth) => {

        if (depth === 0) return obj;
        if (depth === undefined) depth = 999;
        if (Array.isArray(obj)) return obj.map(item => doSortKeys(item, depth - 1));

        if (typeof obj === "object" && obj !== null) {

            const keys = Object.keys(obj).sort();
            const result = {};

            for (let i = 0; i < keys.length; i++) {

                const key = keys[i];
                result[key] = doSortKeys(obj[key], depth - 1);
            }
            return result;
        }
        return obj;
    };

    /**
     * Returns a copy of the object with all keys sorted in alphabetical order, recursively up to
     * the specified depth.  Optionally puts specified keys first.
     * @param {Object} obj - The object to sort.
     * @param {number} depth - The depth to which to sort the keys.
     * @param {string|string[]} keysToPutFirst - Keys to put first in the sorted object.
     * @returns {Object} The sorted object with specified keys first.
     */
    const sortKeys = (obj, depth, keysToPutFirst) => {

        obj = doSortKeys(obj, depth);
        keysToPutFirst = Ren.ArrayUtils.ensureArray(keysToPutFirst);

        for (let i = keysToPutFirst.length - 1; i >= 0; i--) {

            const key = keysToPutFirst[i];

            if (obj.hasOwnProperty(key)) {

                const value = obj[key];
                delete obj[key];
                const newObj = {};
                newObj[key] = value;
                for (let k in obj) newObj[k] = obj[k];
                obj = newObj;
            }
        }
        return obj;
    };

    /**
     * Inserts a key at the start of an object, shifting all other keys to the right.  Updates the
     * object in place.
     * @param {Object} obj - The object to update.
     * @param {string} key - The key to insert at the start.
     * @param {*} value - The value to assign to the key.
     * @returns {Object} The updated object with the key inserted at the start.
     */
    const insertKeyAtStart = (obj, key, value) => {

        const entries = Object.entries(obj);

        for (let i = 0; i < entries.length; i++) {

            if (entries[i][0] === key) { entries.splice(i, 1); break; }
        }

        for (let k in obj) delete obj[k];
        obj[key] = value;
        for (let i = 0; i < entries.length; i++) obj[entries[i][0]] = entries[i][1];
        return obj;
    };

    return {
        addProperties,
        applyDefaultOptions,
        areDifferent,
        areSame,
        clone,
        cloneDeep,
        cloneTabularData,
        deleteAllEmptyObjects,
        deleteEmptyObjectsAndArraysContainingOnlyNullOrUndefined,
        findKeyCaseInsensitively,
        getEnumKey,
        getEnumValue,
        insertKeyAtStart,
        isEmptyObject,
        isObject,
        makeKeysCamelCase,
        mergeObject,
        recursivelyFindProperties,
        recursivelyRemoveAllProperties,
        recursivelyRemoveProperty,
        recursivelyReplaceProperty,
        sortKeys,
        syncObject
    };
})();
