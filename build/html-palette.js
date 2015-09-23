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

	var template = '<div class="palette">\n	<canvas width="1" height="1"></canvas>\n	<div class="alpha" draggable="true"></div>\n	<div class="twoaxis" draggable="true"></div>\n	<div class="oneaxis" draggable="true"></div>\n</div>\n<div class="controls">\n	<div class="rgbInput">\n		#\n		<span class="r" draggable="true"></span>\n		<span class="g" draggable="true"></span>\n		<span class="b" draggable="true"></span>\n		<span class="a" draggable="true"></span>\n	</div>\n	<div class="colorswatch"></div>\n</div>\n';
	var vertShaderSrc = 'precision lowp float;\nattribute vec3 vertPosition;\nvarying vec2 windowPosition;\nuniform vec2 windowDimensions;\n\nvoid main(void)\n{\n	mat3 xform = mat3(0.5*windowDimensions.x, 0.0, 0.0, 0.0, 0.5*windowDimensions.y, 0.0, windowDimensions.x/2.0, windowDimensions.y/2.0, 1.0);\n	windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;\n	gl_Position = vec4(vertPosition,1);\n}\n\n';
	var fragShaderSrc = 'precision lowp float;\n#define M_PI 3.141592653589\n\nvarying vec2 windowPosition;\nuniform vec4 selectedColor;\nuniform float swatchWidth;\nuniform float marginWidth;\nuniform vec2 windowDimensions;\nuniform bool radial;\nuniform bool useAlpha;\nuniform sampler2D tex;\n\nvec3 hsv2rgb(vec3 c){\n	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n}\n\nvec4 getSelectionColor(vec4 baseColor){\n	return vec4( vec3(1.0)-baseColor.rgb, baseColor.a );\n}\n\nvoid main(void){\n\n	float taLeft = useAlpha ? swatchWidth + marginWidth : 0.0;\n	float taWidth = windowDimensions.x - swatchWidth - marginWidth - taLeft;\n	vec2 center = vec2(taWidth/2.0+taLeft, windowDimensions.y/2.0);\n	float aspect = taWidth / windowDimensions.y;\n	vec4 color;\n	vec2 selectionPosition;\n\n	if( windowPosition.x >= taLeft &&  windowPosition.x <= taLeft+taWidth )\n	{\n		if(radial)\n		{\n			vec2 radialVec = (windowPosition - center)*vec2(2.0/taWidth, 2.0/windowDimensions.y);\n			radialVec = mat2(max(1.0,aspect), 0.0, 0.0, max(1.0,1.0/aspect)) * radialVec;\n			if(length(radialVec) > 1.0) discard;\n			float hue = atan(radialVec.y,radialVec.x)/(2.0*M_PI) + 0.5;\n			color = vec4(hue, length(radialVec), selectedColor.z, 1.0);\n\n			float angle = (selectedColor.x-0.5)*2.0*M_PI;\n			selectionPosition = min(center.x-taLeft, center.y) * selectedColor.y * vec2(cos(angle), sin(angle)) + center;\n		}\n		else {\n			color = vec4((windowPosition.x-taLeft)/taWidth, windowPosition.y/windowDimensions.y, selectedColor.z, 1.0);\n			selectionPosition = vec2(selectedColor.x*taWidth+taLeft, selectedColor.y*windowDimensions.y);\n		}\n\n		vec2 difference = selectionPosition - windowPosition;\n		float radius = length(difference);\n\n		if( radius > 4.5 && radius < 6.0 )\n			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));\n		else\n			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);\n	}\n\n	else if(useAlpha && windowPosition.x < swatchWidth)\n	{\n		vec4 color = vec4(mix( texture2D(tex, windowPosition/16.0).xyz, hsv2rgb(selectedColor.xyz), windowPosition.y/windowDimensions.y), 1.0);\n\n		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.w) < 1.0 )\n			gl_FragColor = getSelectionColor(color);\n		else\n			gl_FragColor = color;\n	}\n\n	else if(windowPosition.x > windowDimensions.x-swatchWidth)\n	{\n		vec4 color = vec4( selectedColor.x, selectedColor.y, windowPosition.y/windowDimensions.y, 1.0);\n\n		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.z) < 1.0 )\n			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));\n		else\n			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);\n	}\n	else\n		discard;\n}\n\n';
	var transparencyBgUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAK0lEQVQoz2Pcu3cvAzbg5OSEVZyJgUQwqoEYwPj//3+sEvv27RsNJfppAAD+GAhT8tRPqwAAAABJRU5ErkJggg==';

	var styleTag = document.createElement('style');
	styleTag.type = 'text/css';
	styleTag.innerHTML = 'html-palette,.html-palette{display:inline-block;width:30px;height:30px;border:ridge lightgrey 3px}.htmlPalette{width:200px;height:200px;border:solid grey 1px;padding:5px;background-color:white;display:-webkit-box;display:-moz-flex;display:-ms-flexbox;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-moz-flex-direction:column;-ms-flex-direction:column;-webkit-flex-direction:column;flex-direction:column;position:absolute;box-sizing:border-box}.htmlPalette .palette{position:relative;padding:1px;-moz-flex-grow:1;-ms-flex:1 1;-webkit-flex-grow:1;flex-grow:1}.htmlPalette .palette .twoaxis,.htmlPalette .palette .oneaxis,.htmlPalette .palette .alpha{position:absolute;border:solid grey 1px}.htmlPalette .palette .twoaxis{top:0px;left:30px;cursor:crosshair}.htmlPalette .palette .oneaxis{top:0px;right:0px;width:20px;margin-left:10px;cursor:ns-resize}.htmlPalette .palette .alpha{top:0px;left:0px;width:20px;margin-right:10px;cursor:ns-resize}.htmlPalette .controls{height:30px;-moz-flex-shrink:0;-ms-flex-shrink:0;-webkit-flex-shrink:0;flex-shrink:0;display:-webkit-box;display:-moz-flex;display:-ms-flexbox;display:-webkit-flex;display:flex;-webkit-box-orient:horizontal;-moz-flex-direction:row;-ms-flex-direction:row;-webkit-flex-direction:row;flex-direction:row;-webkit-box-align:stretch;-moz-align-items:stretch;-ms-flex-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-box-pack:justify;-moz-justify-content:space-between;-ms-flex-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}.htmlPalette .controls .rgbInput{display:-webkit-box;display:-moz-flex;display:-ms-flexbox;display:-webkit-flex;display:flex;-webkit-box-align:center;-moz-align-items:center;-ms-flex-align:center;-webkit-align-items:center;align-items:center;padding-left:5px;font-size:20px;letter-spacing:1px}.htmlPalette .controls .rgbInput span{margin:0 2px;cursor:ns-resize}.htmlPalette .controls .rgbInput .r{color:red}.htmlPalette .controls .rgbInput .g{color:green}.htmlPalette .controls .rgbInput .b{color:blue}.htmlPalette .controls .rgbInput .a{color:black}.htmlPalette .controls .colorswatch{width:25%;box-sizing:border-box;border:solid grey 1px}\n';
	document.head.appendChild(styleTag);

	document.addEventListener('click', function(evt)
	{
		var list = document.querySelectorAll('.htmlPalette');
		for(var i=0; i<list.length; i++){
			if(list.item(i) !== self.elem) list.item(i).style.display = 'none';
		}
	});

	var Palette = function(triggerElem, opts)
	{
		opts = opts || {};

		// add new color picker to the dom
		this.elem = document.createElement('div');
		this.elem.setAttribute('class', 'htmlPalette'+(opts.css?' '+opts.css:''));
		this.elem.innerHTML = template;
		this.elem.onclick = function(e){ e.stopPropagation(); }
		document.body.appendChild(this.elem);

		this.triggerElem = triggerElem;
		this._onclick = Palette.onclick.bind(this);
		this.triggerElem.addEventListener('click', this._onclick);

		this.colorCallback = opts.colorCallback || null;
		this.popupEdge = opts.popupEdge || 'se';
		this.radial = opts.radial || false;
		this.useAlpha = opts.useAlpha || false;
		this.updateTriggerBg = opts.updateTriggerBg !== undefined ? opts.updateTriggerBg : true;
		this.disabled = opts.disabled || false;

		this.selection = {};
		this._canvas = this.elem.querySelector('canvas');
		this._gl = this._canvas.getContext('webgl');
		var gl = this._gl;

		var popupStyle = window.getComputedStyle(this.elem);
		this._popupWidth = parseInt(popupStyle.width) || 0;
		this._popupHeight = parseInt(popupStyle.height) || 0;

		// size the canvas
		var style = window.getComputedStyle(this.elem.querySelector('.palette'));
		var w = parseInt(style.width), h = parseInt(style.height)-1;
		this._canvas.width = w;
		this._canvas.height = h;
		gl.viewport(0, 0, w, h);

		// size the overlay
		var paletteWidth = this.useAlpha ? w-60 : w-30;
		var twoaxis = this.elem.querySelector('.twoaxis');
		var oneaxis = this.elem.querySelector('.oneaxis')
		var alpha = this.elem.querySelector('.alpha')
		twoaxis.style.width = paletteWidth + 'px';
		twoaxis.style.height = h + 'px';
		oneaxis.style.height = h + 'px';
		alpha.style.height = h + 'px';

		this.elem.style.display = 'none';

		if(!this.useAlpha){
			alpha.style.display = 'none';
			this.elem.querySelector('.rgbInput .a').style.display = 'none';
			twoaxis.style.left = '0px';
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
		var program = this._program = gl.createProgram();
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

		gl.vertexAttribPointer(vertPositionAttrib, 3, gl.FLOAT, false, 0, 0);

		this._selectionUniform = gl.getUniformLocation(program, 'selectedColor');
		gl.uniform1f(gl.getUniformLocation(program, 'swatchWidth'), 20);
		gl.uniform1f(gl.getUniformLocation(program, 'marginWidth'), 10);
		gl.uniform2f(gl.getUniformLocation(program, 'windowDimensions'), w,h);
		gl.uniform1i(gl.getUniformLocation(program, 'useAlpha'), !!this.useAlpha);

		var self = this;

		// bind transparency texture
		var gltex = gl.createTexture();
		var img = new Image();
		img.onload = function()
		{
			gl.bindTexture(gl.TEXTURE_2D, gltex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			self.redraw();
		};
		img.src = transparencyBgUrl;

		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		this.color(opts.initialColor || 'aaaaaa');

		twoaxis.ondragstart = function(evt){
			evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
		}

		twoaxis.ondrag = twoaxis.onmousedown = function(evt){
			if( self.radial ){
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

		alpha.ondragstart = function(evt){
			evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
		}

		alpha.ondrag = alpha.onmousedown = function(evt){
			if( evt.screenX !== 0 || evt.screenY !== 0 )
				self.color({a: Math.max(0, Math.min(1, (h-evt.offsetY-1)/(h-1)))});
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

		bindRGBElement(this.elem.querySelector('.r'), 'r');
		bindRGBElement(this.elem.querySelector('.g'), 'g');
		bindRGBElement(this.elem.querySelector('.b'), 'b');
		bindRGBElement(this.elem.querySelector('.a'), 'a');
	}

	Palette.onclick = function(evt)
	{
		evt.stopPropagation();

		if(this.disabled) return;

		var box = this.triggerElem.getBoundingClientRect();
		var origin = {
			x: (box.left+box.right)/2,
			y: (box.top+box.bottom)/2
		};

		var list = document.querySelectorAll('.htmlPalette');
		for(var i=0; i<list.length; i++)
		{
			if(list.item(i) !== this.elem || !this.elem.style.display){
				list.item(i).style.display = 'none';
			}
			else
			{
				var offset = 20;

				// fall back on sw on missing or invalid option
				if( !/^[ns]?[we]?$/.test(this.popupEdge) || !this.popupEdge )
					this.popupEdge = 'se';

				// set position vertically
				if(/^n/.test(this.popupEdge))
					this.elem.style.top = origin.y - this._popupHeight - offset + 'px';

				else if(/^s/.test(this.popupEdge))
					this.elem.style.top = origin.y + offset + 'px';

				else
					this.elem.style.top = origin.y - this._popupHeight/2 + 'px';

				// set position horizontally
				if(/e$/.test(this.popupEdge))
					this.elem.style.left = origin.x + offset + 'px';

				else if(/w$/.test(this.popupEdge))
					this.elem.style.left = origin.x - this._popupWidth - offset + 'px';

				else
					this.elem.style.left = origin.x - this._popupWidth/2 + 'px';

				this.elem.style.display = '';
			}
		}
	}

	Palette.prototype.redraw = function()
	{
		this._gl.uniform1i(this._gl.getUniformLocation(this._program, 'radial'), !!this.radial);
		this._gl.uniform4f(this._selectionUniform, this.selection.h, this.selection.s, this.selection.v, this.selection.a);

		this._gl.clear(this._gl.COLOR_BUFFER_BIT);
		this._gl.drawArrays(this._gl.TRIANGLE_STRIP, 0, 4);
	}

	Palette.prototype.color = function(val)
	{
		if(this.selection.a === undefined) this.selection.a = 1.0;
		if(val && val.a !== undefined) this.selection.a = val.a;

		if(!val){
			return this.selection;
		}
		else if(val.h!==undefined || val.s!==undefined || val.v!==undefined)
		{
			if(val.h !== undefined) this.selection.h = val.h;
			if(val.s !== undefined) this.selection.s = val.s;
			if(val.v !== undefined) this.selection.v = val.v;

			var rgb = hsvToRgb(this.selection.h, this.selection.s, this.selection.v);
			this.selection.r = Math.max(rgb.r, 0);
			this.selection.g = Math.max(rgb.g, 0);
			this.selection.b = Math.max(rgb.b, 0);

			this.selection.hex =
				('00'+Math.round(this.selection.r*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.g*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.b*255).toString(16)).slice(-2)
		}
		else if(val.r!==undefined || val.g!==undefined || val.b!==undefined)
		{
			if(val.r !== undefined) this.selection.r = val.r;
			if(val.g !== undefined) this.selection.g = val.g;
			if(val.b !== undefined) this.selection.b = val.b;

			var hsv = rgbToHsv(this.selection.r, this.selection.g, this.selection.b);

			this.selection.h = hsv.h;
			this.selection.s = hsv.s;
			this.selection.v = hsv.v;

			this.selection.hex =
				('00'+Math.round(this.selection.r*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.g*255).toString(16)).slice(-2)
				+('00'+Math.round(this.selection.b*255).toString(16)).slice(-2)
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

		}

		if(val)
		{
			this.redraw();

			this.elem.querySelector('.rgbInput .r').innerHTML = this.selection.hex.slice(0,2);
			this.elem.querySelector('.rgbInput .g').innerHTML = this.selection.hex.slice(2,4);
			this.elem.querySelector('.rgbInput .b').innerHTML = this.selection.hex.slice(4,6);
			this.elem.querySelector('.rgbInput .a').innerHTML = ('00'+Math.round(this.selection.a*255).toString(16)).slice(-2);

			var rgba = [Math.round(this.selection.r*255), Math.round(this.selection.g*255), Math.round(this.selection.b*255), this.selection.a];
			rgba = 'rgba('+rgba.join(',')+')';
			this.elem.querySelector('.colorswatch').style['background'] =
				'linear-gradient('+rgba+','+rgba+'), url('+transparencyBgUrl+')';

			if(this.updateTriggerBg){
				this.triggerElem.style['background'] = 'linear-gradient('+rgba+','+rgba+'), url('+transparencyBgUrl+')';
			}

			if(this.colorCallback) this.colorCallback(this.selection);
		}
	}

	Palette.prototype.destroy = function()
	{
		document.body.removeChild(this.elem);
		this.triggerElem.removeEventListener('click', this._onclick)
	}


	window.HtmlPalette = Palette;

	if(jQuery)
	{
		jQuery.fn.extend({
			'HtmlPalette': function(cmd)
			{
				var args = Array.prototype.slice.call(arguments, 1);
				var palette = this.data('HtmlPalette');

				// when in doubt, return the palette object
				if(!cmd)
					return palette;

				// initialize
				else if(cmd instanceof Object)
				{
					if(palette)
						palette.destroy();

					palette = this.data('HtmlPalette', new Palette(this[0], cmd));
					if(palette.colorCallback)
						palette.colorCallback = palette.colorCallback.bind(this);
				}

				// error on command without initialization
				else if(!palette) {
					throw new Error('HtmlPalette is uninitialized on this element');
				}

				// evaluate command
				else switch(cmd)
				{
					case 'color':
						if(args.length)
							palette.color(args[0]);
						else
							return palette.color();
						break;

					case 'colorCallback':
						if(args.length)
							palette.colorCallback = args[0].bind(this);
						else
							return palette.colorCallback;
						break;

					case 'popupEdge':
						if(args.length)
							palette.popupEdge = args[0];
						else
							return palette.popupEdge;
						break;

					case 'radial':
						if(args.length){
							palette.radial = args[0];
							palette.redraw();
						}
						else
							return palette.radial;
						break;

					case 'updateTriggerBg':
						if(args.length)
							palette.updateTriggerBg = args[0];
						else
							return palette.updateTriggerBg;
						break;

					case 'disabled':
						if(args.length)
							palette.disabled = args[0];
						else
							return palette.disabled;
						break;

					case 'redraw':
						palette.redraw();
						break;

					case 'destroy':
						palette.destroy();
						this.data('htmlPalette', null);
						break;
				}
			}
		});
	}


	if(angular)
	{
		var app = angular.module('html-palette', []);

		app.directive('htmlPalette', ['$timeout', function($timeout)
		{
			return {
				restrict: 'AE',
				scope: {
					hsvColor: '=',
					rgbColor: '=',
					hexColor: '=',
					radial: '=',
					disabled: '='
				},
				link: function($scope, elem, attrs)
				{
					var palette = new Palette(elem[0], attrs);
					var dToW = false, wToD = false;
					var applyHandle = null, applyDelay = parseInt(attrs.throttleApply) || 0;

					$scope.$watch('radial', function(newval){
						palette.radial = !!newval;
						palette.redraw();
					});

					$scope.$watch('disabled', function(newval){
						palette.disabled = !!newval;
					});

					elem.bind('$destroy', function(){
						palette.destroy();
					});

					if(attrs.hsvColor)
					{
						palette.colorCallback = function(color){
							if(!dToW)
							{
								wToD = true;

								if(applyHandle)
									$timeout.cancel(applyHandle);

								applyHandle = $timeout(function()
								{
									$scope.hsvColor.h = color.h;
									$scope.hsvColor.s = color.s;
									$scope.hsvColor.v = color.v;
									$scope.hsvColor.a = color.a;

									$scope.$apply();
									applyHandle = null;
									wToD = false;
								}, applyDelay);
							}
						};

						$scope.$watchCollection('hsvColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								palette.color(newval);
								dToW = false;
							}
						});
						
						palette.color($scope.hsvColor);
					}

					else if(attrs.rgbColor)
					{
						palette.colorCallback = function(color){
							if(!dToW)
							{
								wToD = true;

								if(applyHandle)
									$timeout.cancel(applyHandle);

								applyHandle = $timeout(function()
								{
									$scope.rgbColor.r = color.r;
									$scope.rgbColor.g = color.g;
									$scope.rgbColor.b = color.b;
									$scope.rgbColor.a = color.a;

									$scope.$apply();
									applyHandle = null;
									wToD = false;
								}, applyDelay);
							}
						};

						$scope.$watchCollection('rgbColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								palette.color(newval);
								dToW = false;
							}
						});

						palette.color($scope.rgbColor);
					}

					else if(attrs.hexColor)
					{
						palette.colorCallback = function(color){
							if(!dToW){
								wToD = true;

								if(applyHandle)
									$timeout.cancel(applyHandle);

								applyHandle = $timeout(function()
								{
									$scope.hexColor = color.hex;
									$scope.$apply();
									applyHandle = null;
									wToD = false;
								}, applyDelay);
							}
						};

						$scope.$watch('hexColor', function(newval){
							if(newval && !wToD){
								dToW = true;
								palette.color(newval);
								dToW = false;
							}
						});

						palette.color($scope.hexColor);
					}
				}
			};
		}]);
	}

})(window.jQuery, window.angular);
