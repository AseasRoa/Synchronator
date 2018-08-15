/*
	In this module we load the other example modules and run their functions
 */

var module1 = require("./module1")
var module2 = require("./module2")
var module3 = require("./module3")
var module4 = require("./module4")

var start = function*(someInputArgument)
{
	console.log(someInputArgument)

	//== module1 =================================//
	console.log("\n===== Running \"module1\" =====")

	console.log(module1.start(1000))

	//== module2 =================================//
	console.log("\n===== Running \"module2\" =====")

	console.log(module2())

	//== module3 =================================//
	console.log("\n===== Running \"module3\" =====")

	var module3Instance = new module3()
	console.log(module3Instance.start())

	//== module3 =================================//
	console.log("\n===== Running \"module4\" =====")

	var module4Instance = new module3()
	console.log(module4Instance.start())

	return "\nEnd"
}

module.exports = start