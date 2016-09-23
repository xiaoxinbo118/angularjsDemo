angular.module('inspinia').
service('Gateway', function($http, store, $cookies, CONST_REQUEST_URL) {
	var Gateway = function(options, data) {
		this.options = options;
		this.data = data;
	};

	Gateway.prototype = {
		post(success, error) {
			if (this.options && this.options.api && this.options.api.METHOD_NAME) {};
			var url = CONST_REQUEST_URL + '/' + this.options.api.METHOD_NAME;
			$http.post(url, this.data)
			.success(function(data, status, headers, config) {
				alert(data);
			}).error(function(data, status, headers, config) {
				alert(22);
			});
		}
	};

	return Gateway;
});
