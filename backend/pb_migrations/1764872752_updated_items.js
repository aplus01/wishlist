/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pbc_items")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "j48sjbpn",
    "name": "priority",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": true
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pbc_items")

  // remove
  collection.schema.removeField("j48sjbpn")

  return dao.saveCollection(collection)
})
