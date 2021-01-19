/// <binding BeforeBuild='default' Clean='clean' />
const gulp = require('gulp');
const less = require('gulp-less');
const path = require('path');
const concat = require('gulp-concat');
const plumber = require('gulp-plumber');
const livereload = require('gulp-livereload');
const minifyCSS = require('gulp-minify-css');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const webpack = require('webpack')
const webpackStream = require('webpack-stream')

// Compile all .less files to .css
gulp.task('less', function () {
  return gulp.src('./client-source/*.less')
    .pipe(plumber())
    .pipe(less({
      paths: [path.join(__dirname, 'less', 'includes')]
    }))
    .pipe(gulp.dest('./client-build/'));
});

// Minify and bundle CSS files
gulp.task('styles', gulp.series('less', function () {
  return gulp.src(['./client-build/*.css'])
    //.pipe(minifyCSS())
    .pipe(concat('bundle.css'))
    .pipe(gulp.dest('./wwwroot/'))
    .pipe(livereload());
}));

gulp.task('svelte-pack', function () {
  const mode = process.env.NODE_ENV || 'development';
  return gulp.src('./client-source/svelte-components/svelte-main.js')
    .pipe(webpackStream({
      output: {
        filename: 'bundle-svelte.js'
      },
      module: {
        rules: [
          {
            test: /\.svelte$/,
            exclude: /node_modules/,
            use: 'svelte-loader'
          }
        ]
      },
      mode
    }, webpack))
    .pipe(gulp.dest('./wwwroot/'))
    .pipe(livereload());
});

// Browserify scripts
gulp.task('browserify', () => {
  var b = browserify({
    entries: ['./client-source/index.js'],
    debug: true
  });
  return b.bundle()
    .pipe(source('./bundle.js'))
    .pipe(buffer())
    // .pipe(terser())
    // .on('error', function (err) { gutil.log(gutil.colors.red('[Error]'), err.toString()); })
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./wwwroot/'))
    .pipe(livereload());
});

// Delete all compiled and bundled files
gulp.task('clean', function () {
  return del(['./client-build/*.css', './client-vue-build/*.*', './wwwroot/bundle.*']);
});

// Default task: full clean+build.
gulp.task('default', gulp.series('svelte-pack', 'browserify', 'styles', function (done) { done(); }));

// Watch: recompile less on changes
gulp.task('watch', function () {
  livereload.listen(35730);
  gulp.watch(['./client-source/*.less'], gulp.series('styles'));
  gulp.watch(['./client-source/*.js'], gulp.series('browserify'));
  gulp.watch(['./client-source/svelte-components/*.*'], gulp.series('svelte-pack'));
});
