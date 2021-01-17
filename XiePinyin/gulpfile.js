/// <binding BeforeBuild='default' Clean='clean' />
var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var livereload = require('gulp-livereload');
var minifyCSS = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var exec = require('child_process').execSync;

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

gulp.task("vue-build", () => {
  return new Promise(function (resolve, reject) {
    exec('yarn vue-build', function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      reject(err);
    });
    resolve();
  });
});

// Browserify scripts
gulp.task('browserify', gulp.series("vue-build", () => {
  var b = browserify({
    entries: ['./client-source/index.js', './client-vue-build/xie-vue-lib.umd.js'],
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
}));

// Delete all compiled and bundled files
gulp.task('clean', function () {
  return del(['./client-build/*.css', './client-vue-build/*.*', './wwwroot/bundle.*']);
});

// Default task: full clean+build.
gulp.task('default', gulp.series('browserify', 'styles', function (done) { done(); }));

// Watch: recompile less on changes
gulp.task('watch', function () {
  livereload.listen(35730);
  gulp.watch(['./client-source/*.less'], gulp.series('styles'));
  gulp.watch(['./client-source/vue-components/*.*'], gulp.series('browserify'));
  gulp.watch(['./client-source/*.js'], gulp.series('browserify'));
});
