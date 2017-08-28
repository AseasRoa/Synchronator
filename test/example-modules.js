//== "Synchronator" is already put in "global" when the module is required
require("synchronator")

//== get the module using require() from Synchronator
var module1 = Synchronator.require(__dirname + "/modules/module1.js")

//== "module1" now contains a function that will return Synchronator object when we call it
if (typeof module1 == "function")
{
	module1().then((value) =>
	{
		console.log(value)
	})
}