'use strict';

var app = angular.module('palette', []);


app.directive('colorPalette', function()
{
	// h, s, v [0,1]
	function convert(h,s,v)
	{
		if( s === 0 ){
			return composeRGB(v,v,v);
		}

		var i = Math.floor(h*6);
		var f = 6*h - i; // fractional part
		var p = v * (1 - s);
		var q = v * (1 - s*f);
		var t = v * (1 - s*(1-f));

		switch(i%6){
		case 0:
			return composeRGB(v,t,p);
		case 1:
			return composeRGB(q,v,p);
		case 2:
			return composeRGB(p,v,t);
		case 3:
			return composeRGB(p,q,v);
		case 4:
			return composeRGB(t,p,v);
		case 5:
			return composeRGB(v,p,q);
		}
	}

	function composeRGB(r,g,b){
		return 'rgb('+Math.round(r*255)+','+Math.round(g*255)+','+Math.round(b*255)+')';
	}

	return {
		restrict: 'E',
		template: '<canvas class="twoaxis" width="{{width}}" height="{{height}}"></canvas>'+
			'<canvas class="oneaxis" width="20" height="{{height}}"></canvas>'+
			'<div class="color" style="width: 50px; height: 50px;"></div>',
		scope: {
			width: '=',
			height: '='
		},
		link: function($scope, elem, attrs)
		{
			$scope.selection = {h: 0, s: 1, v: 0.8};

			var twoaxis = elem[0].querySelector('canvas.twoaxis');
			var twoaxis_ctx = twoaxis.getContext('2d');

			var oneaxis = elem[0].querySelector('canvas.oneaxis');
			var oneaxis_ctx = oneaxis.getContext('2d');

			$scope.$watch('width && height', redraw);

			$scope.$watch('selection.h + selection.s + selection.v', function(){
				redraw();
				elem[0].querySelector('.color').style['background-color'] = convert($scope.selection.h, $scope.selection.s, $scope.selection.v);
			});

			function redraw()
			{
				var w = $scope.width, h = $scope.height;
				for(var y=0; y<h; y++)
				{
					for(var x=0; x<w; x++)
					{
						twoaxis_ctx.fillStyle = convert(x/w, (h-y-1)/h, $scope.selection.v);
						twoaxis_ctx.fillRect(x,y,1,1);
					}

					oneaxis_ctx.fillStyle = convert($scope.selection.h, $scope.selection.s, (h-y-1)/h);
					oneaxis_ctx.fillRect(0,y,20,1);
				}
			}

			var twoaxis_tracking = false;
			twoaxis.onmousedown = function(evt){
				twoaxis_tracking = true;
				$scope.selection.h = evt.clientX/($scope.width-1);
				$scope.selection.s = ($scope.height-evt.clientY-1)/($scope.height-1);
				$scope.$apply();
			}

			twoaxis.onmousemove = function(evt){
				if(twoaxis_tracking)
				{
					$scope.selection.h = evt.clientX/($scope.width-1);
					$scope.selection.s = ($scope.height-evt.clientY-1)/($scope.height-1);
					$scope.$apply();
				}
			}

			twoaxis.onmouseup = twoaxis.onmouseleave = function(evt){
				twoaxis_tracking = false;
			}

			var oneaxis_tracking = false;
			oneaxis.onmousedown = function(evt){
				oneaxis_tracking = true;
				$scope.selection.v = ($scope.height-evt.clientY-1)/($scope.height-1);
				$scope.$apply();
			}

			oneaxis.onmousemove = function(evt){
				if(oneaxis_tracking)
				{
					$scope.selection.v = ($scope.height-evt.clientY-1)/($scope.height-1);
					$scope.$apply();
				}
			}

			oneaxis.onmouseup = oneaxis.onmouseleave = function(evt){
				oneaxis_tracking = false;
			}


		}
	};
});
