angular
  .module('inspinia')
  .config(config)
  .run(function($rootScope, $state) {
    $rootScope.$state = $state;
  });

function config($stateProvider) {
	$stateProvider
	    .state('login', {
	      url: "/login",
	      templateUrl: "views/login.html",
	      controller: 'LoginCtrl',
	      data: {
	        pageTitle: '登陆'
	      }
	    });
}