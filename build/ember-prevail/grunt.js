module.exports = function(grunt) {
  var path = require('path');
  var root = path.normalize(__dirname+"/../../tmp/build_master");

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',

    meta: {
      banner: '/*! <%=pkg.name%> - v<%=pkg.version%> (build <%=pkg.build%>) - '+
             '<%=grunt.template.today("dddd, mmmm dS, yyyy, h:MM:ss TT")%> */',
    },

    qunit: {
	files: ['../../tests/**/*.html']
    },

    lint: {
	files: ['../../src/**/*.js', '../../tests/**/*.js']
    },

    dirs: {
      src: root+'/src',
      plugins: root+'/lib/plugins',
      dest: '../../dist/<%=pkg.project%>'
    }
  });

    // Default task only builds your source files
    grunt.registerTask('default', 'lint qunit');
};
