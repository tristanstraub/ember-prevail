/* 
 * Copyright (c) 2012 Tristan Straub
 */

(function() {
    var get = Ember.get;
    var set = Ember.set;

    var log = function() { console.log.apply(console, arguments); };

    Ember.Prevail = Ember.Namespace.extend();
    var Prevail = Ember.Prevail;

    Ember.Prevail.Error = function(e) {
	log(e + '; ' + Ember.inspect(e));
	throw e;
    };

    Ember.Prevail.Adapter = Ember.Object.extend({
	storeChangeSet: Ember.K,
	getChangeSets: Ember.K,
	clear: Ember.K
    });

    var withPromise = function(fn, binding) {
	var promise = Ember.makePromise();
	promise.then(null, Ember.Prevail.Error);
	return fn.call(binding, promise) || promise;
    };

    Ember.Prevail.toCollection = function(promise) {
	var array = Ember.ArrayProxy.create({});
	promise.then(function(values) {
	    array.set('content', values);
	});
	return array;
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

	clear: function() {
	    return this.get('lawnchair').then(function(store) {
		return withPromise(function(promise) {
		    store.nuke(function() {
			promise.resolve();
		    });
		});
	    });
	},

	storeChangeSet: function(changeset) {
	    return this.get('lawnchair').then(function(store) {
		return withPromise(function(promise) {
		    store.save({key: changeset.id, data: changeset}, function() {
			promise.resolve();
		    });
		});
	    });
	},

	getChangeSets: function() {
	    return this.get('lawnchair').then(function(store) {
		return withPromise(function(promise) {
		    store.all(function(values) {
			promise.resolve(values.mapProperty('data'));
		    });
		});
	    });
	}	    
    });

    Prevail.attr = function(type) {
	var meta = {
	    type: type,
	    isAttribute: true
	};

	return Ember.computed(function(key, value) {
	    if (arguments.length > 1) {
		this.setProperty(key, value);
	    } else {

	    }

	    return value;
	}).property('data').meta(meta);
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
	types: null,

	remember: true,

	init: function() {
	    this.set('types', {});
	    this.initialize();
	},

	registerTypes: function(types) {
	    types.forEach(function(type) {
		this.get('types')[type.toString()] = type;
	    }, this);
	},

	commit: function() {
	    return this.flushChanges();
	},

	createRecord: function(type, hash, id) {
	    return withPromise(function(promise) {
		hash = hash || {};
		var ob = type.create({store: this, id: hash.id || id || Prevail.newId()});

		if (this.get('remember')) {
		    var change = {
			// change header
			id: Prevail.newId(),
			changeType: 'create',
			objectType: type.toString(),
			// change payload
			objectId: ob.get('id'),
			properties: Ember.copy(hash)
		    };

		    this.rememberChange(change);
		}

		this.rememberObject(ob);
		
		ob.setProperties(hash);
		promise.resolve(ob);
	    }, this);
	},

	deleteRecord: function(ob) {
	    return withPromise(function(promise) {
		var change = {
		    // change header
		    id: Prevail.newId(),
		    changeType: 'delete',
		    objectType: ob.constructor.toString(),
		    // change payload
		    objectId: ob.get('id')
		};

		if (this.get('remember')) {
		    this.rememberChange(change);
		}

		this.forgetObject(ob);

		promise.resolve();
	    }, this);
	},

	findAll: function(type) {
	    var store = this;
	    return withPromise(function(promise) {
		var findAllCache = this.get('data').queries.findAll;
		var obs = findAllCache[type.toString()];

		if (!obs) {
		    obs = findAllCache[type.toString()] = Ember.A();
		}

		this.get('all').then(function(values) {
		    obs.clear();
		    values.forEach(function(value) {
			obs.pushObject(value);
		    });

		    try {
			store.notifyPropertyChange('data');
		    } catch(e) { Ember.Prevail.Error(e); }

		    promise.resolve(obs);
		});
	    }, this);
	},

	clear: function() {
	    var store = this;
	    return this.get('adapter').clear()
		.then(function() { store.initialize(); });
	},

	/*
	  Private
	*/

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
	}.property('data'),

	initialize: function() {
	    return withPromise(function(promise) {
		// destroy existing items when initialize called twice?
		var data = {
		    played: false,
		    objects: {},
		    changes: [],
		    previousChangesetId: null,
		    queries: {
			findAll: {}
		    }
		}
		this.beginPropertyChanges();
		if (this.get('adapter').create) {
		    this.set('adapter', this.get('adapter').create());
		}
		this.set('data', data);
		this.endPropertyChanges();
		promise.resolve();
	    }, this);
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
	    var store = this;
	    var type;
	    
	    if (change.changeType === 'create') {
		type = this.get('types')[change.objectType];//get(store, change.objectType, false) || get(Ember.lookup, change.objectType);
		Ember.assert('type must exist', !!type);
		return store.createRecord(type, change.properties, change.objectId);
	    } else if (change.changeType === 'set') {
		return store.getObject(change.objectId)
		    .then(function(ob) {
			ob.set(change.key, change.value);
		    });
	    } else if (change.changeType === 'delete') {
		return store.getObject(change.objectId)
		    .then(function(ob) {
			return store.forgetObject(ob);
		    });
	    } else {
		throw new Exception("Unknown change type:" + change.changeType);
	    }
	},

	sortChangesets: function(changesets) {
	    var index = {};
	    var nexts = {};
	    var roots = [];

	    // index changesets
	    changesets.forEach(function(changeset) {
		nexts[changeset.id] = nexts[changeset.id] || [];
		index[changeset.id] = changeset;

		if (changeset.previousChangesetIds) {
		    changeset.previousChangesetIds.forEach(function(id) {
			Ember.assert("previous changeset id cannot be false", !!id);

			nexts[id] = nexts[id] || [];
			nexts[id].pushObject(changeset.id);
		    });
		}

		if (!changeset.previousChangesetIds) {
		    roots.pushObject(changeset.id);
		}
	    });

	    Ember.assert("only one or no roots", roots.length <= 1);

//	    Ember.assert("nexts must have same amount", Ember.keys(nexts).length === changesets.length);
	    //	    Ember.assert("stop", false);

	    var sortedChangesetIds = [];
	    var traversed = {};
	    var isReached = function(id) { 
		return traversed[id];
	    };

	    var traverse = function(current) {
		if (!isReached(current) && (!index[current].previousChangesetIds || index[current].previousChangesetIds.every(isReached))) {
		    traversed[current] = true;
		    sortedChangesetIds.pushObject(current);

		    if (nexts[current]) {
			nexts[current].forEach(traverse);
		    }
		} else {
		}
	    };

	    roots.forEach(traverse);

	    Ember.assert('sorted out == in', sortedChangesetIds.length === changesets.length);

	    return sortedChangesetIds.map(function(id) { return index[id]; });
	},

	playbackChanges: function() {
	    var store = this;
	    store.mustRememberChanges(false);

	    return store.get('adapter').getChangeSets().then(function(changesets) {
		var sorted = store.sortChangesets(changesets);
		Ember.assert("changesets must be equal", changesets.length === sorted.length);

		var promise = Ember.makePromise();
		promise.resolve();

		sorted.forEach(function(changeset) {
		    changeset.changes.forEach(function(change) {
			promise = promise.then(function() { 
			    return store.playbackChange(change); });
		    });
		});

		if (changesets.length > 0) {
		    store.get('data').previousChangesetId = sorted[sorted.length-1].id;
		} else {
		    store.get('data').previousChangesetId = null;
		}

		return promise;
	    }).then(function() {
		store.mustRememberChanges(true);
	    }, function(e) {
		store.mustRememberChanges(true);
		Ember.Prevail.Error(e);
	    });
	},

	// TODO - this should actually be wrapped up in a context/branch? See playbackChanges to understand.
	mustRememberChanges: function(remember)  {
	    this.set('remember', remember);
	},

	flushChanges: function() {
	    return withPromise(function(promise) {
		var data = this.get('data');
		if (data.changes.length > 0) {
		    var changeset = {
			id: Prevail.newId(),
			previousChangesetIds: data.previousChangesetId && [data.previousChangesetId],
			// this should be windowed for when storeChangeSet fails
			changes: data.changes
		    };

		    data.previousChangesetId = changeset.id;
		    data.changes = [];
		    this.notifyPropertyChange('data');

		    return this.get('adapter').storeChangeSet(changeset);
		} else {
		    promise.resolve();
		}
	    }, this);
	},

	rememberChange: function(change) {
	    Ember.assert("can't remember change while remember is false", this.get('remember'));
	    var data = this.get('data');
	    data.changes.pushObject(change);
	    this.notifyPropertyChange('data');
	},
	
	rememberObject: function(ob) {
	    var data = this.get('data');
	    data.objects[ob.get('id')] = ob;

	    var findAllCache = data.queries.findAll[ob.constructor.toString()];
	    if (findAllCache) {
		findAllCache.pushObject(ob);
	    }

	    this.notifyPropertyChange('data');
	},

	forgetObject: function(ob) {
	    var data = this.get('data');
	    delete data.objects[ob.get('id')];
	    
	    data.queries.findAll[ob.constructor.toString()].removeObject(ob);
	    
	    this.notifyPropertyChange('data');
	},

	getObject: function(id) {
	    return withPromise(function(promise) {
		promise.resolve(this.get('data').objects[id]);
	    }, this);
	}
    });
})();
