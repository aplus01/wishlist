/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId('pbc_items');

    // Make child field optional
    const childField = collection.schema.getFieldById('grgcpyjf');
    if (childField) {
      childField.required = false;
      collection.schema.addField(childField);
    }

    // Add parent field
    collection.schema.addField(
      new SchemaField({
        system: false,
        id: 'parent_fld',
        name: 'parent',
        type: 'relation',
        required: false,
        presentable: false,
        unique: false,
        options: {
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: null,
        },
      })
    );

    return dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId('pbc_items');

    // Remove parent field
    collection.schema.removeField('parent_fld');

    // Make child field required again
    const childField = collection.schema.getFieldById('grgcpyjf');
    if (childField) {
      childField.required = true;
      collection.schema.addField(childField);
    }

    return dao.saveCollection(collection);
  }
);
