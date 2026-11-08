/**
 * Converts an object where each value is also an object into a Ren tabular data set collection.
 */
Ren.TabularDataAdapter_ObjectOfObjects = (() => {

    const adaptObjectOfObjects = (objectOfObjects, keyFieldName, dataSourceUri, tabularDataTitle) => {

        objectOfObjects = Ren.ObjectUtils.clone(objectOfObjects);

        // Convert the object of objects into an array of objects, where the object keys are added
        // to the objects as a new field.

        const arrayOfObjects = Object.keys(objectOfObjects).map(key => {

            const obj = objectOfObjects[key];
            const newObj = {};
            newObj[keyFieldName] = key; // Add the key field to each object.
            Ren.ObjectUtils.mergeObject(obj, newObj); // Merge the original object into the new
                                                      // object.

            return newObj;
        });

        Ren.ArrayUtils.makeObjectKeysConsistent(arrayOfObjects);

        const tabularDataSetCollection = Ren.DataSourcesAdapter_ArrayOfObjects.adaptArrayOfObjects(
            arrayOfObjects,
            dataSourceUri,
            tabularDataTitle
        );

        if (!tabularDataSetCollection) return null;

        return tabularDataSetCollection;
    };

    return {
        adaptObjectOfObjects
    };
})();
