angular.module('inspinia').
controller('LoginCtrl', function($scope, $state, bemyse_api_password_login, Gateway) {

	$scope.init = function() {
		
	};

	$scope.login = function() {
		var name = $scope.name;
		var psw = $scope.pwd;

		if (name == undefined || name == '') {
			return;
		}

		if (psw == undefined || psw == '') {
			return;
		}
// new Gateway(bemyse_api_password_login);
		var getway = new Gateway(bemyse_api_password_login, {
			phone: name,
			psw: psw 
		});
		getway.post();
		
	};
});