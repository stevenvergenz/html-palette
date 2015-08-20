# HtmlPalette 

![Square picker](./docs/palette-square.png) ![Radial picker](./docs/palette-radial.png)

An HTML5 color picker designed to be intuitive and easy to use. Comes in square and radial versions. [Live demo](https://stevenvergenz.github.io/html-palette/).


## Example Usage

### Vanilla.js

```javascript
var trigger = document.getElementById('picker');
var palette = new HtmlPalette(trigger, {
	initialColor: '49cc29',
	colorCallback: function(color){
		trigger.style['background-color'] = '#'+color.hex;
	}
});
```

### jQuery

```javascript
$('#picker').HtmlPalette({
	initialColor: {h:0, s:0.8, v:0.8},
	colorCallback: function(color){
		this.triggerElem.style['background-color'] = '#'+color.hex;
	}
});
```

### Angular.js

```javascript
angular.module('myApp', ['html-palette'])
	.controller('MyController', function($scope){
		$scope.color = {r: 0.8, g: 0.3, b: 1.0};
	});
```

```html
<div ng-app='myApp'>
	<div ng-controller='MyController'>
		<html-palette rgb-color='color'></html-color>
	</div>
</div>
```


