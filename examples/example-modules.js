//================================================//
//== This example shows how to use Synchronator ==/
//================================================//

// "Synchronator" is already put in the global scope when the module is required and because of that
// "var Synchronator = " is not mandatory here, but we don't want to hurt someone's feelings
var Synchronator = require("synchronator")

// Get the module using require() from Synchronator
var startModule = Synchronator.require(__dirname + "/modules/startModule.js")

// "module1" is now an instance of Synchronator, so let's apply "then" to it
startModule.then((exports) => {
	// we loaded the module and we got the exports, now decide what to do with them
	if (typeof exports === "function")
	{
		// we may want to pass some argument to the function
		var someInputArgument = "\nHello, Synchronator!"

		// let's run the function
		var result = exports(someInputArgument)

		// and process the result
		if (result instanceof Synchronator)
		{
			result.then((value) =>
			{
				console.log(value)
			})
		}
		else
		{
			// do something here if the function is not a Synchronator function
		}
	}
	else
	{
		// do something here if the module exports an object, string ot whatever...
	}
})