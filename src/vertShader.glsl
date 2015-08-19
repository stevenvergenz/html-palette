precision lowp float;
attribute vec3 vertPosition;
varying vec2 windowPosition;
uniform vec2 windowDimensions;

void main(void)
{
	mat3 xform = mat3(0.5*windowDimensions.x, 0.0, 0.0, 0.0, 0.5*windowDimensions.y, 0.0, windowDimensions.x/2.0, windowDimensions.y/2.0, 1.0);
	windowPosition = (xform * vec3(vertPosition.xy, 1.0)).xy;
	gl_Position = vec4(vertPosition,1);
}

