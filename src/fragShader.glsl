precision lowp float;
#define M_PI 3.141592653589

varying vec2 windowPosition;
uniform vec4 selectedColor;
uniform float swatchWidth;
uniform float marginWidth;
uniform vec2 windowDimensions;
uniform bool radial;
uniform bool useAlpha;
uniform sampler2D tex;

vec3 hsv2rgb(float h, float s, float v){
	vec3 c = vec3(h,s,v);
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 hsv2rgb(vec3 c){
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 getSelectionColor(vec4 baseColor){
	return vec4( vec3(1.0)-baseColor.rgb, baseColor.a );
}

void main(void){

	float taLeft = useAlpha ? swatchWidth + marginWidth : 0.0;
	float taWidth = windowDimensions.x - swatchWidth - marginWidth - taLeft;
	vec2 center = vec2(taWidth/2.0+taLeft, windowDimensions.y/2.0);
	float aspect = taWidth / windowDimensions.y;
	vec4 color;
	vec2 selectionPosition;

	if( windowPosition.x >= taLeft &&  windowPosition.x <= taLeft+taWidth )
	{
		if(radial)
		{
			vec2 radialVec = (windowPosition - center)*vec2(2.0/taWidth, 2.0/windowDimensions.y);
			radialVec = mat2(max(1.0,aspect), 0.0, 0.0, max(1.0,1.0/aspect)) * radialVec;
			if(length(radialVec) > 1.0) discard;
			float hue = atan(radialVec.y,radialVec.x)/(2.0*M_PI) + 0.5;
			color = vec4(hue, length(radialVec), selectedColor.z, 1.0);

			float angle = (selectedColor.x-0.5)*2.0*M_PI;
			selectionPosition = min(center.x-taLeft, center.y) * selectedColor.y * vec2(cos(angle), sin(angle)) + center;
		}
		else {
			color = vec4((windowPosition.x-taLeft)/taWidth, windowPosition.y/windowDimensions.y, selectedColor.z, 1.0);
			selectionPosition = vec2(selectedColor.x*taWidth+taLeft, selectedColor.y*windowDimensions.y);
		}

		vec2 difference = selectionPosition - windowPosition;
		float radius = length(difference);

		if( radius > 4.5 && radius < 6.0 )
			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));
		else
			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);
	}

	else if(useAlpha && windowPosition.x < swatchWidth)
	{
		vec4 color = vec4(mix( texture2D(tex, windowPosition/16.0).xyz, hsv2rgb(selectedColor.xyz), windowPosition.y/windowDimensions.y), 1.0);

		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.w) < 1.0 )
			gl_FragColor = getSelectionColor(color);
		else
			gl_FragColor = color;
	}

	else if(windowPosition.x > windowDimensions.x-swatchWidth)
	{
		vec4 color = vec4( selectedColor.x, selectedColor.y, windowPosition.y/windowDimensions.y, 1.0);

		if( windowDimensions.y * abs(windowPosition.y/windowDimensions.y-selectedColor.z) < 1.0 )
			gl_FragColor = getSelectionColor(vec4(hsv2rgb(color.xyz), 1.0 ));
		else
			gl_FragColor = vec4( hsv2rgb(color.xyz), 1.0);
	}
	else
		discard;
}

