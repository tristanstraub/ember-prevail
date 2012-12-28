(function() {
    Ember.Prevail = Ember.Namespace.extend();
    var Prevail = Ember.Prevail;

    Ember.Prevail.Error = function(e) {
	console.log('error:' + e);
    };

    Ember.Prevail.Adapter = Ember.Object.extend({
	storeChangeSet: Ember.K,
	getChangeSets: Ember.K
    });

    var withPromise = function(fn, binding) {
	var promise = Ember.makePromise();
	fn.call(binding, promise);
	return promise;
    };

    Ember.Prevail.LawnchairAdapter = Ember.Prevail.Adapter.extend({
	dbName: 'prevail',

	lawnchair: null,

	init: function() {
	    var promise = Ember.makePromise();
	    Lawnchair({name:'prevail'}, function(store) {
		promise.resolve(store);
	    });
	    this.set('lawnchair', promise);
	},

	storeChangeSet: function(changeset) {
	    return withPromise(function(promise) {
		this.get('lawnchair').then(function(store) {
		    store.save({key: changeset.id, data: changeset}, function() {
			console.log(changeset.id);
			promise.resolve();
		    });
		});
	    }, this);
	},

	getChangeSets: function() {
	    return withPromise(function(promise) {
		lc.all(function(values) {
		    var changes = values.mapProperty('data');
		    promise.resolve(changes);
		});
	    }, this);
	}	    
    });

    Prevail.attr = function(type) {
	return Ember.computed(function(key, value) {
	    if (arguments.length > 1) {
		this.setProperty(key, value);
	    } else {

	    }

	    return value;
	}).property('_data');
    };

    Prevail.belongsTo = function(type) {
    };

    Prevail.hasMany = function(type) {
    };

    Prevail.Model = Ember.Object.extend({
	setProperty: function(key, value) {
	    var store = this.get('store');

	    store.propertyChanged(this, key, value);
	}
    });

    Prevail.newId = function() {
	return UUIDjs.create().toString();
    };

    Prevail.Store = Ember.Object.extend({
	data: null,

	adapter: null,

	init: function() {
	    var data = {
		items: [],
		changes: []
	    }
	    this.set('data', data);

	    this.set('adapter', this.get('adapter').create());
	},

	commit: function() {
	    var promise = this.flushChanges();
	    promise.then(null, Ember.Prevail.Error);
	    return promise;
	},

	propertyChanged: function(ob, key, value) {
	    var data = this.get('data');

	    var change = {
		// change header
		id: Prevail.newId(),
		changeType: 'set',
		// change payload
		objectId: ob.get('id'),
		key: key,
		value: value
	    };

	    this.pushChange(change);
	},

	flushChanges: function() {
	    var data = this.get('data');
	    var changeset = {
		id: Prevail.newId(),
		// this should be windowed for when storeChangeSet fails
		changes: data.changes
	    };
	    data.changes = [];
	    return this.get('adapter').storeChangeSet(changeset)
		.then(function() { 
		    data.changes = []; 
		});
	},

	pushChange: function(change) {
	    var data = this.get('data');
	    data.changes.pushObject(change);
	},
	
	pushItem: function(item) {
	    var data = this.get('data');
	    data.items.pushObject(item);
	},

	createRecord: function(type, hash) {
	    var itemId = Prevail.newId();
	    var item = type.create({store: this, id: itemId});

	    var change = {
		// change header
		id: Prevail.newId(),
		changeType: 'create',
		// change payload
		objectId: itemId,
		properties: Ember.copy(hash)
	    };
	    this.pushChange(change);
	    this.pushItem(item);

	    item.setProperties(hash);
	    return item;
	},

	deleteRecord: function(record) {
	    this.get('data').items.removeObject(record);
	    
	},

	findAll: function(type) {
	    return this.get('data').items;
	}
    });
})();
