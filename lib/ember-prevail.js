/* 
 * Copyright (c) 2012 Tristan Straub
 */

// TODO
// deletions must update related objects

(function() {
    var get = Ember.get;
    var set = Ember.set;

    var log = function() { console.log.apply(console, arguments); };

    Ember.Prevail = Ember.Namespace.extend();
    var Prevail = Ember.Prevail;

    Prevail.Error = function(e) {
	log(e + '; ' + Ember.inspect(e));
	throw e;
    };

    Prevail.Adapter = Ember.Object.extend({
	storeChangeSet: Ember.K,
	getChangeSets: Ember.K,
	clear: Ember.K
    });

    Prevail.zip = function() {
	var args = Array.prototype.slice.call(arguments);
	var collections = args;
	var maxlength = collections.reduce(function(a,b) {
	    return Math.max(a.length, b.length);
	});
	var output = Ember.A();

	for(var i = 0; i < maxlength; i++) {
	    var values = collections.map(function(collection) {
		return collection.objectAt(i);
	    });
	    output.pushObject(values);
	}

	return output;
    };

    var withPromise = function(fn, binding) {
	var promise = Ember.makePromise();
	promise.then(null, Prevail.Error);
	return fn.call(binding, promise) || promise;
    };

    Prevail.toCollection = function(promise) {
	var array = Ember.ArrayProxy.create({});
	promise.then(function(values) {
	    array.set('content', values);
	});
	return array;
    };

    Prevail.LawnchairAdapter = Prevail.Adapter.extend({
	dbName: 'prevail',

	lawnchair: null,

	adapter: 'dom',

	init: function() {
	    var promise = Ember.makePromise();
	    Lawnchair({adapter: this.get('adapter'), name:this.get('dbName')}, function(store) {
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

    Prevail.attr = function(options) {
	var meta = {
	    isArray: false,
	    options: options || {},
	    enableBackreferences: true
	};

	return Ember.computed(function(key, value) {
	    if (arguments.length > 1) {
		this.propertySet(key, value);
	    }

	    return value;
	}).meta(meta);
    };

    Prevail.array = function(options) {
	var meta = {
	    isArray: true,
	    options: options || {},
	    enableBackreferences: true
	};    	

	return Ember.computed(function(key, value) {
	    var model = this;

	    if (!value) {
		value = Ember.A();
		value.addArrayObserver(Ember.Object.create({
		    arrayWillChange: function(content, start, removeCount, addCount) {
			model.arrayWillChange(key, content, start, removeCount, addCount);
		    },

		    arrayDidChange: function(content, start, removeCount, addCount) {
			model.arrayDidChange(key, content, start, removeCount, addCount);
		    }
		}));
	    }
	    
    	    return value;
    	}).meta(meta);
    };

    Prevail.Model = Ember.Object.extend({
	propertySet: function(key, value) {
	    var store = this.get('store');

	    store.propertySet(this, key, value);
	},

	arrayWillChange: Ember.K,

	arrayDidChange: function(key, collection, start, removeCount, addCount) {
	    var store = this.get('store');

	    store.arrayDidChange(this, key, collection, start, removeCount, addCount);
	},
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
	    var store = this;
	    return this.ensurePlayedback().then(function() {
		hash = hash || {};
		var ob = type.create({store: store, id: hash.id || id || Prevail.newId()});

		if (store.get('remember')) {
		    var change = {
			// change header
			id: Prevail.newId(),
			changeType: 'create',
			objectType: type.toString(),
			// change payload
			objectId: ob.get('id'),
			properties: Ember.copy(hash)
		    };

		    store.rememberChange(change);
		}

		store.rememberObject(ob);
		
		var remember = store.get('remember');
		store.set('remember', false);
		ob.setProperties(hash);
		store.set('remember', remember);

		return ob;
	    });
	},

	deleteRecord: function(ob) {
	    var store = this;
	    return this.ensurePlayedback().then(function() {
		var change = {
		    // change header
		    id: Prevail.newId(),
		    changeType: 'delete',
		    objectType: ob.constructor.toString(),
		    // change payload
		    objectId: ob.get('id')
		};

		if (store.get('remember')) {
		    store.rememberChange(change);
		}

		store.forgetObject(ob);
	    });
	},

	find: function(id) {
	    return this.getObject(id);
	},

	findAll: function(type) {
	    var store = this;
	    var findAllCache = this.get('data').queries.findAll;
	    var obs = findAllCache[type.toString()];

	    if (!obs) {
		obs = findAllCache[type.toString()] = Ember.A();
	    }

	    return this.get('all').then(function(values) {
		obs.clear();
		values.forEach(function(value) {
		    if (type.detectInstance(value)) {
			obs.pushObject(value);
		    }
		});

		try {
		    store.notifyPropertyChange('data');
		} catch(e) { Prevail.Error(e); }

		return obs;
	    });
	},

	clear: function() {
	    var store = this;
	    return this.get('adapter').clear()
		.then(function() { store.initialize(); });
	},

	/*
	  Private
	*/

	ensurePlayedback: function() {
	    var store = this;
	    return withPromise(function(promise) {
		var data = store.get('data');
		if (!data.played) {
		    data.played = true;
		    return store.playbackChanges();
		} else {
		    promise.resolve();
		}
	    });
	},

	all: function() {
	    var data = this.get('data');
	    return this.ensurePlayedback().then(function() {
		var obs = data.objects;
		return Ember.keys(obs).map(function(key) { return obs[key]; });
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

	propertySet: function(ob, key, value) {
	    this.updateBackreference(ob, key, value);

	    if (this.get('remember')) {
		var valueIsId = Prevail.Model.detectInstance(value);

		var data = this.get('data');

		var change = {
		    // change header
		    id: Prevail.newId(),
		    changeType: 'set',
		    // change payload
		    objectId: ob.get('id'),
		    key: key,
		    value: (valueIsId ? value.get('id') : value),
		    valueIsId: valueIsId
		};

		this.rememberChange(change);
	    }
	},

	updateBackreference: function(ob, key, value) {
	    var valueIsId = Prevail.Model.detectInstance(value);
	    
	    var metaParent = ob.constructor.metaForProperty(key);
	    var childAttribute = metaParent.options.backreference;

	    if (metaParent.enableBackreferences) {
		if (valueIsId && childAttribute) {
		    var metaChild = value.constructor.metaForProperty(childAttribute);
		    metaParent.enableBackreferences = false;
		    if (metaChild.isArray) {
			value.get(childAttribute).pushObject(ob);
		    } else {
			value.set(childAttribute, ob);
		    }
		    metaParent.enableBackreferences = true;
		}
	    }
	},

	arrayDidChange: function(ob, key, collection, start, removeCount, addCount) {
	    var store = this;
	    if (this.get('remember') && (removeCount || addCount)) {
		var data = this.get('data');

		var values = collection.slice(start, start + addCount);
		var valuesAreIds = values.map(function(value) { 
		    return Prevail.Model.detectInstance(value); 
		});

		values.forEach(function(value) {
		    store.updateBackreference(ob, key, value);
		});

		values = values.map(function(value) {
		    if (Prevail.Model.detectInstance(value)) {
			return value.get('id');
		    } else {
			return value;
		    }
		});

		var change = {
		    // change header
		    id: Prevail.newId(),
		    changeType: 'slice',
		    // change payload
		    objectId: ob.get('id'),
		    key: key,
		    start: start,
		    removeCount: removeCount,
		    values: values,
		    valuesAreIds: valuesAreIds
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
			if (change.valueIsId) {
			    return store.getObject(change.value).then(function(child) {
				ob.set(change.key, child);
			    });
			} else {
			    ob.set(change.key, change.value);
			}
		    });
	    } else if (change.changeType === 'slice') {
		return store.getObject(change.objectId)
		    .then(function(ob) {
			var array = ob.get(change.key);

			if (change.removeCount) {
			    array.removeAt(change.start, change.removeCount);
			}
			
			Prevail.zip(change.valuesAreIds, change.values)
			    .forEach(function(valueIsId_value) {
				var valueIsId = valueIsId_value.objectAt(0);
				var value = valueIsId_value.objectAt(1);
				
				if (valueIsId) {
				    return store.getObject(value).then(function(child) {
					array.pushObject(child);
				    });
				} else {
				    array.pushObject(value);
				}
			    });
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
		Prevail.Error(e);
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
	    var store = this;
	    return this.ensurePlayedback().then(function() {
		return store.get('data').objects[id];
	    });
	}
    });
})();
