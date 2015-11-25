'use strict';

(function(jQuery, angular)
{
	var Palette = function(triggerElem, opts)
	{
		this.triggerElem = triggerElem;
		this._onclick = Palette.onclick.bind(this);
		this.triggerElem.addEventListener('click', this._onclick);

	}


	window.HtmlPalette = Palette;


})(window.jQuery, window.angular);
