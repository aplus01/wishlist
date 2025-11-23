/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId('pbc_items');

    // Remove old image_url field if it exists
    try {
      collection.schema.removeField('image_url');
    } catch (e) {
      // Field might not exist, that's ok
    }

    // Add new image file field
    collection.schema.addField(
      new SchemaField({
        system: false,
        id: 'img_field',
        name: 'image',
        type: 'file',
        required: false,
        presentable: false,
        unique: false,
        options: {
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'image/svg+xml',
            'image/gif',
            'image/webp',
          ],
          thumbs: ['100x100', '300x300'],
          protected: false,
        },
      })
    );

    return dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId('pbc_items');

    // Remove image field
    collection.schema.removeField('img_field');

    return dao.saveCollection(collection);
  }
);
