ember-data-lawnchair is an adapter for ember-data for lawnchair.

The following demonstrates its usage:

```javascript
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
			    return App.store.commit(); 
			});
		},

		saveItem: function(router, event) {
		    return App.store.commit();
		},

		deleteItem: function(router, event) {
		    var item = event.context;
		    App.store.deleteRecord(item)
			.then(function() {
			    return App.store.commit();
			});
		},

		clearStore: function(router, event) {
		    return App.store.clear();
		}
	    })
	})
    })
});

App.Item = Ember.Prevail.Model.extend({
    name: Ember.Prevail.attr('string'),
    didPropertyChange: function() {
	return this.get('store').commit();
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
```


```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    
    <script type="text/x-handlebars" data-template-name="application">
      {{outlet content}}
    </script>

    <script type="text/x-handlebars" data-template-name="main">
      <a href="#" {{action clearStore }}>Clear store</a>
      <a href="#" {{action addItem }}>Add Item</a>
      <ul>
	{{#each content}}
	<li>{{this.id}} {{view Ember.TextField valueBinding="name"}}

	[{{name}}]
	{{#if isDirty}}
	<a href="#" {{action saveItem this}}>Save</a>
	{{/if}}
	<a href="#" {{action deleteItem this}}>Delete</a>
	</li>
	{{/each}}
      </ul>
    </script>

    <script type="text/javascript" src="lib/jquery-1.8.3.min.js"></script>
    <script type="text/javascript" src="lib/handlebars-1.0.rc.1.js"></script>
    <script type="text/javascript" src="lib/ember.js"></script>
    <script type="text/javascript" src="lib/lawnchair.js"></script>
    <script type="text/javascript" src="lib/lawnchair-adapter-indexed-db-0.6.1.js"></script>
    <script type="text/javascript" src="dist/ember-prevail.js"></script>
    <script type="text/javascript" src="demo.js"></script>
  </head>
  <body>

  </body>
</html>
```
