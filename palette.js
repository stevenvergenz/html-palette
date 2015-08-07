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
		case 5:
			return {r:v,g:p,b:q};
		}
	}

	var template = [
		'<div class="palette">',
			'<canvas width="1" height="1"></canvas>',
			'<div class="twoaxis"></div>',
			'<div class="oneaxis"></div>',
		'</div>',
		'<div class="controls">',
			'<div class="colorswatch"></div>',
		'</div>'
	].join('');

	var vertShaderSrc = [
		'precision lowp float;',
		'attribute vec3 vertPosition;',
		'varying vec2 windowPosition;',

		'void main(void)',
		'{',
			'mat3 xform = mat3(0.5, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 1.0);',
			'windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;',
			'gl_Position = vec4(vertPosition,1);',
		'}'
	].join('\n');

	var fragShaderSrc = [
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
	].join('\n');


	var Palette = function(elem)
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
		this.swatchUniform = gl.getUniformLocation(program, 'swatchPercent');
		gl.uniform1f(this.swatchUniform, 20/w);
		this.marginUniform = gl.getUniformLocation(program, 'marginPercent');
		gl.uniform1f(this.marginUniform, 10/w);
		this.aspectUniform = gl.getUniformLocation(program, 'aspect');
		gl.uniform1f(this.aspectUniform, w/h);

		gl.clearColor(1.0, 1.0, 1.0, 0.0);
		this.color({h: 0.3, s: 0.9, v: 0.8});

		var self = this;

		var twoaxis_tracking = false;
		twoaxis.onmousedown = function(evt)
		{
			twoaxis_tracking = true;

			self.color({h: (evt.offsetX-1)/(paletteWidth), s: (h-evt.offsetY+1)/(h-1)});
		}

		twoaxis.onmousemove = function(evt){
			if(twoaxis_tracking){
				self.color({h: (evt.offsetX-1)/(paletteWidth), s: (h-evt.offsetY+1)/(h-1)});
			}
		}

		twoaxis.onmouseup = twoaxis.onmouseleave = function(evt){
			twoaxis_tracking = false;
		}

		var oneaxis_tracking = false;
		oneaxis.onmousedown = function(evt){
			oneaxis_tracking = true;
			self.color({v: (h-evt.offsetY-1)/(h-1)});
		}

		oneaxis.onmousemove = function(evt){
			if(oneaxis_tracking){
				self.color({v: (h-evt.offsetY-1)/(h-1)});
			}
		}

		oneaxis.onmouseup = oneaxis.onmouseleave = function(evt){
			oneaxis_tracking = false;
		}


	}

	Palette.prototype.redraw = function()
	{
		this.gl.uniform3f(this.selectionUniform, this.selection.h, this.selection.s, this.selection.v);

		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	Palette.prototype.color = function(val)
	{
		if(val && (val.h || val.s || val.v))
		{
			if(val.h) this.selection.h = val.h;
			if(val.s) this.selection.s = val.s;
			if(val.v) this.selection.v = val.v;
			this.redraw();

			var rgb = hsvToRgb(this.selection.h, this.selection.s, this.selection.v);
			this.selection.r = rgb.r;
			this.selection.g = rgb.g;
			this.selection.b = rgb.b;
		}

		this.elem.querySelector('.colorswatch').style['background-color'] = 
			'rgb('
				+Math.round(this.selection.r*255)+','
				+Math.round(this.selection.g*255)+','
				+Math.round(this.selection.b*255)
			+')';
	}

	var app = angular.module('html-palette', []);

	app.directive('htmlPalette', function()
	{
		return {
			restrict: 'E',
			template: template,
			scope: {
			},
			link: function($scope, elem, attrs)
			{
				var palette = new Palette(elem[0]);
				palette.redraw();

				/*$scope.$watch('selection.h + selection.s + selection.v', function()
				{

					elem[0].querySelector('.colorswatch').style['background-color'] = 'rgb('+Math.round(rgb.r*255)+','+Math.round(rgb.g*255)+','+Math.round(rgb.b*255)+')';
				});*/

			}
		};
	});

})(window.jQuery, window.angular);
