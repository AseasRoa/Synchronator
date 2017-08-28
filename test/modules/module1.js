// Note that the require() function here is not the native require()
var module2 = require("./module2")

var runFunctionFromOtherModule = function*()
{
	var result = module2.fn1(1000)

	return result
}

module.exports = runFunctionFromOtherModule