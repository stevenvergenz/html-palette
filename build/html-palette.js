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


	var PalettePopup = {

		"color": null,
		"elem": document.createElement('div'),

		"initialize": function()
		{
			// insert template into dom
			this.elem = document.createElement('div');
			this.elem.id = 'htmlPalettePopup';
			this.elem.innerHTML = template;
			this.elem.onclick = function(e){ e.stopPropagation(); }
			document.body.appendChild(this.elem);

			// get gl context

			// bind non-configurable uniforms

			// bind event listeners
		},

		// bind configurable uniforms
		"rebindUniforms": function()
		{
			
		},

		// manually position the various ui elements
		"sizePopup": function(useAlpha)
		{
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
			var paletteWidth = useAlpha ? w-60 : w-30;
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


		}


	};

	window.HtmlPalette = {};
	window.HtmlPalette._popup = PalettePopup;

})(window.jQuery, window.angular);

