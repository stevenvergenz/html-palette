var fs = require('fs'),
	libpath = require('path');

module.exports = function(grunt)
{
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		sass: {
			dist: {
				options: {
					style: 'compressed',
					loadPath: libpath.join(__dirname, 'src'),
					sourcemap: 'none'
				},
				files: {
					'build/palette.css': ['src/palette.scss']
				}
			}
		},
		template: {
			processRoot: {
				options: {
					data: function(){
						return {
							widgetTemplate: fs.readFileSync(libpath.join(__dirname, 'src/widget.html'), {encoding:'utf8'}).replace(/\n/g,'\\n'),
							vertShader: fs.readFileSync(libpath.join(__dirname, 'src/vertShader.glsl'), {encoding:'utf8'}).replace(/\n/g,'\\n'),
							fragShader: fs.readFileSync(libpath.join(__dirname, 'src/fragShader.glsl'), {encoding:'utf8'}).replace(/\n/g,'\\n'),
							styles: fs.readFileSync(libpath.join(__dirname, 'build/palette.css'), {encoding:'utf8'}).replace(/\n/g,'\\n')
						};
					}
				},
				files: {
					'build/html-palette.js': ['src/palette.js']
				}
			}
		},
		uglify: {
			processRoot: {
				options: {
					screwIE8: true,
					banner: '/* <%= pkg.name %> v<%= pkg.version %> - built on <%= grunt.template.today("yyyy-mm-dd") %> */\n'
				},
				files: {
					'build/html-palette.min.js': ['build/html-palette.js']
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-sass');
	grunt.loadNpmTasks('grunt-template');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.registerTask('default', ['sass', 'template', 'uglify']);
};
