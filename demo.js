var App = Ember.Application.create({
    Router: Ember.Router.extend({
	root: Ember.Route.extend({
	    index: Ember.Route.extend({
		route: '/',
		connectOutlets: function(router) {
		    router.get('applicationController').connectOutlet('content', 'main', Ember.Prevail.toCollection(App.store.findAll(App.Item)));
		},

		addItem: function(router, event) {
		    App.store.createRecord(App.Item, { name: '(unnamed)' })
			.then(function() { 
			    App.store.commit(); 
			});
		},

		saveItem: function(router, event) {
		    App.store.commit();
		},

		deleteItem: function(router, event) {
		    var item = event.context;
		    App.store.deleteRecord(item)
			.then(function() {
			    App.store.commit();
			});
		},

		clearStore: function(router, event) {
		    App.store.clear();
		}
	    })
	})
    })
});

App.Item = Ember.Prevail.Model.extend({
    name: Ember.Prevail.attr('string'),
    didPropertyChange: function() {
	this.get('store').commit();
    }.observes('name')
});

App.store = Ember.Prevail.Store.create({
    adapter: Ember.Prevail.LawnchairAdapter
});
App.store.registerTypes([App.Item]);

App.ApplicationController = Ember.Controller.extend();
App.ApplicationView = Ember.View.extend({
    templateName: 'application'
});

App.MainController = Ember.Controller.extend();
App.MainView = Ember.View.extend({
    templateName: 'main'
});
