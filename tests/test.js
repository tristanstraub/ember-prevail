/*global QUnit:false, module:false, test:false, asyncTest:false, expect:false*/
/*global start:false, stop:false ok:false, equal:false, notEqual:false, deepEqual:false*/
/*global notDeepEqual:false, strictEqual:false, notStrictEqual:false, raises:false*/
(function() {
    // namespace for models, so that Type.toString() returns a qualified name.
    QUnit.config.testTimeout = 500;

    var resolved = Ember.Prevail.resolved;

    var complete = function(store) {
        return function() { 
            return resolved.then(function() { return store.commit(); })
                .then(function() { return store.initialize(); })
                .then(function() { return store.ensurePlayedback(); })
                .then(start, function(e) {
                    log(e);
                    throw e;
                });
        };
    };

    /*
      ======== A Handy Little QUnit Reference ========
      http://docs.jquery.com/QUnit

      Test methods:
      expect(numAssertions)
      stop(increment)
      start(decrement)
      Test assertions:
      ok(value, [message])
      equal(actual, expected, [message])
      notEqual(actual, expected, [message])
      deepEqual(actual, expected, [message])
      notDeepEqual(actual, expected, [message])
      strictEqual(actual, expected, [message])
      notStrictEqual(actual, expected, [message])
      raises(block, [expected], [message])
    */
    module('ember-prevail', {
        setup: function() {
            this.store = Ember.Prevail.Store.create({
                adapter: Ember.Prevail.LawnchairAdapter.extend({
                    dbName: 'test'
                })
            });

            stop();
            this.store.clear()
                .then(complete(this.store));
        },

        teardown: function() {
        }
    });

    var log = function() { console.log.apply(console, arguments); };
    var get = Ember.get;

    test('zip', 1, function() {
        var values = Ember.Prevail.zip([1,2],[3,4]);
        deepEqual(values, [[1,3],[2,4]], "zipped");
    });

    test('ensure playedback', 0, function() {
        var store = this.store;

        stop();
        this.store.ensurePlayedback().then(complete(store));
    });

    test('Model namespace functions', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});

        strictEqual(Test.Item.toString(), "Test.Item", "correct class name");
    });

    test('ensure playedback after creating a record', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.ensurePlayedback()
            .then(function() { return store.createRecord(Test.Item, { name: "test" }); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.ensurePlayedback(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 1, "has one item");
            })
            .then(complete(store));
    });

    test('ensure playedback after creating a record with child and backreference', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({backreference:'parent'}),
            parent: Ember.Prevail.attr({backreference:'child'})
        });
        store.registerTypes([Test.Item]);

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                return store.createRecord(Test.Item, { child: item }); 
            })
            .then(function(parent) {
                equal(get(parent, 'child.parent'), parent, "has parent");
            })
            .then(complete(store));
    });

    test('getChangesets has no changesets', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.get('adapter').getChangeSets()
            .then(function(changesets) {
                strictEqual(changesets.length, 0, "changesets.length should be 0");
            })
            .then(complete(store));
    });

    test('findall has no items', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.findAll(Test.Item)
            .then(function(items) {
                strictEqual(items.length, 0, "items.length should be 0");
            })
            .then(complete(store));
    });

    test('create record, commit, has one changeset, with one change', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item)
            .then(function() { return store.commit(); })
            .then(function(ob) { return store.get('adapter').getChangeSets();
                               })
            .then(function(changesets) {
                strictEqual(changesets.length, 1, "changesets.length should be 1");
                strictEqual(changesets.objectAt(0).changes.length, 1, "changesets[0].changes.length should be 1");
            })
            .then(complete(store));
    });

    test('create record with name, commit, has one changeset, with one change', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr()
        });

        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item, { name: 'test' })
            .then(function() { return store.commit(); })
            .then(function(ob) { return store.get('adapter').getChangeSets();
                               })
            .then(function(changesets) {
                strictEqual(changesets.length, 1, "changesets.length should be 1");
                strictEqual(changesets.objectAt(0).changes.length, 1, "changesets[0].changes.length should be 1");
            })
            .then(complete(store));
    });

    test('create record with name "test", commit, re-initialize, getChangeSets returns one changeset', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item, { name: "test" })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function(ob) { return store.get('adapter').getChangeSets();})
            .then(function(changesets) {
                equal(changesets.length, 1, "changesets.length should be 1");
            })
            .then(complete(store));
    });

    test('create record, commit, re-initialize, findAll returns one item', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item)
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 1, "1 played back item");
            }).then(start, function(e) {
                log(e);
                throw e;
            });
    });

    test('create 2 records, commit, re-initialize, findAll, re-initialize, findAll returns two items', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        store.createRecord(Test.Item)
            .then(function() { return store.createRecord(Test.Item); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 2, "2 played back item");
            })
            .then(complete(store));
    });

    test('create a records, change name to "test", commit, findAll, returns one item with name "test"', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr('string')
        });
        store.registerTypes([Test.Item]);

        stop();
        store.createRecord(Test.Item)
            .then(function(ob) { return store.commit().then(function() { return ob; }); })
            .then(function(ob) { ob.set('name', 'test'); return store.commit(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 1, "1 played back item");
                strictEqual(get(items, 'firstObject').get('name'), "test", "'test' as name");
            })
            .then(complete(store));
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, number of changesets equals 2', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr('string')
        });
        store.registerTypes([Test.Item]);

        stop();
        store.createRecord(Test.Item, { name: "(unnamed)" })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { get(items, 'firstObject').set('name', "(unnamed)q"); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function(ob) { return store.get('adapter').getChangeSets();
                               })
            .then(function(changesets) {
                strictEqual(changesets.length, 2, "changesets.length should be 2");
            })
            .then(complete(store));
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, findAll, returns one item with name "(unnamed)q"', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr('string')
        });
        store.registerTypes([Test.Item]);

        stop();
        store.createRecord(Test.Item, { name: "(unnamed)" })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { get(items, 'firstObject').set('name', "(unnamed)q"); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 1, "1 played back item");
                strictEqual(get(items, 'firstObject').get('name'), "(unnamed)q", "'(unnamed)q' as name");
            })
            .then(complete(store));
    });

    test('create record with name "test", commit, findAll, delete item', 0, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item, { name: "test" })
            .then(function() { return store.commit(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { return store.deleteRecord(get(items, 'firstObject')); })
            .then(function() { return store.commit(); })
            .then(complete(store));
    });

    test('create record with name "test", commit, findAll, delete item, findAll returns zero items', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({});
        store.registerTypes([Test.Item]);

        stop();
        this.store.createRecord(Test.Item, { name: "test" })
            .then(function() { return store.commit(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { return store.deleteRecord(get(items, 'firstObject')); })
            .then(function() { return store.commit(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 0, "0 played back item");
            })
            .then(complete(store));
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, findAll, returns one item with name "(unnamed)q, findAll, deleteItem, commit, findAll returns 0 items"', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr('string')
        });
        store.registerTypes([Test.Item]);

        stop();
        store.createRecord(Test.Item, { name: "(unnamed)" })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { get(items, 'firstObject').set('name', "(unnamed)q"); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 1, "1 played back item");
                strictEqual(get(items, 'firstObject').get('name'), "(unnamed)q", "'(unnamed)q' as name");
            })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) { return store.deleteRecord(get(items, 'firstObject')); })
            .then(function() { return store.commit(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                strictEqual(items.length, 0, "0 played back item");
            })
            .then(complete(store));
    });


    test('create a record with children, playsback parent and child"', 4, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            child: Ember.Prevail.attr()
        });
        store.registerTypes([Test.Item]);

        stop();
        var parentId;
        store.createRecord(Test.Item, { name: "parent" })
            .then(function(parent) {
                parentId = parent.get('id');
                return parent;
            })
            .then(function(parent) {
                return store.createRecord(Test.Item, { name: "child" })
                    .then(function(child) { parent.set('child', child); });
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.find(parentId); })
            .then(function(parent) {
                ok(parent, 'parent exists');
                ok(parent.get('child'), 'child exists');
                strictEqual(parent.get('name'), 'parent', 'parent has name');
                strictEqual(parent.get('child.name'), 'child', 'child has name');
            })
            .then(complete(store));
    });

    test('create a record with children, returns same collection twice"', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(parent) {
                var c1 = parent.get('children');
                var c2 = parent.get('children');
                strictEqual(c1, c2, "same collection");
            })
            .then(complete(store));
    });

    test('create two record with children, returns different collections"', 1, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parent1;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(ob) { parent1 = ob; return store.createRecord(Test.Item); })
            .then(function(parent2) {
                var c1 = parent1.get('children');
                var c2 = parent2.get('children');
                notEqual(c1, c2, "different collection");
            })
            .then(complete(store));
    });

    test('create record with children, collection has child"', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parent;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(ob) { parent = ob; return store.createRecord(Test.Item); })
            .then(function(child) {
                parent.get('children').addObject(child);
                strictEqual(parent.get('children.length'), 1, "has one child");
                strictEqual(parent.get('children.firstObject'), child, "correct child");
            })
            .then(complete(store));
    });

    test('create a record with a child, should have 3 changes"', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parent;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item, { name: "parent1" }); })
            .then(function(ob) { parent = ob; return store.createRecord(Test.Item, { name: "child1" }); })
            .then(function(child) {
                parent.get('children').addObject(child);
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.get('adapter').getChangeSets(); })
            .then(function(changesets) {
                strictEqual(changesets.length, 1, "changesets.length should be 3");
                strictEqual(changesets.objectAt(0).changes.length, 3, "changesets.length should be 3");
                strictEqual(changesets.objectAt(0).changes.objectAt(2).changeType, 'slice', "array change");
            })
            .then(complete(store));
    });

    test('create a record with children, playsback parent and children"', 6, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parentId1, parentId2;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item, { name: "parent1" }); })
            .then(function(parent1) {
                parentId1 = parent1.get('id');
            })
            .then(function() { return store.createRecord(Test.Item, { name: "parent2" }); })
            .then(function(parent2) {
                parentId2 = parent2.get('id');
            })
            .then(function() {
                return store.createRecord(Test.Item, { name: "child1" });
            })
            .then(function(child1) { 
                return store.find(parentId1)
                    .then(function(parent1) {
                        parent1.get('children').addObject(child1);
                    });
            })
            .then(function() {
                return store.createRecord(Test.Item, { name: "child2" });
            })
            .then(function(child2) { 
                return store.find(parentId2)
                    .then(function(parent2) {
                        parent2.get('children').addObject(child2);
                    });
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.find(parentId1); })
            .then(function(parent1) {
                ok(parent1, 'parent1 exists');
                strictEqual(parent1.get('children.length'), 1, 'child1 exists');
                strictEqual(parent1.get('children.firstObject').get('name'), 'child1', 'child1 has name');
            })
            .then(function() { return store.find(parentId2); })
            .then(function(parent2) {
                ok(parent2, 'parent2 exists');
                strictEqual(parent2.get('children.length'), 1, 'child2 exists');
                strictEqual(parent2.get('children.firstObject').get('name'), 'child2', 'child2 has name');
            })
            .then(complete(store));
    });


    test('create a record with children, remove child, has 4 changes"', 5, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parent;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item, { name: "parent" }); })
            .then(function(ob) { parent = ob; })
            .then(function() { return store.createRecord(Test.Item, { name: "child" }); })
            .then(function(child) {
                parent.get('children').addObject(child);
                parent.get('children').removeObject(child);
                strictEqual(parent.get('children.length'), 0, "no children before commit");
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.get('adapter').getChangeSets(); })
            .then(function(changesets) {
                strictEqual(changesets.length, 1, "changesets.length should be 1");
                strictEqual(changesets.objectAt(0).changes.length, 4, "changesets[0].changes.length should be 4");
                strictEqual(changesets.objectAt(0).changes.objectAt(3).changeType, 'slice', "changesets[0].changes[3] is 'slice'");
                strictEqual(changesets.objectAt(0).changes.objectAt(3).removed.length, 1, "changesets[0].changes[3] is 'slice.remove 1'");
            })
            .then(complete(store));
    });

    test('create a record with children, remove child, get children has none"', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            children: Ember.Prevail.collection()
        });
        store.registerTypes([Test.Item]);

        var parent;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item, { name: "parent" }); })
            .then(function(ob) { parent = ob; })
            .then(function() { return store.createRecord(Test.Item, { name: "child" }); })
            .then(function(child) {
                parent.get('children').addObject(child);
                parent.get('children').removeObject(child);
                strictEqual(parent.get('children.length'), 0, "no children before commit");
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.find(parent.get('id')); })
            .then(function(parent1) {
                ok(parent1, 'parent1 exists');
                strictEqual(parent1.get('children.length'), 0, 'no children after commit');
            })
            .then(complete(store));
    });

    test('create two records of different types, findAll of both types"', 2, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Apple = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr()
        });
        Test.Orange = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr()
        });
        store.registerTypes([Test.Apple, Test.Orange]);

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Apple, { name: "apple" }); })
            .then(function() { return store.createRecord(Test.Orange, { name: "orange" }); })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Apple); })
            .then(function(apples) {
                strictEqual(apples.length, 1, 'one apple');
            })
            .then(function() { return store.findAll(Test.Orange); })
            .then(function(oranges) {
                strictEqual(oranges.length, 1, 'one orange');
            })
            .then(complete(store));
    });

    test('back reference 1 to 1', 5, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            name: Ember.Prevail.attr(),
            child: Ember.Prevail.attr({ backreference: 'parent'}),
            parent: Ember.Prevail.attr({ backreference: 'child'})
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item, { name: "apple" }); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item, { name: "orange" }); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.set('child', child); 
            })
            .then(function(oranges) {
                ok(parent.get('child').get('parent') === parent, 'backreference is set');
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                equal(items.length, 2, "all items");
            })
            .then(function() { return store.find(parentId); })
            .then(function(parent) {
                equal(parent.get('id'), parentId, "parent id matches");
                equal(parent.get('child.id'), childId, "child id matches");
                equal(parent.get('child.parent.id'), parentId, "parent.child.parent id matches");
            })
            .then(complete(store));
    });

    test('back reference n to 1', 5, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject').get('parent') === parent, 'backreference is set');
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                equal(items.length, 2, "all items");
            })
            .then(function() { return store.find(parentId); })
            .then(function(parent) {
                equal(parent.get('id'), parentId, "parent id matches");
                equal(parent.get('children.firstObject').get('id'), childId, "child id matches");
                equal(parent.get('children.firstObject').get('parent.id'), parentId, "parent.children[0].parent id matches");
            })
            .then(complete(store));
    });

    test('back reference n to n', 5, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parents' }),
            parents: Ember.Prevail.collection({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject').get('parents.firstObject') === parent, 'backreference is set');
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.findAll(Test.Item); })
            .then(function(items) {
                equal(items.length, 2, "all items");
            })
            .then(function() { return store.find(parentId); })
            .then(function(parent) {
                equal(parent.get('id'), parentId, "parent id matches");
                equal(parent.get('children.firstObject').get('id'), childId, "child id matches");
                equal(parent.get('children.firstObject').get('parents.firstObject').get('id'), parentId, "parent.children[0].parent id matches");
            })
            .then(complete(store));
    });

    test('back reference n to n with removal', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parents' }),
            parents: Ember.Prevail.collection({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject').get('parents.firstObject') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('children.firstObject');
                equal(child.get('parents.length'), 1, "has parents");
                parent.get('children').removeObject(child);
                equal(child.get('parents.length'), 0, "no parents");
            })
            .then(complete(store));
    });

    test('back reference 1 to 1 with removal', 4, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'child' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.set('child', child);
            })
            .then(function() {
                ok(parent.get('child.parent') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('child');
                equal(parent, child.get('parent'), "correct parent");
                ok(child.get('parent'), "has parent");
                parent.set('child', null);
                ok(!child.get('parent'), "no parent");
            })
            .then(complete(store));
    });

    test('back reference 1 to 1 with overwrite', 6, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'child' })
        });
        store.registerTypes([Test.Item]);

        var parent, child2;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.set('child', child);
                return store.createRecord(Test.Item);
            })
            .then(function(item) {
                child2 = item;
            })
            .then(function() {
                ok(parent.get('child.parent') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('child');
                equal(parent, child.get('parent'), "correct child parent");
                ok(child.get('parent'), "has parent");
                parent.set('child', child2);
                ok(!child.get('parent'), "no child parent");
                ok(child2.get('parent'), "no child2 parent");
                equal(parent, child2.get('parent'), "correct child2 parent");
            })
            .then(complete(store));
    });

    test('back reference n to 1 with overwrite', 5, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({ backreference: 'parents' }),
            parents: Ember.Prevail.collection({ backreference: 'child' })
        });
        store.registerTypes([Test.Item]);

        var parent, child2;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.set('child', child);
                return store.createRecord(Test.Item);
            })
            .then(function(item) {
                child2 = item;
            })
            .then(function() {
                ok(parent.get('child.parents.firstObject') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('child');
                equal(parent, child.get('parents.firstObject'), "correct child parent");
                ok(!child2.get('parent'), "no child2 parent");
                parent.set('child', child2);
                ok(!child.get('parent'), "no child parent");
                equal(parent, child2.get('parents.firstObject'), "correct child2 parent");
            })
            .then(complete(store));
    });

    test('back reference 1 to n with removal', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject.parent') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('children.firstObject');
                ok(child.get('parent'), "has parent");
                parent.get('children').removeObject(child);
                ok(!child.get('parent'), "no parent");
            })
            .then(complete(store));
    });

    test('back reference n to 1 with removal', 3, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({ backreference: 'parents' }),
            parents: Ember.Prevail.collection({ backreference: 'child' })
        });
        store.registerTypes([Test.Item]);

        var parent;
        var parentId, childId;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parentId = item.get('id');
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(child) { 
                childId = child.get('id');
                parent.set('child', child);
            })
            .then(function() {
                ok(parent.get('child.parents.firstObject') === parent, 'backreference is set');
            })
            .then(function() {
                var child = parent.get('child');
                equal(child.get('parents.length'), 1, "has parents");
                parent.set('child', null);
                equal(child.get('parents.length'), 0, "no parents");
            })
            .then(complete(store));
    });

    test('back reference 1 to 1 with deletion', 7, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            child: Ember.Prevail.attr({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'child' })
        });
        store.registerTypes([Test.Item]);

        var parent, child;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(item) { 
                child = item;
                parent.set('child', child);
            })
            .then(function() {
                ok(parent.get('child.parent') === parent, 'backreference is set');
            })
            .then(function() {
                child = parent.get('child');

                // child and parent are defined
                ok(child.get('parent'), "has parent");
                ok(parent.get('child'), "has child");
                
                // bidirectional relationship
                equal(parent, child.get('parent'), "correct parent");
                equal(parent.get('child'), child, "correct child");

                return store.deleteRecord(child);
            })
            .then(function() {
                ok(!child.get('parent'), "has no parent");
                ok(!parent.get('child'), "has no child");
            })
            .then(complete(store));
    });

    test('back reference n to n with deletion', 9, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parents' }),
            parents: Ember.Prevail.collection({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent, child;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(item) { 
                child = item;
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject.parents.firstObject') === parent, 'backreference is set');
            })
            .then(function() {
                child = parent.get('children.firstObject');

                // child and parent are defined
                ok(child.get('parents.firstObject'), "has parent");
                ok(parent.get('children.firstObject'), "has child");
                
                // bidirectional relationship
                equal(parent, child.get('parents.firstObject'), "correct parent");
                equal(parent.get('children.firstObject'), child, "correct child");

                equal(child.get('parents.length'), 1, "has no parents");
                equal(parent.get('children.length'), 1, "has no children");

                return store.deleteRecord(child);
            })
            .then(function() {
                equal(child.get('parents.length'), 0, "has no parents");
                equal(parent.get('children.length'), 0, "has no children");
            })
            .then(complete(store));
    });

    test('back reference 1 to n with deletion', 8, function() {
        var store = this.store;
        var Test = Ember.Namespace.create({ toString: function() { return "Test"; }});
        Test.Item = Ember.Prevail.Model.extend({
            children: Ember.Prevail.collection({ backreference: 'parent' }),
            parent: Ember.Prevail.attr({ backreference: 'children' })
        });
        store.registerTypes([Test.Item]);

        var parent, child;

        stop();
        resolved
            .then(function() { return store.createRecord(Test.Item); })
            .then(function(item) { 
                parent = item; 
                return store.createRecord(Test.Item); 
            })
            .then(function(item) { 
                child = item;
                parent.get('children').addObject(child);
            })
            .then(function() {
                ok(parent.get('children.firstObject.parent') === parent, 'backreference is set');
            })
            .then(function() {
                child = parent.get('children.firstObject');

                // child and parent are defined
                ok(child.get('parent'), "has parent");
                ok(parent.get('children.firstObject'), "has child");
                
                // bidirectional relationship
                equal(parent, child.get('parent'), "correct parent");
                equal(parent.get('children.length'), 1, "has children");
                equal(parent.get('children.firstObject'), child, "correct child");

                return store.deleteRecord(child);
            })
            .then(function() {
                ok(!child.get('parent'), "has no parent");
                equal(parent.get('children.length'), 0, "has no children");
            })
            .then(function() { return store.commit(); })
            .then(function() { return store.initialize(); })
            .then(function() { return store.ensurePlayedback(); })
            .then(complete(store));
    });


    // test('find works with type', 0, function() {});

}());

