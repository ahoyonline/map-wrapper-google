Package.describe({
  name: 'ahoy:map-wrapper-google',
  version: '0.0.1',
  summary: 'An implementation using google maps of ahoy:map-wrapper',
  git: 'https://github.com/ahoyonline/map-wrapper-google',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.0.2');
  api.use(['jquery','ahoy:map-wrapper@0.0.1'], 'client');
  api.addFiles('map-wrapper-google.js', 'client');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('ahoy:map-wrapper-google');
  api.addFiles('map-wrapper-google-tests.js');
});
