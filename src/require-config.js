require.config({
    shim: {
        'ember': {
            deps: ['jquery','handlebars'],
            exports: 'Ember'
        },

        'lawnchair': {
            exports: 'Lawnchair'
        },

        'handlebars': {
            deps: ['jquery'],
            exports: 'Handlebars'
        },

        'rsvp': {
            exports: 'RSVP'
        },

        'uuid': {
            exports: 'UUIDjs'
        }
    },

    paths: {
        'sweet'                        : '../vendor/sweet/src/sweet',
        'sweeten'                      : '../vendor/require-sweet/src/sweeten',
        'underscore'                   : '../vendor/sweet/browser/scripts/underscore',
        'jquery'                       :'../lib/jquery-1.8.3.min',
        'handlebars'                   :'../lib/handlebars-1.0.rc.1',
        'ember'                        :'../lib/ember',
        'lawnchair'                    :'../lib/lawnchair-0.6.1',
        'uuid'                         :'../lib/uuid',
        'rsvp'                         :'../lib/rsvp',
        'ember-prevail'                :'../src/ember-prevail'
    }  
});
