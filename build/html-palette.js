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

	function expandColor(val, partial)
	{
		if(!val) val = {};

		if(val.a === undefined) val.a = 1.0;
		if(partial && partial.a !== undefined) val.a = partial.a;

		if(partial && (partial.h!==undefined || partial.s!==undefined || partial.v!==undefined))
		{
			if(partial.h !== undefined) val.h = partial.h;
			if(partial.s !== undefined) val.s = partial.s;
			if(partial.v !== undefined) val.v = partial.v;

			var rgb = hsvToRgb(val.h, val.s, val.v);
			val.r = Math.max(rgb.r, 0);
			val.g = Math.max(rgb.g, 0);
			val.b = Math.max(rgb.b, 0);

			val.hex =
				('00'+Math.round(val.r*255).toString(16)).slice(-2)
				+('00'+Math.round(val.g*255).toString(16)).slice(-2)
				+('00'+Math.round(val.b*255).toString(16)).slice(-2)
		}
		else if(partial && (partial.r!==undefined || partial.g!==undefined || partial.b!==undefined))
		{
			if(partial.r !== undefined) val.r = partial.r;
			if(partial.g !== undefined) val.g = partial.g;
			if(partial.b !== undefined) val.b = partial.b;

			var hsv = rgbToHsv(val.r, val.g, val.b);

			val.h = hsv.h;
			val.s = hsv.s;
			val.v = hsv.v;

			val.hex =
				('00'+Math.round(val.r*255).toString(16)).slice(-2)
				+('00'+Math.round(val.g*255).toString(16)).slice(-2)
				+('00'+Math.round(val.b*255).toString(16)).slice(-2)
		}
		else if( /^[0-9A-Fa-f]{6}$/.test(partial) )
		{
			val.hex = partial;

			partial = parseInt(partial, 16);
			val.r = ((partial & 0xff0000) >> 16) / 255;
			val.g = ((partial & 0x00ff00) >> 8) / 255;
			val.b = (partial & 0x0000ff) / 255;

			var hsv = rgbToHsv(val.r, val.g, val.b);
			val.h = hsv.h;
			val.s = hsv.s;
			val.v = hsv.v;

		}

		var rgba = [Math.round(val.r*255), Math.round(val.g*255), Math.round(val.b*255), val.a];
		val.css = 'rgba('+rgba.join(',')+')';
		val.background = 'linear-gradient('+val.css+','+val.css+'), url('+transparencyBgUrl+')';

		return val;
	}
	

	var template = '<div class="palette">\n	<canvas width="1" height="1"></canvas>\n	<div class="alpha" draggable="true"></div>\n	<div class="twoaxis" draggable="true"></div>\n	<div class="oneaxis" draggable="true"></div>\n</div>\n<div class="controls">\n	<div class="rgbInput">\n		#\n		<span class="r" draggable="true"></span>\n		<span class="g" draggable="true"></span>\n		<span class="b" draggable="true"></span>\n		<span class="a" draggable="true"></span>\n	</div>\n	<div class="colorswatch"></div>\n</div>\n';
	var vertShaderSrc = 'precision lowp float;\nattribute vec3 vertPosition;\nvarying vec2 windowPosition;\nuniform vec2 windowDimensions;\n\nvoid main(void)\n{\n	mat3 xform = mat3(0.5*windowDimensions.x, 0.0, 0.0, 0.0, 0.5*windowDimensions.y, 0.0, windowDimensions.x/2.0, windowDimensions.y/2.0, 1.0);\n	windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;\n	gl_Position = vec4(vertPosition,1);\n}\n\n';
	var fragShaderSrc = 'precision lowp float;\n#define M_PI 3.141592653589\n\nvarying vec2 windowPosition;\nuniform vec4 selectedColor;\nuniform float swatchWidth;\nuniform float marginWidth;\nuniform vec2 windowDimensions;\nuniform bool radial;\nuniform bool useAlpha;\nuniform sampler2D tex;\n\nvec3 hsv2rgb(vec3 c){\n	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n}\n\nvec4 getSelectionColor(vec4 baseColor){\n	return vec4( vec3(1.0)-baseColor.rgb, baseColor.a );\n}\n\nvoid main(void){\n\n	float taLeft = useAlpha ? swatchWidth + marginWidth : 0.0;\n	float taWidth = windowDimensions.x - swatchWidth - marginWidth - taLeft;\n	vec2 center = vec2(taWidth/2.0+taLeft, windowDimensions.y/2.0);\n	float aspect = taWidth / windowDimensions.y;\n	vec4 color;\n	vec2 selectionPosition;\n\n	if( windowPosition.x >= taLeft &&  windowPosition.x <= taLeft+taWidth )\n	{\n		if(radial)\n		{\n			vec2 radialVec = (windowPosition - center)*vec2(2.0/taWidth, 2.0/windowDimensions.y);\n			radialVec = mat2(max(1.0,aspect), 0.0, 0.0, max(1.0,1.0/aspect)) * radialVec;\n			if(length(radialVec) > 1.0) discard;\n			float hue = atan(radialVec.y,radialVec.x)/(2.0*M_PI) + 0.5;\n			color = vec4(hue, length(radialVec), selectedColor.z, 1.0);\n\n			float angle = (selectedColor.x-0.5)*2.0*M_PI;\n			selectionPosition = min(center.x-taLeft, center.y) * selectedColor.y * vec2(cos(angle), sin(angle)) + center;\n		}\n		else {\n			color = vec4((windowPosition.x-taLeft)/taWidth, windowPosition.y/windowDimensions.y, selectedColor.z, 1.0);\n			selectionPosition = vec2(selectedColor.x*taWidth+taLeft, selectedColor.y*windowDimensions.y);\n		}\n\n		vec2 difference = selectionPosition - windowPosition;\n		float radius = length(difference);\n\n		if( radius > 4.5 && radius < 6.0 )\n			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));\n		else\n			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);\n	}\n\n	else if(useAlpha && windowPosition.x < swatchWidth)\n	{\n		vec4 color = vec4(mix( texture2D(tex, windowPosition/16.0).xyz, hsv2rgb(selectedColor.xyz), windowPosition.y/windowDimensions.y), 1.0);\n\n		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.w) < 1.0 )\n			gl_FragColor = getSelectionColor(color);\n		else\n			gl_FragColor = color;\n	}\n\n	else if(windowPosition.x > windowDimensions.x-swatchWidth)\n	{\n		vec4 color = vec4( selectedColor.x, selectedColor.y, windowPosition.y/windowDimensions.y, 1.0);\n\n		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.z) < 1.0 )\n			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));\n		else\n			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);\n	}\n	else\n		discard;\n}\n\n';
	var transparencyBgUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAK0lEQVQoz2Pcu3cvAzbg5OSEVZyJgUQwqoEYwPj//3+sEvv27RsNJfppAAD+GAhT8tRPqwAAAABJRU5ErkJggg==';

	var paletteInitialized = false;
	var PalettePopup = {

		"colorCallback": null,
		"colorSelectCallback": null,
		"elem": document.createElement('div'),

		"initialize": function()
		{
			var self = this;

			if(document.getElementById('htmlPalettePopup'))
				return;

			// insert template into dom
			this.elem = document.createElement('div');
			this.elem.id = 'htmlPalettePopup';
			this.elem.innerHTML = template;
			this.elem.onclick = function(e){ e.stopPropagation(); }
			this.elem.style.display = 'none';
			document.body.appendChild(this.elem);

			document.addEventListener('click', function(evt){
				self.hide();
			});

			this.canvas = this.elem.children[0].children[0];

			// get gl context
			this.gl = this.canvas.getContext('webgl');
			if(!this.gl) this.gl = this.canvas.getContext('experimental-webgl');
			var gl = this.gl;

			if(!gl){
				console.error('Your web browser does not support WebGL, so cannot make use of the HtmlPalette color picker. Sorry :(');
				return;
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

			var twoaxis = this.elem.querySelector('.twoaxis'),
				oneaxis = this.elem.querySelector('.oneaxis'),
				alpha = this.elem.querySelector('.alpha');

			twoaxis.ondragstart = function(evt){
				if(evt.dataTransfer.setDragImage)
					evt.dataTransfer.setDragImage(document.createElement('div'),0,0);
				if(evt.dataTransfer.dropEffect)
					evt.dataTransfer.dropEffect = 'move';
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

			twoaxis.ondragend = twoaxis.onmouseup = oneaxis.ondragend = oneaxis.onmouseup = alpha.ondragend = alpha.onmouseup =
				function(evt){
					if(self.colorSelectCallback)
						self.colorSelectCallback(self.selection);
				};

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

				e.ondragend = function(evt){
					if(self.colorSelectCallback)
						self.colorSelectCallback(self.selection);
				};
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

		"placePopup": function(evt, popupEdge)
		{
			evt.stopPropagation();

			var popupStyle = window.getComputedStyle(this.elem);
			var popupWidth = parseInt(popupStyle.width) || 0;
			var popupHeight = parseInt(popupStyle.height) || 0;

			var box = evt.target.getBoundingClientRect();
			var origin = {
				x: (box.left+box.right)/2,
				y: (box.top+box.bottom)/2
			};

			var offset = 20;

			// fall back on sw on missing or invalid option
			if( !/^[ns]?[we]?$/.test(popupEdge) || !popupEdge )
				popupEdge = 'se';

			// set position vertically
			if(/^n/.test(popupEdge))
				this.elem.style.top = origin.y - popupHeight - offset + 'px';

			else if(/^s/.test(popupEdge))
				this.elem.style.top = origin.y + offset + 'px';

			else
				this.elem.style.top = origin.y - popupHeight/2 + 'px';

			// set position horizontally
			if(/e$/.test(popupEdge))
				this.elem.style.left = origin.x + offset + 'px';

			else if(/w$/.test(popupEdge))
				this.elem.style.left = origin.x - popupWidth - offset + 'px';

			else
				this.elem.style.left = origin.x - popupWidth/2 + 'px';

			this.elem.style.display = '';
		},

		// manually position the various ui elements
		"sizePopup": function(useAlpha, classes)
		{
			this.elem.setAttribute('class', classes || '');

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
			else {
				alpha.style.display = '';
				this.elem.querySelector('.rgbInput .a').style.display = '';
				twoaxis.style.left = '';
			}

		},
		"color": function(val)
		{
			this.selection = expandColor( this.selection, val );

			if(val)
			{
				this.redraw();
				if(this.colorCallback)
					this.colorCallback(this.selection);
			}
		},

		"redraw": function()
		{
			var selectionUniform = this.gl.getUniformLocation(this._program, 'selectedColor');
			this.gl.uniform4f(selectionUniform, this.selection.h, this.selection.s, this.selection.v, this.selection.a);

			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
			this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);		

			this.elem.querySelector('.rgbInput .r').innerHTML = this.selection.hex.slice(0,2);
			this.elem.querySelector('.rgbInput .g').innerHTML = this.selection.hex.slice(2,4);
			this.elem.querySelector('.rgbInput .b').innerHTML = this.selection.hex.slice(4,6);
			this.elem.querySelector('.rgbInput .a').innerHTML = ('00'+Math.round(this.selection.a*255).toString(16)).slice(-2);
			this.elem.querySelector('.colorswatch').style['background'] = this.selection.background;
		},

		"show": function(opts, evt)
		{
			if(this.gl){
				this.lastOpts = opts;
				opts = opts || {};

				this.placePopup(evt, opts.popupEdge);
				this.sizePopup(opts.useAlpha, opts.css);
				this.rebind(opts.useAlpha, opts.radial);
				this.selection = opts.color;
				this.redraw();
			}
		},

		"hide": function(){
			this.elem.style.display = 'none';
			this.colorCallback = null;
			this.colorSelectCallback = null;
			this.triggerElem = null;
		}

	};

	function Trigger(triggerElem, opts)
	{
		this.triggerElem = triggerElem;

		this.colorCallback = opts.colorCallback || null;
		this.colorSelectCallback = opts.colorSelectCallback || null;
		this.popupEdge = opts.popupEdge || 'se';
		this.css = opts.css || '';
		this.radial = opts.radial || false;
		this.useAlpha = opts.useAlpha || false;
		this.updateTriggerBg = opts.updateTriggerBg !== undefined ? opts.updateTriggerBg : true;
		this.disabled = opts.disabled || false;

		this.selection = {};
		this.color(opts.initialColor || 'aaaaaa');

		PalettePopup.initialize();

		var self = this;

		triggerElem.addEventListener('click', this._clickHandler = function(event)
		{
			if(PalettePopup.triggerElem !== self.triggerElem && !self.disabled)
			{
				PalettePopup.triggerElem = self.triggerElem;
				PalettePopup.colorCallback = self.color.bind(self);
				PalettePopup.colorSelectCallback = function(color){
					if(self.colorSelectCallback)
						self.colorSelectCallback(JSON.parse(JSON.stringify(color)));
				};

				PalettePopup.show({
					radial: self.radial,
					useAlpha: self.useAlpha,
					popupEdge: self.popupEdge,
					css: self.css,
					color: self.selection
				}, event);
			}
		});
	}

	Trigger.prototype.color = function(val, isAngular)
	{
		if(val === undefined)
			return this.selection;
		else
		{
			/*var flag = false;
			for(var i in val){
				if(this.selection[i] !== val[i])
					flag = true;
			}
			if(!flag) return;*/

			if( this.selection !== val )
				this.selection = expandColor(this.selection, val);

			if(this.updateTriggerBg){
				this.triggerElem.style['background'] = this.selection.background;
			}

			if(this.colorCallback){
				this.colorCallback(JSON.parse(JSON.stringify(this.selection)), isAngular);
			}
		}
	}

	Trigger.prototype.destroy = function()
	{
		this.triggerElem.removeEventListener('click', this._clickHandler);
		if(PalettePopup.triggerElem === this.triggerElem){
			PalettePopup.hide();
		}
	}

	window.HtmlPalette = Trigger;
	window.HtmlPalette.PalettePopup = PalettePopup;

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

					palette = this.data('HtmlPalette', new HtmlPalette(this[0], cmd));
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

					case 'colorSelectCallback':
						if(args.length)
							palette.colorSelectCallback = args[0].bind(this);
						else
							return palette.colorSelectCallback;
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
					color: '=',
					radial: '=?',
					alpha: '=?',
					disabled: '=?',
					onColorSelect: '&?'
				},
				link: function($scope, elem, attrs)
				{
					var throttleTimeout = null;
					
					attrs.initialColor = $scope.color;
					var palette = new Trigger(elem[0], attrs);

					$scope.$watch('radial', function(newval){
						palette.radial = !!newval;
					});

					$scope.$watch('alpha', function(newval){
						palette.alpha = !!newval;
					});

					$scope.$watch('disabled', function(newval){
						palette.disabled = !!newval;
					});

					elem.bind('$destroy', function(){
						palette.destroy();
					});

					palette.colorSelectCallback = function(color){
						$scope.onColorSelect && $scope.onColorSelect({color: color});
					};

					palette.colorCallback = function(color, isAngular)
					{
						if($scope.color)
						{
							if(attrs.colorProfile === 'hex')
								$scope.color.hex = color.hex;

							else if(/^[rgbhsva]+$/.test(attrs.colorProfile)){
								for(var i=0; i<attrs.colorProfile.length; i++)
									$scope.color[attrs.colorProfile[i]] = color[attrs.colorProfile[i]];
							}
							else {
								for(var i in color)
									$scope.color[i] = color[i];
							}

							if(!isAngular){
								if(attrs.throttleApply){
									if(throttleTimeout) $timeout.cancel(throttleTimeout);
									throttleTimeout = $timeout($scope.$apply.bind($scope), attrs.throttleApply || 0);
								}
								else {
									$scope.$apply();
								}
							}
						}
					};

					$scope.$watchGroup(['color.h','color.s','color.v'], function(newval, oldval){
						if(newval[0] !== palette.selection.h || newval[1] !== palette.selection.s || newval[2] !== palette.selection.v){
							palette.color({h: newval[0], s: newval[1], v: newval[2]}, true);
						}
					});
					$scope.$watchGroup(['color.r','color.g','color.b'], function(newval, oldval){
						if(newval[0] !== palette.selection.r || newval[1] !== palette.selection.g || newval[2] !== palette.selection.b){
							palette.color({r: newval[0], g: newval[1], b: newval[2]}, true);
						}
					});
					$scope.$watch('color.a', function(newval, oldval){
						if(newval !== palette.selection.a){
							palette.color({a: newval}, true);
						}
					});
					$scope.$watch('color.hex', function(newval, oldval){
						if(newval !== palette.selection.hex){
							palette.color(newval, true);
						}
					});

				}
			};
		}]);
	}

})(window.jQuery, window.angular);

