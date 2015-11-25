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

	var template = '<%= widgetTemplate %>';
	var vertShaderSrc = '<%= vertShader %>';
	var fragShaderSrc = '<%= fragShader %>';
	var transparencyBgUrl = '<%= checkerImg %>';


	var PalettePopup = {

		"colorCallback": null,
		"elem": document.createElement('div'),
		"selection": {},

		"initialize": function()
		{
			// insert template into dom
			this.elem = document.createElement('div');
			this.elem.id = 'htmlPalettePopup';
			this.elem.innerHTML = template;
			this.elem.onclick = function(e){ e.stopPropagation(); }
			this.elem.style.display = 'none';
			document.body.appendChild(this.elem);

			document.addEventListener('click', function(evt){
				this.elem.style.display = 'none';
			});

			this.canvas = this.elem.children[0].children[0];

			// get gl context
			this.gl = this.canvas.getContext('webgl');
			var gl = this.gl;


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
				this._program = program;
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

			// bind non-configurable uniforms
			gl.uniform1f(gl.getUniformLocation(program, 'swatchWidth'), 20);
			gl.uniform1f(gl.getUniformLocation(program, 'marginWidth'), 10);

			// bind transparency texture
			var gltex = gl.createTexture();
			var img = new Image();
			img.onload = function()
			{
				gl.bindTexture(gl.TEXTURE_2D, gltex);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			};
			img.src = transparencyBgUrl;

			gl.clearColor(0.0, 0.0, 0.0, 0.0);
	

			/******************************************
			* Bind event listeners
			******************************************/

			var self = this,
				twoaxis = this.elem.querySelector('.twoaxis'),
				oneaxis = this.elem.querySelector('.oneaxis'),
				alpha = this.elem.querySelector('.alpha');

			twoaxis.ondragstart = function(evt){
				evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
			}

			twoaxis.ondrag = twoaxis.onmousedown = function(evt){
				var paletteWidth = self.canvas.width - (self.lastOpts && self.lastOpts.useAlpha ? 60 : 30);
				var h = self.canvas.height;
				if( self.lastOpts.radial ){
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
				var h = self.canvas.height;
				if( evt.screenX !== 0 || evt.screenY !== 0 )
					self.color({v: Math.max(0, Math.min(1, (h-evt.offsetY-1)/(h-1)))});
			}

			alpha.ondragstart = function(evt){
				evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
			}

			alpha.ondrag = alpha.onmousedown = function(evt){
				var h = self.canvas.height;
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

		},

		// bind configurable uniforms
		"rebind": function(useAlpha, radial)
		{
			var style = window.getComputedStyle(this.elem.querySelector('.palette'));
			var w = parseInt(style.width), h = parseInt(style.height)-4;

			this.gl.uniform2f(this.gl.getUniformLocation(this._program, 'windowDimensions'), w,h);
			this.gl.uniform1i(this.gl.getUniformLocation(this._program, 'useAlpha'), !!useAlpha);	
			this.gl.uniform1i(this.gl.getUniformLocation(this._program, 'radial'), !!radial);
		},

		// manually position the various ui elements
		"sizePopup": function(useAlpha, classes)
		{
			this.elem.setAttribute('class', classes);

			var popupStyle = window.getComputedStyle(this.elem);
			this._popupWidth = parseInt(popupStyle.width) || 0;
			this._popupHeight = parseInt(popupStyle.height) || 0;

			// size the canvas
			var style = window.getComputedStyle(this.elem.querySelector('.palette'));
			var w = parseInt(style.width), h = parseInt(style.height)-4;
			this.canvas.width = w;
			this.canvas.height = h;
			this.gl.viewport(0, 0, w, h);

			// size the overlay
			var paletteWidth = useAlpha ? w-60 : w-30;
			var twoaxis = this.elem.querySelector('.twoaxis');
			var oneaxis = this.elem.querySelector('.oneaxis')
			var alpha = this.elem.querySelector('.alpha')
			twoaxis.style.width = paletteWidth + 'px';
			twoaxis.style.height = h + 'px';
			oneaxis.style.height = h + 'px';
			alpha.style.height = h + 'px';

			if(!useAlpha){
				alpha.style.display = 'none';
				this.elem.querySelector('.rgbInput .a').style.display = 'none';
				twoaxis.style.left = '0px';
			}

		},
		"color": function(val)
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

				if(this.colorCallback) this.colorCallback(this.selection);
			}
		},

		"redraw": function()
		{
			var selectionUniform = this.gl.getUniformLocation(this._program, 'selectedColor');
			this.gl.uniform4f(selectionUniform, this.selection.h, this.selection.s, this.selection.v, this.selection.a);

			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
			this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);		
		},

		"show": function(opts, evt)
		{
			this.lastOpts = opts;
			opts = opts || {};

			this.elem.style.display = '';
			this.sizePopup(opts.useAlpha, opts.css);
			this.rebind(opts.useAlpha, opts.radial);
			this.color(opts.color || 'aa0000');
		},

		"hide": function(){
			this.elem.style.display = 'none';
		}

	};

	function Trigger(opts)
	{
	}

	Trigger.prototype.onColorSet = function()
	{
		if(this.updateTriggerBg){
			this.triggerElem.style['background'] = 'linear-gradient('+rgba+','+rgba+'), url('+transparencyBgUrl+')';
		}
	}

	window.HtmlPalette = {};
	window.HtmlPalette._popup = PalettePopup;

})(window.jQuery, window.angular);

