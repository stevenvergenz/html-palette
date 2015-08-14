'use strict';

(function(jQuery, angular)
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
		default:
			return {r:v,g:p,b:q};
		}
	}

	function rgbToHsv(r,g,b)
	{
		var max = Math.max(r, g, b), min = Math.min(r, g, b);
	    var h, s, v = max;

	    var d = max - min;
	    s = max === 0 ? 0 : d / max;

	    if(max == min) {
	        h = 0; // achromatic
	    }
	    else {
	        switch(max) {
	            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
	            case g: h = (b - r) / d + 2; break;
	            case b: h = (r - g) / d + 4; break;
	        }
	        h /= 6;
	    }

	    return { h: h, s: s, v: v };
	}

	var template = [
		'<div class="palette">',
			'<canvas width="1" height="1"></canvas>',
			'<div class="twoaxis" draggable="true"></div>',
			'<div class="oneaxis" draggable="true"></div>',
		'</div>',
		'<div class="controls">',
			'<div class="rgbInput">',
				'#',
				'<span class="r" draggable="true"></span>',
				'<span class="g" draggable="true"></span>',
				'<span class="b" draggable="true"></span>',
			'</div>',
			'<div class="colorswatch"></div>',
		'</div>'
	].join('');

	var vertShaderSrc = [
		'precision lowp float;',
		'attribute vec3 vertPosition;',
		'varying vec2 windowPosition;',
		'uniform vec2 windowDimensions;',

		'void main(void)',
		'{',
			'mat3 xform = mat3(0.5*windowDimensions.x, 0.0, 0.0, 0.0, 0.5*windowDimensions.y, 0.0, windowDimensions.x/2.0, windowDimensions.y/2.0, 1.0);',
			'windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;',
			'gl_Position = vec4(vertPosition,1);',
		'}'
	].join('\n');

	var fragShaderSrc = [
		'precision lowp float;',
		'#define M_PI 3.141592653589',

		'varying vec2 windowPosition;',
		'uniform vec3 selectedColor;',
		'uniform float swatchWidth;',
		'uniform float marginWidth;',
		'uniform vec2 windowDimensions;',
		'uniform bool radial;',

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

			'float taWidth = windowDimensions.x - swatchWidth - marginWidth;',
			'float aspect = taWidth / windowDimensions.y;',
			'vec2 center = vec2(taWidth/2.0, windowDimensions.y/2.0);',
			'vec4 color;',
			'vec2 selectionPosition;',

			'if( windowPosition.x <= taWidth )',
			'{',
				'if(radial){',

					'vec2 radialVec = (windowPosition - center)*vec2(2.0/taWidth, 2.0/windowDimensions.y);',
					'radialVec = mat2(max(1.0,aspect), 0.0, 0.0, max(1.0,1.0/aspect)) * radialVec;',
					'if(length(radialVec) > 1.0) discard;',
					'float hue = atan(radialVec.y,radialVec.x)/(2.0*M_PI) + 0.5;',
					'color = vec4(hue, length(radialVec), selectedColor.z, 1.0);',

					'float angle = (selectedColor.x-0.5)*2.0*M_PI;',
					'selectionPosition = min(center.x, center.y) * selectedColor.y * vec2(cos(angle), sin(angle)) + center;',

				'} else {',
					'color = vec4(windowPosition.x/taWidth, windowPosition.y/windowDimensions.y, selectedColor.z, 1.0);',
					'selectionPosition = vec2(selectedColor.x*taWidth, selectedColor.y*windowDimensions.y);',
				'}',

				'vec2 difference = selectionPosition - windowPosition;',
				'float radius = length(difference);',

				'if( radius > 4.5 && radius < 6.0 )',
					'gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.x, color.y, color.z), 1.0 ));',
				'else',
					'gl_FragColor = vec4( hsv2rgb(color.x, color.y, color.z), 1.0);',
			'}',
			'else if(windowPosition.x > windowDimensions.x-swatchWidth)',
			'{',
				'vec4 color = vec4( selectedColor.x, selectedColor.y, windowPosition.y/windowDimensions.y, 1.0);',

				'if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.z) < 1.0 )',
					'gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.x, color.y, color.z), 1.0 ));',

				'else',
					'gl_FragColor = vec4( hsv2rgb(color.x, color.y, color.z), 1.0);',
			'}',
			'else',
				'discard;',
		'}'
	].join('\n');


	var Palette = function(elem, opts)
	{
		this.selection = {};

		this.elem = elem;
		this.canvas = elem.querySelector('canvas');
		this.gl = this.canvas.getContext('webgl');
		var gl = this.gl;

		// size the canvas
		var style = window.getComputedStyle(elem.querySelector('.palette'));
		var w = parseInt(style.width), h = parseInt(style.height)-1;
		this.canvas.width = w;
		this.canvas.height = h;
		gl.viewport(0, 0, w, h);

		// size the overlay
		var paletteWidth = w-30;
		var twoaxis = elem.querySelector('.twoaxis');
		var oneaxis = elem.querySelector('.oneaxis')
		twoaxis.style.width = paletteWidth + 'px';
		twoaxis.style.height = h + 'px';
		oneaxis.style.height = h + 'px';

		elem.style.display = 'none';
		if( elem.previousElementSibling ){
			elem.previousElementSibling.onclick = function(evt){
				elem.style.display = elem.style.display ? '' : 'none';
				elem.style.left = evt.x+15+'px';
				elem.style.top = evt.y+15+'px';
				console.log(evt);
			}
		}



		/********************************
		* Initialize the webgl canvas
		*********************************/

		// set up vert shader
		var vert = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vert, vertShaderSrc);
		gl.compileShader(vert);
		if( !gl.getShaderParameter(vert, gl.COMPILE_STATUS) ){
			console.error('Vert shader error:', gl.getShaderInfoLog(vert));
			return;
		}

		// set up frag shader
		var frag = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(frag, fragShaderSrc);
		gl.compileShader(frag);
		if( !gl.getShaderParameter(frag, gl.COMPILE_STATUS) ){
			console.error('Frag shader error:', gl.getShaderInfoLog(frag));
			return;
		}

		// link shaders
		var program = gl.createProgram();
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);
		if( !gl.getProgramParameter(program, gl.LINK_STATUS) ){
			console.error('Unable to link program');
			return;
		}
		else {
			gl.useProgram(program);
		}

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

		gl.vertexAttribPointer(vertPositionAttrib, 3, this.gl.FLOAT, false, 0, 0);

		this.selectionUniform = gl.getUniformLocation(program, 'selectedColor');
		gl.uniform1f(gl.getUniformLocation(program, 'swatchWidth'), 20);
		gl.uniform1f(gl.getUniformLocation(program, 'marginWidth'), 10);
		gl.uniform2f(gl.getUniformLocation(program, 'windowDimensions'), w,h);
		gl.uniform1i(gl.getUniformLocation(program, 'radial'), !!opts.radial);

		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		this.color({h: 0.3, s: 0.9, v: 0.8});

		var self = this;

		twoaxis.ondragstart = function(evt){
			evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
		}

		twoaxis.ondrag = twoaxis.onmousedown = function(evt){
			if( opts.radial ){
				var center = [paletteWidth/2, h/2];
				var clickDiff = [evt.offsetX-1 - center[0], -(evt.offsetY-1) + center[1]];
				var hue = Math.atan2(clickDiff[1], clickDiff[0])/(2*Math.PI) + 0.5;
				var sat = Math.sqrt(clickDiff[0]*clickDiff[0] + clickDiff[1]*clickDiff[1]) / Math.min(center[0], center[1]);
				if( evt.screenX !== 0 || evt.screenY !== 0 )
					self.color({h: hue, s: Math.min(sat, 1.0)});
			}
			else if( evt.screenX !== 0 || evt.screenY !== 0 )
				self.color({h: Math.min(1, Math.max(0, (evt.offsetX-1)/paletteWidth)), s: Math.min(1, Math.max(0, (h-evt.offsetY+1)/(h-1)))});	
		}

		oneaxis.ondragstart = function(evt){
			evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
		}

		oneaxis.ondrag = oneaxis.onmousedown = function(evt){
			if( evt.screenX !== 0 || evt.screenY !== 0 )
				self.color({v: Math.max(0, Math.min(1, (h-evt.offsetY-1)/(h-1)))});
		}

		var initialValue, initialMouse;

		function bindRGBElement(e, channel)
		{
			e.ondragstart = function(evt){
				initialValue = Math.round(self.selection[channel]*255);
				initialMouse = evt.offsetY;
				evt.dataTransfer.effectAllowed = 'none';
				evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
			}

			e.ondrag = function(evt){
				//evt.preventDefault();
				var newVal = initialValue + initialMouse-evt.offsetY;
				if(evt.screenX !== 0 || evt.screenY !== 0){
					var color = {};
					color[channel] = Math.max(0, Math.min(1, newVal/255));
					self.color(color);
				}
			}
		}

		bindRGBElement(elem.querySelector('.r'), 'r');
		bindRGBElement(elem.querySelector('.g'), 'g');
		bindRGBElement(elem.querySelector('.b'), 'b');
	}

	Palette.prototype.redraw = function()
	{
		this.gl.uniform3f(this.selectionUniform, this.selection.h, this.selection.s, this.selection.v);

		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	Palette.prototype.color = function(val)
	{
		if(val && (val.h!==undefined || val.s!==undefined || val.v!==undefined))
		{
			if(val.h !== undefined) this.selection.h = val.h;
			if(val.s !== undefined) this.selection.s = val.s;
			if(val.v !== undefined) this.selection.v = val.v;
			this.redraw();

			var rgb = hsvToRgb(this.selection.h, this.selection.s, this.selection.v);
			this.selection.r = Math.max(rgb.r, 0);
			this.selection.g = Math.max(rgb.g, 0);
			this.selection.b = Math.max(rgb.b, 0);

			this.selection.hex =
				('00'+Math.round(this.selection.r*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.g*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.b*255).toString(16)).slice(-2)

			if(this.colorCallback) this.colorCallback(this.selection);
		}
		else if(val && (val.r!==undefined || val.g!==undefined || val.b!==undefined))
		{
			if(val.r !== undefined) this.selection.r = val.r;
			if(val.g !== undefined) this.selection.g = val.g;
			if(val.b !== undefined) this.selection.b = val.b;

			var hsv = rgbToHsv(this.selection.r, this.selection.g, this.selection.b);

			this.selection.h = hsv.h;
			this.selection.s = hsv.s;
			this.selection.v = hsv.v;
			this.redraw();

			this.selection.hex =
				('00'+Math.round(this.selection.r*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.g*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.b*255).toString(16)).slice(-2)

			if(this.colorCallback) this.colorCallback(this.selection);
		}
		else if( /^[0-9A-Fa-f]{6}$/.test(val) )
		{
			this.selection.hex = val;

			val = parseInt(val, 16);
			this.selection.r = ((val & 0xff0000) >> 16) / 255;
			this.selection.g = ((val & 0x00ff00) >> 8) / 255;
			this.selection.b = (val & 0x0000ff) / 255;

			var hsv = rgbToHsv(this.selection.r, this.selection.g, this.selection.b);
			this.selection.h = hsv.h;
			this.selection.s = hsv.s;
			this.selection.v = hsv.v;
			this.redraw();

			if(this.colorCallback) this.colorCallback(this.selection);
		}

		this.elem.querySelector('.rgbInput .r').innerHTML = this.selection.hex.slice(0,2);
		this.elem.querySelector('.rgbInput .g').innerHTML = this.selection.hex.slice(2,4);
		this.elem.querySelector('.rgbInput .b').innerHTML = this.selection.hex.slice(4,6);
		this.elem.querySelector('.colorswatch').style['background-color'] = '#'+this.selection.hex;
	}

	Palette.prototype.setColorCallback = function(cb)
	{
		this.colorCallback = cb;
	}

	if(angular)
	{
		var app = angular.module('html-palette', []);

		app.directive('htmlPalette', ['$timeout', function($timeout)
		{
			return {
				restrict: 'E',
				template: template,
				scope: {
					hsvColor: '=',
					rgbColor: '=',
					hexColor: '='
				},
				link: function($scope, elem, attrs)
				{
					var palette = new Palette(elem[0], attrs);
					var dToW = false, wToD = false;

					if($scope.hsvColor)
					{
						palette.setColorCallback(function(color){
							if(!dToW){
								wToD = true;
								console.log('wToD');
								$scope.hsvColor.h = color.h;
								$scope.hsvColor.s = color.s;
								$scope.hsvColor.v = color.v;
								$timeout(function(){
									$scope.$apply();
									wToD = false;
								});
							}
						});

						$scope.$watchCollection('hsvColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								console.log('dTow');
								palette.color(newval);
								dToW = false;
							}
						});
					}

					else if($scope.rgbColor)
					{
						palette.setColorCallback(function(color){
							if(!dToW){
								wToD = true;
								$scope.rgbColor.r = color.r;
								$scope.rgbColor.g = color.g;
								$scope.rgbColor.b = color.b;
								$timeout(function(){
									$scope.$apply();
									wToD = false;
								});
							}
						});

						$scope.$watchCollection('rgbColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								palette.color(newval);
								dToW = false;
							}
						});
					}

					else if($scope.hexColor)
					{
						palette.setColorCallback(function(color){
							if(!dToW){
								wToD = true;
								$scope.hexColor = color.hex;
								$timeout(function(){
									$scope.$apply();
									wToD = false;
								});
							}
						});

						$scope.$watch('hexColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								palette.color(newval);
								dToW = false;
							}
						});
					}

					palette.redraw();
				}
			};
		}]);
	}

})(window.jQuery, window.angular);
