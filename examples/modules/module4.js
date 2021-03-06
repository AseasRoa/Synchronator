/*
	This module shows us:
	- that we can mark class methods with *
 */

var module1 = require("module1")

var MyClass = class
{
	* sleep(time) {
		// let's borrow the sleep function from "module1"
		return module1.sleep(time)
   }

	* start() {
		var elapsedMilliseconds = this.sleep(1000)

		return "Sleeping for " + elapsedMilliseconds + " milliseconds"
   }
}

module.exports = MyClass