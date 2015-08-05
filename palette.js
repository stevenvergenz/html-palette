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
			'<canvas class="oneaxis" width="1" height="{{height}}"></canvas>'+
			'<div class="colorswatch"></div>',
		scope: {
			width: '=',
			height: '='
		},
		link: function($scope, elem, attrs)
		{
			$scope.selection = {h: 0, s: 1, v: 0.8};

			var twoaxis = elem[0].querySelector('canvas.twoaxis');
			var gl = twoaxis.getContext('webgl');

			gl.viewport(0, 0, $scope.width, $scope.height);

			var vert = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vert, [
				'precision lowp float;',
				'attribute vec3 vertPosition;',
				'varying vec2 windowPosition;',

				'void main(void)',
				'{',
					'mat3 xform = mat3(0.575, 0.0, 0.0, 0.0, 0.5, 0.0, 0.575, 0.5, 1.0);',
					'windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;',
					'gl_Position = vec4(vertPosition,1);',
				'}'].join('\n')
			);
			gl.compileShader(vert);
			if( !gl.getShaderParameter(vert, gl.COMPILE_STATUS) ){
				console.error('Vert shader error:', gl.getShaderInfoLog(vert));
				return;
			}


			var frag = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(frag, [
				'precision lowp float;',
				'varying vec2 windowPosition;',
				'uniform vec3 selectedColor;'+

				'vec3 hsv2rgb(float h, float s, float v){',
					'vec3 c = vec3(h,s,v);',
					'vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
					'vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
					'return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
				'}',

				'void main(void){',
					'if( windowPosition.x < 1.0 )',
						'gl_FragColor = vec4( hsv2rgb(windowPosition.x, windowPosition.y, selectedColor.z), 1.0);',
					'else if(windowPosition.x > 1.05)',
						'gl_FragColor = vec4( hsv2rgb(selectedColor.x, selectedColor.y, windowPosition.y), 1.0);',
					'else',
						'discard;',
				'}'
				].join('\n')
			);
			gl.compileShader(frag);
			if( !gl.getShaderParameter(frag, gl.COMPILE_STATUS) ){
				console.error('Frag shader error:', gl.getShaderInfoLog(frag));
				return;
			}

			var program = gl.createProgram();
			gl.attachShader(program, vert);
			gl.attachShader(program, frag);
			gl.linkProgram(program);
			if( !gl.getProgramParameter(program, gl.LINK_STATUS) ){
				console.error('Unable to link program');
				return;
			}

			gl.useProgram(program);
			var vertPositionAttrib = gl.getAttribLocation(program, 'vertPosition');
			gl.enableVertexAttribArray(vertPositionAttrib);

			var buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
				-1.0, -1.0, 0.0,
				-1.0,  1.0, 0.0,
				 1.0, -1.0, 0.0,
				 1.0,  1.0, 0.0
			]), gl.STATIC_DRAW);

			var selectionUniform = gl.getUniformLocation(program, 'selectedColor');

			gl.clearColor(1.0, 1.0, 1.0, 0.0);


			var oneaxis = elem[0].querySelector('canvas.oneaxis');
			//var oneaxis_ctx = oneaxis.getContext('2d');

			$scope.$watch('width && height', redraw3d);

			$scope.$watch('selection.h + selection.s + selection.v', function(){
				//redraw2d(1);
				gl.uniform3f(selectionUniform, $scope.selection.h, $scope.selection.s, $scope.selection.v);
				redraw3d();
				elem[0].querySelector('.colorswatch').style['background-color'] = convert($scope.selection.h, $scope.selection.s, $scope.selection.v);
			});

			function redraw3d()
			{
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.vertexAttribPointer(vertPositionAttrib, 3, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}

			function redraw2d(axis)
			{
				var w = $scope.width, h = $scope.height;
				for(var y=0; y<h; y++)
				{
					if(axis != 1){
						for(var x=0; x<w; x++)
						{
							twoaxis_ctx.fillStyle = convert(x/w, (h-y-1)/h, $scope.selection.v);
							twoaxis_ctx.fillRect(x,y,1,1);
						}
					}

					if(axis != 2){
						oneaxis_ctx.fillStyle = convert($scope.selection.h, $scope.selection.s, (h-y-1)/h);
						oneaxis_ctx.fillRect(0,y,1,1);
					}
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
