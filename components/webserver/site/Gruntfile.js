module.exports = function (grunt) {
    grunt.initConfig({
        assets_inline: {
            options: {
                minify: true
            },
            all: {
                files: {
                    "build/index.min.html": "build/index.html"
                }
            }
        },
        cssmin: {
            css: {
                src: 'src/style.css',
                dest: 'build/style.css'
            }
        },
        htmlmin: {
            dist: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                },
                files: {
                    'build/index.html': 'src/index.html',
                }
            }
        }
    });

    // Load required modules
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-assets-inline');

    // Task definitions
    grunt.registerTask('default', ['cssmin', 'htmlmin', 'assets_inline']);
};
