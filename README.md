``ember-prevail`` implements object prevalence on top of emberjs. Data changes are persisted as sequental changes to the object graph. When an ember-prevail store is initialized, all changes are played back, starting with an empty object graph.

The object model supports attributes and collections for primitive types, and reference types, along with backreferences.

Id's are automatically generated and are unique among all objects, not just objects of a particular type.

The collection of all objects can be referenced for queries, and will notify observers when records are added or removed.

Support will be added for the following:

1. Snapshots for faster loading.
2. Schema changes will be saved as changes along with data changes.
3. Branching and merging of data for long or separate transactions.

Create a namespace for holding the model, if you aren't storing it directly in ``App``, like ember-data demonstrates:

```javascript
var Model = Ember.Namespace.create({toString: function() { return "Model"; }});
```

Create your model classes with attributes, and collections along with back references for your collections:

```javascript
var PR = Ember.Prevail;
Model.Tree = PR.Model.extend({
    apples: PR.collection({backreference:'tree'})
});

Model.Apple = PR.Model.extend({
    tree: PR.attr({backreference:'apples'})
});
```

Hook up the store, using lawnchair as a backend:

```javascript
var store = Ember.Prevail.Store.create({
    adapter: Ember.Prevail.LawnchairAdapter.extend({
        dbName: 'test'
    })
});
```

The following actions will be execute sequentially by using promises.

```javascript
// use a precreated promise that has already been resolved
var promise = Ember.Prevail.resolved; 

// create some cheeky globals for keeping context within our promises.
var tree;
```

Create a tree:

```javascript
promise = promise.then(function() {
    return store.createRecord(Model.Tree);
}).then(function(record) { 
    tree = record;
});
```

Add an apple:

```javascript
promise = promise.then(function() {
    return store.createRecord(Model.Apple);
}).then(function(record) {
    tree.get('apples').addObject(record);
});
```

Find all trees:

```javascript
promise = promise.then(function() {
    return store.findAll(Model.Tree);
}).then(function(trees) {
    // do something with the trees
});
```

Send everything to permanent storage:

```javascript
promise = promise.then(function() {
    return store.commit();
}).then(function() {
    alert('Hooray for saving the apples and trees!');
});
```



