angular
  .module('app', [])
  .controller('myController', ['$scope','$http', function($scope, $http) {
  	$scope.settingsData = {};
  	$http.get('settings.json').then(function(data) {
		if(data.status != 200){
			console.log("Error", data)
			alert("Ошибка чтения файла настроек");
						return;
		}
	    init(data);
	});

	let init = function(data){
		$scope.settingsData = data
	}
	
}]);

