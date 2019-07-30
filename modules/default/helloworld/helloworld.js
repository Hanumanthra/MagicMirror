/* global Module */

/* Magic Mirror
 * Module: HelloWorld
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("helloworld",{

	// Default module config.
	defaults: {
		text: "Innovation Garage-NITW"
	},

	getTemplate: function () {
		return "helloworld.njk";
	},

	getTemplateData: function () {
		return this.config;
	},

	myhide();

	function myhide(){
	if(this.config.text == "Innovation Garage-NITW"){
		currentweather.hide();
	}
};


});
