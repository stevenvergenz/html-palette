'use strict';

(function(jQuery, angular)
{


	var Palette = function(triggerElem, opts)
	{
		opts = opts || {};


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
		this.color(opts.initialColor || 'aaaaaa');

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
