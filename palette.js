'use strict';

var app = angular.module('palette', []);


app.directive('colorPalette', function()
{
	// h, s, v [0,1]
	function hsvToRgb(h,s,v)
	{
		if( s === 0 ){
			return {r: v, g: v, b: v};
		}

		var i = Math.floor(h*6);
		var f = 6*h - i; // fractional part
		var p = v * (1 - s);
		var q = v * (1 - s*f);
		var t = v * (1 - s*(1-f));

		switch(i%6){
		case 0:
			return {r:v,g:t,b:p};
		case 1:
			return {r:q,g:v,b:p};
		case 2:
			return {r:p,g:v,b:t};
		case 3:
			return {r:p,g:q,b:v};
		case 4:
			return {r:t,g:p,b:v};
		case 5:
			return {r:v,g:p,b:q};
		}
	}

	
	return {
		restrict: 'E',
		template: '<div class="palette">'+
			'<canvas width="1" height="1"></canvas>'+
			'<div class="twoaxis"></div>'+
			'<div class="oneaxis"></div>'+
		'</div>'+
		'<div class="controls">'+
			'<div class="colorswatch"></div>'+
		'</div>',
		scope: {},
		link: function($scope, elem, attrs)
		{
			$scope.selection = {h: 0, s: 1, v: 0.8};

			var canvas = elem[0].querySelector('canvas');
			var gl = canvas.getContext('webgl', {preserveDrawingBuffer: true});

			var style = window.getComputedStyle(elem[0].querySelector('.palette'));
			var w = parseInt(style.width), h = parseInt(style.height)-1;
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);

			var paletteWidth = w-30;
			elem[0].querySelector('.twoaxis').style.width = paletteWidth + 'px';
			elem[0].querySelector('.twoaxis').style.height = h + 'px';
			elem[0].querySelector('.oneaxis').style.height = h + 'px';

			var vert = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vert, [
				'precision lowp float;',
				'attribute vec3 vertPosition;',
				'varying vec2 windowPosition;',

				'void main(void)',
				'{',
					'mat3 xform = mat3(0.5, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 1.0);',
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
				'uniform vec3 selectedColor;',
				'uniform float swatchPercent;',
				'uniform float marginPercent;',
				'uniform float aspect;',

				'vec3 hsv2rgb(float h, float s, float v){',
					'vec3 c = vec3(h,s,v);',
					'vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
					'vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
					'return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
				'}',

				'vec4 getSelectionColor(vec4 baseColor){',
					'return vec4( vec3(1.0)-baseColor.rgb, baseColor.a );',
				'}',

				'void main(void){',
					'float xPercent = windowPosition.x / (1.0 - swatchPercent - marginPercent);',
					'if( xPercent <= 1.0 )',
					'{',
						'vec4 color = vec4(xPercent, windowPosition.y, selectedColor.z, 1.0);',
						'float radius = abs( sqrt(pow(xPercent-selectedColor.x,2.0) + pow((windowPosition.y-selectedColor.y)/aspect,2.0)) );',
						'if( radius < 0.020 && radius > 0.015 )',
							'gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.x, color.y, color.z), 1.0 ));',
						'else',
							'gl_FragColor = vec4( hsv2rgb(color.x, color.y, color.z), 1.0);',
					'}',
					'else if(windowPosition.x > 1.0-swatchPercent)',
					'{',
						'vec4 color = vec4( selectedColor.x, selectedColor.y, windowPosition.y, 1.0);',
						'if( abs(windowPosition.y-selectedColor.z) < 0.005 )',
							'gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.x, color.y, color.z), 1.0 ));',
						'else',
							'gl_FragColor = vec4( hsv2rgb(color.x, color.y, color.z), 1.0);',
					'}',
					'else',
						'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 );',
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
			var swatchUniform = gl.getUniformLocation(program, 'swatchPercent');
			gl.uniform1f(swatchUniform, 20/w);
			var marginUniform = gl.getUniformLocation(program, 'marginPercent');
			gl.uniform1f(marginUniform, 10/w);
			var aspectUniform = gl.getUniformLocation(program, 'aspect');
			gl.uniform1f(aspectUniform, w/h);

			gl.clearColor(1.0, 1.0, 1.0, 0.0);


			var oneaxis = elem[0].querySelector('.oneaxis');
			var twoaxis = elem[0].querySelector('.twoaxis');

			$scope.$watch('width && height', redraw3d);

			$scope.$watch('selection.h + selection.s + selection.v', function()
			{
				gl.uniform3f(selectionUniform, $scope.selection.h, $scope.selection.s, $scope.selection.v);
				redraw3d();

				var rgb = hsvToRgb($scope.selection.h, $scope.selection.s, $scope.selection.v);
				$scope.selection.r = rgb.r;
				$scope.selection.g = rgb.g;
				$scope.selection.b = rgb.b;

				elem[0].querySelector('.colorswatch').style['background-color'] = 'rgb('+Math.round(rgb.r*255)+','+Math.round(rgb.g*255)+','+Math.round(rgb.b*255)+')';
			});

			function redraw3d()
			{
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.vertexAttribPointer(vertPositionAttrib, 3, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}

			var twoaxis_tracking = false;
			twoaxis.onmousedown = function(evt)
			{
				twoaxis_tracking = true;

				$scope.selection.h = (evt.offsetX-1)/(paletteWidth);
				$scope.selection.s = (h-evt.offsetY+1)/(h-1);
				$scope.$apply();
			}

			twoaxis.onmousemove = function(evt){
				if(twoaxis_tracking)
				{
					$scope.selection.h = (evt.offsetX-1)/(paletteWidth);
					$scope.selection.s = (h-evt.offsetY+1)/(h-1);
					$scope.$apply();
				}
			}

			twoaxis.onmouseup = twoaxis.onmouseleave = function(evt){
				twoaxis_tracking = false;
			}

			var oneaxis_tracking = false;
			oneaxis.onmousedown = function(evt){
				oneaxis_tracking = true;
				$scope.selection.v = (h-evt.offsetY-1)/(h-1);
				$scope.$apply();
			}

			oneaxis.onmousemove = function(evt){
				if(oneaxis_tracking)
				{
					$scope.selection.v = (h-evt.offsetY-1)/(h-1);
					$scope.$apply();
				}
			}

			oneaxis.onmouseup = oneaxis.onmouseleave = function(evt){
				oneaxis_tracking = false;
			}


		}
	};
});
