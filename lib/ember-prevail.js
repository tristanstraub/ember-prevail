/* 
 * Copyright (c) 2012 Tristan Straub
 */

(function() {
    var get = Ember.get;
    var set = Ember.set;

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
		this.get('lawnchair').then(function(store) {
		    store.all(function(values) {
			promise.resolve(values.mapProperty('data'));
		    });
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
		played: false,
		objects: {},
		changes: []
	    }
	    this.beginPropertyChanges();
	    this.set('data', data);

	    this.set('adapter', this.get('adapter').create());
	    this.endPropertyChanges();
	},

	commit: function() {
	    var promise = this.flushChanges();
	    promise.then(null, Ember.Prevail.Error);
	    return promise;
	},

	propertyChanged: function(ob, key, value) {
	    if (this.get('remember')) {
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

		this.rememberChange(change);
	    }
	},

	playbackChange: function(change) {
	    try {
		var store = this;
		store.mustRememberChanges(false);

		if (change.changeType === 'create') {
		    console.log(change.objectType);
		    var type = get(this, change.objectType, false) || get(Ember.lookup, change.objectType);
		    var ob = type.create(change.properties);
		    ob.set('id', change.objectId);

		    this.rememberObject(ob);
		} else if (change.changeType === 'set') {
		    this.getObject(change.objectId).set(change.key, change.value);
		} 

		store.mustRememberChanges(true);
	    } catch(e) {
		Ember.Prevail.Error(e);
	    }
	},

	playbackChanges: function() {
	    var store = this;
	    return withPromise(function(promise) {
		console.log(store.get('adapter'));
		store.get('adapter').getChangeSets().then(function(changesets) {
		    changesets.forEach(function(changeset) {
			changeset.changes.forEach(function(change) {
			    store.playbackChange(change);
			});
		    });
		    promise.resolve();
		});

		return promise;
	    });
	},

	remember: true,

	mustRememberChanges: function(remember)  {
	    this.set('remember', remember);
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

	rememberChange: function(change) {
	    var data = this.get('data');
	    data.changes.pushObject(change);
	},
	
	rememberObject: function(ob) {
	    var data = this.get('data');
	    data.objects[ob.get('id')] = ob;
	},

	getObject: function(id) {
	    return this.get('data').objects[id];
	},

	createRecord: function(type, hash) {
	    var objectId = Prevail.newId();
	    var ob = type.create({store: this, id: objectId});

	    var change = {
		// change header
		id: Prevail.newId(),
		changeType: 'create',
		objectType: type.toString(),
		// change payload
		objectId: objectId,
		properties: Ember.copy(hash)
	    };

	    if (this.get('remember')) {
		this.rememberChange(change);
	    }

	    this.rememberObject(ob);
	    
	    ob.setProperties(hash);
	    return ob;
	},

	deleteRecord: function(record) {
	    this.get('data').objects.removeObject(record);
	    
	},

	all: function() {
	    var store = this;
	    return withPromise(function(promise) {
		var data = store.get('data');
		if (!data.played) {
		    data.played = true;
		    store.playbackChanges().then(function() {
			var obs = data.objects;
			var values = Ember.keys(obs).map(function(key) { return obs[key]; });
			promise.resolve(values);
		    });
		} else {
		    var obs = data.objects;
		    var values = Ember.keys(obs).map(function(key) { return obs[key]; });
		    promise.resolve(values);
		}
	    });
	}.property('all'),

	findAll: function(type) {
	    var obs = Ember.A();
	    this.get('all').then(function(values) {
		values.forEach(function(value) {
		    obs.pushObject(value);
		});
	    });
	    return obs;
	}.observes('all')
    });
})();
