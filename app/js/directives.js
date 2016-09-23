angular
    .module('inspinia')
    .directive('login', login);

function login() {
	return {
		restrict: 'E',
		template: '<h3> this is fengqu </h3>',
		replace: true
	}
}
