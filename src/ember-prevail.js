/* 
 * Copyright (c) 2012 Tristan Straub
 */

// TODO
// deletions must update related objects

(function() {
    var get = Ember.get, set = Ember.set;

    var log = function() { console.log.apply(console, arguments); };

    Ember.Prevail = Ember.Namespace.extend();
    var Prevail = Ember.Prevail;

    Prevail.logChanges = false;

    Prevail.resolved = Ember.makePromise();
    Prevail.resolved.resolve();

    var resolved = Prevail.resolved;

    Prevail.Error = function(e) {
        log(e + '; ' + Ember.inspect(e));
        throw e;
    };

    Prevail.Adapter = Ember.Object.extend({
        storeChangeSet: Ember.K,
        getChangeSets: Ember.K,
        clear: Ember.K
    });

    Prevail.slice = function() {
        return Array.prototype.slice.apply(arguments);
    };  

    Prevail.toObject = function(values) {
        var ob = {};
        values.forEach(function(ab) {
            var a = ab[0], b = ab[1];
            ob[a] = b;
        });
        return ob;
    };  

    Prevail.zip = function() {
        var args = Array.prototype.slice.call(arguments);
        var collections = args;
        var maxlength = collections.reduce(function(a,b) {
            return Math.max(a.length, b.length);
        });
        var output = Ember.A();

        var addCollection = function(collection) {
            return collection.objectAt(i);
        };

        for(var i = 0; i < maxlength; i++) {
            var values = collections.map(addCollection);
            output.pushObject(values);
        }

        return output;
    };

    Prevail.logArguments = function(names, values) {
        log(Prevail.toObject(Prevail.zip(names, Prevail.slice(values))));
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
        }).then(null, Prevail.Error);
        return array;
    };

    Prevail.FilteredSet = Ember.Set.extend({
        match: null,

        content: Ember.computed(function(key, value, oldvalue) {
            try {
                if (arguments.length > 1) {
                    if (oldvalue) {
                        oldvalue.removeEnumerableObserver(this);
                    }

                    value.addEnumerableObserver(this);

                    var match = get(this, 'match') || function(){return true;};                    

                    this.addObjects(value.filter(match));
                }

                return value;
            } catch(e) { Ember.Prevail.Error(e); }
        }),

        enumerableWillChange: function(content, removed, added) {
        },
        
        enumerableDidChange: function(content, removed, added) {
            try {
                var match = get(this, 'match') || function(){return true;};

                if (removed) {
                    this.removeObjects(removed.filter(match));
                }

                if (added) {
                    this.addObjects(added.filter(match));
                }
            } catch(e) { Ember.Prevail.Error(e); }
        }
    });

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
            }).then(null, Prevail.Error);
        },

        storeChangeSet: function(changeset) {
            return this.get('lawnchair').then(function(store) {
                return withPromise(function(promise) {
                    store.save({key: changeset.id, data: changeset}, function() {
                        promise.resolve();
                    });
                });
            }).then(null, Prevail.Error);
        },

        getChangeSets: function() {
            return this.get('lawnchair').then(function(store) {
                return withPromise(function(promise) {
                    store.all(function(values) {
                        promise.resolve(values.mapProperty('data'));
                    });
                });
            }).then(null, Prevail.Error);
        }           
    });

    Prevail.attr = function(options) {
        var meta = {
            isAttribute: true,
            isArray: false,
            options: options || {},
            enableBackreferences: true
        };

        return Ember.computed(function(key, value, oldvalue) {
            if (arguments.length > 1) {
                this.propertySet(key, value, oldvalue);
            }

            return value;
        }).meta(meta);
    };

    Prevail.collection = function(options) {
        var meta = {
            isAttribute: true,
            isArray: true,
            options: options || {},
            enableBackreferences: true
        };      

        return Ember.computed(function(key, value) {
            var model = this;

            if (!value) {
                value = Ember.Set.create();
                value.addEnumerableObserver(Ember.Object.create({
                    enumerableWillChange: function(content, removed, added) {
                        model.enumerableWillChange(key, content, removed, added);
                    },

                    enumerableDidChange: function(content, removed, added) {
                        model.enumerableDidChange(key, content, removed, added);
                    }
                }));
            }
            
            return value;
        }).meta(meta);
    };

    Prevail.Model = Ember.Object.extend({
        _foreign_references_: null,
        _foreign_collections_: null,

        init: function() {
            this.set('_foreign_references_', Ember.Set.create());
            this.set('_foreign_collections_', Ember.Set.create());
        },

        eachForeign: function(fn, collection) {
            collection.forEach(function(parent_key) {
                try {
                    var leftIndex = parent_key.indexOf('_');
                    var parent = parent_key.slice(0, leftIndex);
                    var key = parent_key.slice(leftIndex + 1, parent_key.length);
                    fn.call(this, parent, key);
                } catch(e) { Ember.Prevail.Error(e); }
            });
        },

        eachForeignReference: function(fn) {
            this.eachForeign(fn, this.get('_foreign_references_'));
        },

        eachForeignCollection: function(fn) {
            this.eachForeign(fn, this.get('_foreign_collections_'));
        },

        addForeignReference: function(parent, key) {
            var refs = this.get('_foreign_references_');
            refs.addObject(parent.get('id') + "_" + key);
        },

        addForeignCollection: function(parent, key) {
            var refs = this.get('_foreign_collections_');
            refs.addObject(parent.get('id') + "_" + key);
        },

        removeForeignReference: function(parent, key) {
            var refs = this.get('_foreign_references_');
            refs.removeObject(parent.get('id') + "_" + key);
        },

        removeForeignCollection: function(parent, key) {
            var refs = this.get('_foreign_collections_');
            refs.removeObject(parent.get('id') + "_" + key);
        },

        propertySet: function(key, value, oldvalue) {
            var store = this.get('store');
            store.propertySet(this, key, value, oldvalue);
        },

        enumerableWillChange: function(key, collection, removed, added) {
            var store = this.get('store');
            store.enumerableWillChange(this, key, collection, removed, added);
        },

        enumerableDidChange: function(key, collection, removed, added) {
            var store = this.get('store');
            store.enumerableDidChange(this, key, collection, removed, added);
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
            var store = this;
            return this.ensurePlayedback().then(function() {
                hash = hash || {};
                var ob = type.create({store: store, id: hash.id || id || Prevail.newId()});

                store.rememberObject(ob);

                // TODO -- remember should a stack
                var remember = store.get('remember');
                store.set('remember', false);
                ob.setProperties(hash);
                store.set('remember', remember);

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

                return ob;
            }).then(null, Prevail.Error);
        },

        deleteRecord: function(ob) {
            var store = this;
            return this.ensurePlayedback().then(function() {
                var promise = Ember.Prevail.resolved;

                ob.eachForeignReference(function(parentId, key) {
                    promise = promise
                        .then(function() {
                            return store.find(parentId);
                        })
                        .then(function(parent) {
                            Ember.assert("foreign reference is same object", parent.get(key) === ob);
                            parent.set(key, null);
                        })
                        .then(null, Ember.Prevail.Error);
                });
                
                ob.eachForeignCollection(function(parentId, key) {
                    promise = promise
                        .then(function() {
                            return store.find(parentId);
                        })
                        .then(function(parent) {
                            return parent.get(key).removeObject(ob);
                        });
                });

                store.forgetObject(ob);
                
                if (store.get('remember')) {
                    var change = {
                        // change header
                        id: Prevail.newId(),
                        changeType: 'delete',
                        objectType: ob.constructor.toString(),
                        // change payload
                        objectId: ob.get('id')
                    };

                    store.rememberChange(change);
                }

                return promise;
            }).then(null, Prevail.Error);
        },

        find: function(type, id) {
            return this.getObject.apply(this, arguments);
        },

        findAll: function(type) {
            var store = this;
            var data = this.get('data');
                
            return this.ensurePlayedback().then(function() {
                var coll = Prevail.FilteredSet.create({
                    match: function(ob) { return type.detectInstance(ob); }
                });

                set(coll, 'content', data.objects);
                
                return coll;
            }).then(null, Prevail.Error);
        },

        clear: function() {
            var store = this;
            return this.get('adapter').clear()
                .then(function() { store.initialize(); })
                .then(null, Prevail.Error);
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
            }).then(null, Prevail.Error);
        },

        initialize: function() {
            return withPromise(function(promise) {
                // destroy existing items when initialize called twice?
                var data = {
                    played: false,
                    objects: Ember.Set.create(),
                    objectsIndex: {},
                    changes: [],
                    previousChangesetId: null
                };

                this.beginPropertyChanges();
                if (this.get('adapter').create) {
                    this.set('adapter', this.get('adapter').create());
                }
                this.set('data', data);
                this.endPropertyChanges();
                promise.resolve();
            }, this).then(null, Prevail.Error);
        },

        propertySet: function(ob, key, value, oldvalue) {
            var data = this.get('data');

            // assume <ensurePlayedback>, because ob exists from createRecord, or being loaded
            Ember.assert("Has been played back", data.played);

            var metaParent = ob.constructor.metaForProperty(key);
            Ember.assert("Cannot set collection of model", !metaParent.isArray);

            if (value) {
                this.addBackreference(ob, key, value);
            }

            if (oldvalue) {
                this.removeBackreference(ob, key, oldvalue);
            }

            if (this.get('remember')) {
                var valueIsId = Prevail.Model.detectInstance(value);

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

        dontRemember: function(fn) {
            var remember = this.get('remember');
            this.mustRememberChanges(false);
            fn();
            this.mustRememberChanges(remember);
        },

        addBackreference: function(ob, key, value) {
            this.dontRemember(function() {
                var valueIsId = Prevail.Model.detectInstance(value);
                
                var metaParent = ob.constructor.metaForProperty(key);
                var childAttribute = metaParent.options.backreference;

                if (valueIsId) {
                    if (metaParent.isArray) {
                        value.addForeignCollection(ob, key);
                    } else {
                        value.addForeignReference(ob, key);
                    }
                }

                if (metaParent.enableBackreferences) {
                    if (valueIsId && childAttribute) {
                        var metaChild = value.constructor.metaForProperty(childAttribute);
                        metaParent.enableBackreferences = false;
                        if (metaChild.isArray) {
                            value.get(childAttribute).addObject(ob);
                        } else {
                            value.set(childAttribute, ob);
                        }
                        metaParent.enableBackreferences = true;
                    }
                }
            });
        },

        removeBackreference: function(ob, key, value) {
            this.dontRemember(function() {
                var valueIsId = Prevail.Model.detectInstance(value);
                
                var metaParent = ob.constructor.metaForProperty(key);
                var childAttribute = metaParent.options.backreference;

                if (valueIsId) {
                    if (metaParent.isArray) {
                        value.removeForeignCollection(ob, key);
                    } else {
                        value.removeForeignReference(ob, key);
                    }
                }

                if (metaParent.enableBackreferences) {
                    if (valueIsId && childAttribute) {
                        var metaChild = value.constructor.metaForProperty(childAttribute);
                        metaParent.enableBackreferences = false;
                        if (metaChild.isArray) {
                            ob.removeForeignCollection(value, childAttribute);
                            value.get(childAttribute).removeObject(ob);
                        } else {
                            ob.removeForeignReference(value, childAttribute);
                            value.set(childAttribute, null);
                        }
                        metaParent.enableBackreferences = true;
                    }
                }
            });
        },

        enumerableWillChange: function(ob, key, collection, removed, added) {
        },

        enumerableDidChange: function(ob, key, collection, removed, added) {
            var data = this.get('data');

            // assume <ensurePlayedback>, because ob exists from createRecord, or being loaded
            Ember.assert("Has been played back", data.played);

            // Prevail.logArguments(['ob','key','collection','removed','added'], arguments);

            // Set.clear   -> (removed == len,   added == 0)
            // Set.added   -> (removed == null,  added == [obj])
            // Set.removed -> (removed == [obj], added == null)
            if ("number" === typeof removed) { removed = collection; added = []; }
            else if (null === removed)       { removed = [];                     }
            else                             {                       added = []; }

            var store = this;
            added.forEach(function(value) {
                store.addBackreference(ob, key, value);
            });

            removed.forEach(function(value) {
                store.removeBackreference(ob, key, value);
            });

            if (this.get('remember') && (removed || added)) {
                var detectModel = function(value) { return Prevail.Model.detectInstance(value); };
                var extractId = function(value) { return detectModel(value) ? value.get('id') : value; };

                var change = {
                    // change header
                    id: Prevail.newId(),
                    changeType: 'slice',
                    // change payload
                    objectId: ob.get('id'),
                    key: key,
                    removed: removed.map(extractId),
                    removedAreIds: removed.map(detectModel),
                    added: added.map(extractId),
                    addedAreIds: added.map(detectModel)
                };

                this.rememberChange(change);
            }       
        },

        playbackChange: function(change) {
            if (Prevail.logChanges) {
                log('playbackChange:');
                log(change);
            }

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
                    }).then(null, Prevail.Error);
            } else if (change.changeType === 'slice') {
                return store.getObject(change.objectId)
                    .then(function(ob) {
                        var collection = ob.get(change.key);

                        var promise = Prevail.resolved;

                        Prevail.zip(change.removedAreIds, change.removed)
                            .forEach(function(valueIsId_value) {
                                var valueIsId = valueIsId_value.objectAt(0);
                                var value = valueIsId_value.objectAt(1);
                                
                                if (valueIsId) {
                                    promise = promise.then(function() {
                                        return store.getObject(value).then(function(child) {
                                            collection.removeObject(child);
                                        });
                                    });
                                } else {
                                    collection.removeObject(value);
                                }
                            });

                        Prevail.zip(change.addedAreIds, change.added)
                            .forEach(function(valueIsId_value) {
                                var valueIsId = valueIsId_value.objectAt(0);
                                var value = valueIsId_value.objectAt(1);
                                
                                if (valueIsId) {
                                    promise = promise.then(function() {
                                        return store.getObject(value).then(function(child) {
                                            collection.addObject(child);
                                        });
                                    });
                                } else {
                                    collection.addObject(value);
                                }
                            });

                        return promise;
                    }).then(null, Prevail.Error);
            } else if (change.changeType === 'delete') {
                return store.getObject(change.objectId)
                    .then(function(ob) {
                        return store.deleteRecord(ob);
                    }).then(null, Prevail.Error);
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
            }).then(null, Prevail.Error);
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
            }, this).then(null, Prevail.Error);
        },

        rememberChange: function(change) {
            if (Prevail.logChanges) {
                log('rememberChange:');
                log(change);
            }

            Ember.assert("can't remember change while remember is false", this.get('remember'));
            var data = this.get('data');
            data.changes.pushObject(change);
            this.notifyPropertyChange('data');
        },
        
        rememberObject: function(ob) {
            var data = this.get('data');
            data.objectsIndex[ob.get('id')] = ob;
            data.objects.addObject(ob);

            this.notifyPropertyChange('data');
        },

        forgetObject: function(ob) {
            var data = this.get('data');
            delete data.objectsIndex[ob.get('id')];
            data.objects.removeObject(ob);
            
            this.notifyPropertyChange('data');
        },

        getObject: function(type, id) {
            if (arguments.length == 1) { id = type; type = null; }
            var store = this;
            return this.ensurePlayedback().then(function() {
                var ob = store.get('data').objectsIndex[id];
                if (type) {
                    if (type.detectInstance && type.detectInstance(ob)) {
                        return ob;
                    } else {
                        throw "type can't detect instance";
                    }
                } else {
                    return ob;
                }
                return null;
            }).then(null, Prevail.Error);
        }
    });
})();
