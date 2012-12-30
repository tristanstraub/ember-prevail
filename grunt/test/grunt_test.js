/*global QUnit:false, module:false, test:false, asyncTest:false, expect:false*/
/*global start:false, stop:false ok:false, equal:false, notEqual:false, deepEqual:false*/
/*global notDeepEqual:false, strictEqual:false, notStrictEqual:false, raises:false*/
(function() {
    // namespace for models, so that Type.toString() returns a qualified name.
    Test = Ember.Namespace.create();

    QUnit.config.testTimeout = 2000;
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
		adapter: Ember.Prevail.LawnchairAdapter
	    });

	    stop();
	    this.store.clear()
		.then(start);
	},

	teardown: function() {
	}
    });

    var log = function() { console.log.apply(console, arguments); };

    test('getChangesets has no changesets', 1, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({});
	store.registerTypes([Test.Item]);

	stop();
	this.store.get('adapter').getChangeSets()
	    .then(function(changesets) {
		strictEqual(changesets.length, 0, "changesets.length should be 0");
	    })
	    .then(start);
    });

    test('findall has no items', 1, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({});
	store.registerTypes([Test.Item]);

	stop();
	this.store.findAll(Test.Item)
	    .then(function(items) {
		strictEqual(items.length, 0, "items.length should be 0");
	    })
	    .then(start);
    });

    test('create record, commit, has one changeset', 1, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({});
	store.registerTypes([Test.Item]);

	stop();
	this.store.createRecord(Test.Item)
	    .then(function() { return store.commit(); })
	    .then(function(ob) { return store.get('adapter').getChangeSets();
	    })
	    .then(function(changesets) {
		strictEqual(changesets.length, 1, "changesets.length should be 1");
	    })
	    .then(start);
    });

    test('create record with name "test", commit, re-initialize, getChangeSets returns one changeset', 1, function() {
	var store = this.store;
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
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create record, commit, re-initialize, findAll returns one item', 1, function() {
	var store = this.store;
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
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create a records, change name to "test", commit, findAll, returns one item with name "test"', 2, function() {
	var store = this.store;
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
		strictEqual(items.objectAt(0).get('name'), "test", "'test' as name");
	    })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, number of changesets equals 2', 1, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({
	    name: Ember.Prevail.attr('string')
	});
	store.registerTypes([Test.Item]);

	stop();
	store.createRecord(Test.Item, { name: "(unnamed)" })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { items.objectAt(0).set('name', "(unnamed)q"); })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function(ob) { return store.get('adapter').getChangeSets();
	    })
	    .then(function(changesets) {
		strictEqual(changesets.length, 2, "changesets.length should be 2");
	    })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, findAll, returns one item with name "(unnamed)q"', 2, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({
	    name: Ember.Prevail.attr('string')
	});
	store.registerTypes([Test.Item]);

	stop();
	store.createRecord(Test.Item, { name: "(unnamed)" })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { items.objectAt(0).set('name', "(unnamed)q"); })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) {
		strictEqual(items.length, 1, "1 played back item");
		strictEqual(items.objectAt(0).get('name'), "(unnamed)q", "'(unnamed)q' as name");
	    })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create record with name "test", commit, findAll, delete item', 0, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({});
	store.registerTypes([Test.Item]);

	stop();
	this.store.createRecord(Test.Item, { name: "test" })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { return store.deleteRecord(items.objectAt(0)); })
	    .then(function() { return store.commit(); })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create record with name "test", commit, findAll, delete item, findAll returns zero items', 1, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({});
	store.registerTypes([Test.Item]);

	stop();
	this.store.createRecord(Test.Item, { name: "test" })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { return store.deleteRecord(items.objectAt(0)); })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) {
		strictEqual(items.length, 0, "0 played back item");
	    })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

    test('create a record with name "(unnamed)", commit, reinitialize, findAll, change name to "(unnamed)q", commit, reinitialize, findAll, returns one item with name "(unnamed)q, findAll, deleteItem, commit, findAll returns 0 items"', 3, function() {
	var store = this.store;
	Test.Item = Ember.Prevail.Model.extend({
	    name: Ember.Prevail.attr('string')
	});
	store.registerTypes([Test.Item]);

	stop();
	store.createRecord(Test.Item, { name: "(unnamed)" })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { items.objectAt(0).set('name', "(unnamed)q"); })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.initialize(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) {
		strictEqual(items.length, 1, "1 played back item");
		strictEqual(items.objectAt(0).get('name'), "(unnamed)q", "'(unnamed)q' as name");
	    })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) { return store.deleteRecord(items.objectAt(0)); })
	    .then(function() { return store.commit(); })
	    .then(function() { return store.findAll(Test.Item); })
	    .then(function(items) {
		strictEqual(items.length, 0, "0 played back item");
	    })
	    .then(start, function(e) {
		log(e);
		throw e;
	    });
    });

}());
