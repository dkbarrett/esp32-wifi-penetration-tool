module.exports = function (grunt) {
    grunt.initConfig({
        assets_inline: {
            options: {
                minify: true
            },
            all: {
                files: {
                    "dist/index.html": "build/index.html"
                }
            }
        },
        cssmin: {
            css: {
                src: 'src/style.css',
                dest: 'build/style.css'
            }
        },
        htmlmin: {                                     // Task
            dist: {                                      // Target
                options: {                                 // Target options
                    removeComments: true,
                    collapseWhitespace: true
                },
                files: {                                   // Dictionary of files
                    'build/index.html': 'src/index.html',     // 'destination': 'source'
                }
            }
        },
        shell: {
            setup: {
                command: 'mkdir build'
            },
            moveJs: {
                command: 'cp src/*.js build'
            },
            cleanup: {
                command: 'rm -rf build'
            },
            generateInclude: {
                command: 'bash generate_include dist/index.html'
            }
        }
    });

    // Load required modules
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-assets-inline');
    grunt.loadNpmTasks('grunt-shell')

    // Task definitions
    grunt.registerTask('default', [
        'shell:setup',
        'cssmin',
        'htmlmin',
        'shell:moveJs',
        'assets_inline',
        'shell:cleanup',
        'shell:generateInclude'
    ]);
};
